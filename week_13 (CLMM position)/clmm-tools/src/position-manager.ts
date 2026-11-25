import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import {
  PoolUtils,
  TickUtils,
  getPdaProtocolPositionAddress,
  getPdaPersonalPositionAddress,
  getPdaTickArrayAddress,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { Decimal } from "decimal.js";
import { createContext } from "./config.js";
import { loadState, saveState, DevnetState } from "./store.js";
import {
  getProgram,
  deriveVaultPdas,
  RAYDIUM_CLMM_PROGRAM_ID,
  MEMO_PROGRAM_ID,
  getVaultBalances,
} from "./vault-adapter.js";

const TX_VERSION = TxVersion.V0;

export interface OpenVaultPositionOptions {
  rangePct: number; // e.g. 7 for ±7%
  amountUi: number; // e.g. 200 units
  slippageBps?: number;
  customSigner?: Keypair;
}

export interface CloseVaultPositionOptions {
  slippageBps?: number;
  customSigner?: Keypair;
}

export interface RebalanceVaultPositionOptions {
  rangePct: number;
  amountUi: number;
  slippageBps?: number;
}

export interface ExternalTradeOptions {
  side: "buy" | "sell"; // buy: quote -> base, sell: base -> quote
  amountUi: number;
}

export function derivePositionAccounts(params: {
  clmmProgram: PublicKey;
  poolId: PublicKey;
  nftMint: PublicKey;
  vaultPda: PublicKey;
  tickLower: number;
  tickUpper: number;
  startLower: number;
  startUpper: number;
}) {
  const { clmmProgram, poolId, nftMint, vaultPda, tickLower, tickUpper, startLower, startUpper } =
    params;

  const positionNftAccount = getAssociatedTokenAddressSync(
    nftMint,
    vaultPda,
    true,
    TOKEN_2022_PROGRAM_ID
  );

  const personalPosition = getPdaPersonalPositionAddress(clmmProgram, nftMint).publicKey;
  const protocolPosition = getPdaProtocolPositionAddress(
    clmmProgram,
    poolId,
    tickLower,
    tickUpper
  ).publicKey;
  const tickArrayLower = getPdaTickArrayAddress(clmmProgram, poolId, startLower).publicKey;
  const tickArrayUpper = getPdaTickArrayAddress(clmmProgram, poolId, startUpper).publicKey;

  return {
    positionNftAccount,
    personalPosition,
    protocolPosition,
    tickArrayLower,
    tickArrayUpper,
  };
}

export async function openVaultPosition(options: OpenVaultPositionOptions) {
  const { connection, owner, raydium } = await createContext();
  const state = loadState();

  if (!state.pool || !state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Pool and tokens must be configured in state");
  }

  const signer = options.customSigner ?? owner;
  const { program } = getProgram(connection, signer);
  const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

  const baseMintPk = new PublicKey(state.tokens.baseMint);
  const quoteMintPk = new PublicKey(state.tokens.quoteMint);
  const poolPk = new PublicKey(state.pool.id);
  const clmmProgram = new PublicKey(state.pool.programId);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);

  // 1. Fetch pool info and calculate ticks
  const { poolInfo } = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
  const currentPrice = (poolInfo as any).currentPrice;

  const rangePct = options.rangePct;
  const minPrice = new Decimal(currentPrice).mul(1 - rangePct / 100);
  const maxPrice = new Decimal(currentPrice).mul(1 + rangePct / 100);

  const { tick: tick1 } = TickUtils.getPriceAndTick({
    poolInfo,
    price: minPrice,
    baseIn: true,
  });
  const { tick: tick2 } = TickUtils.getPriceAndTick({
    poolInfo,
    price: maxPrice,
    baseIn: true,
  });

  const tickLower = Math.min(tick1, tick2);
  const tickUpper = Math.max(tick1, tick2);

  const tickSpacing = (poolInfo as any).tickSpacing ?? 60;
  const startLower = TickUtils.getTickArrayStartIndexByTick(tickLower, tickSpacing);
  const startUpper = TickUtils.getTickArrayStartIndexByTick(tickUpper, tickSpacing);

  // 2. Compute liquidity and amounts
  const decimals = state.tokens.decimals;
  const depositAmount = new BN(new Decimal(options.amountUi).mul(10 ** decimals).toFixed(0));
  const slippageFraction = (options.slippageBps ?? 100) / 10000;
  const epochInfo = await connection.getEpochInfo();

  const liqCalc = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: slippageFraction,
    inputA: true,
    tickUpper,
    tickLower,
    amount: depositAmount,
    add: true,
    amountHasFee: true,
    epochInfo,
  });

  // 3. Generate new NFT mint keypair
  const positionNftMint = Keypair.generate();
  const pdas = derivePositionAccounts({
    clmmProgram,
    poolId: poolPk,
    nftMint: positionNftMint.publicKey,
    vaultPda,
    tickLower,
    tickUpper,
    startLower,
    startUpper,
  });

  const openParams = {
    tickLowerIndex: tickLower,
    tickUpperIndex: tickUpper,
    tickArrayLowerStartIndex: startLower,
    tickArrayUpperStartIndex: startUpper,
    liquidity: liqCalc.liquidity,
    amount0Max: new BN(liqCalc.amountSlippageA.amount),
    amount1Max: new BN(liqCalc.amountSlippageB.amount),
    withMetadata: false,
    baseFlag: null,
  };

  const poolVaultA = new PublicKey(state.pool.vaultA);
  const poolVaultB = new PublicKey(state.pool.vaultB);

  console.log(`Открытие CLMM-позиции от имени Vault PDA:`);
  console.log(`  Current Price:   ${currentPrice}`);
  console.log(`  Tick Range:      [${tickLower}, ${tickUpper}] (±${rangePct}%)`);
  console.log(`  Start Indices:   [${startLower}, ${startUpper}]`);
  console.log(`  Liquidity:       ${liqCalc.liquidity.toString()}`);
  console.log(`  Amount 0 Max:    ${liqCalc.amountSlippageA.amount.toString()}`);
  console.log(`  Amount 1 Max:    ${liqCalc.amountSlippageB.amount.toString()}`);
  console.log(`  NFT Mint:        ${positionNftMint.publicKey.toBase58()}`);

  const txId = await program.methods
    .mintVaultPosition(openParams)
    .accounts({
      authority: signer.publicKey,
      vault: vaultPda,
      swapRoute: swapRoutePda,
      positionNftMint: positionNftMint.publicKey,
      positionNftAccount: pdas.positionNftAccount,
      poolState: poolPk,
      protocolPosition: pdas.protocolPosition,
      tickArrayLower: pdas.tickArrayLower,
      tickArrayUpper: pdas.tickArrayUpper,
      personalPosition: pdas.personalPosition,
      tokenAccount0: quoteTreasuryPda,
      tokenAccount1: baseTreasury,
      baseTreasury,
      quoteTreasury: quoteTreasuryPda,
      tokenVault0: poolVaultA,
      tokenVault1: poolVaultB,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      vaultMint0: poolInfo.mintA.address,
      vaultMint1: poolInfo.mintB.address,
      raydiumProgram: clmmProgram,
    })
    .signers([positionNftMint])
    .rpc();

  state.position = {
    nftMint: positionNftMint.publicKey.toBase58(),
    tickLower,
    tickUpper,
    priceLower: minPrice.toFixed(6),
    priceUpper: maxPrice.toFixed(6),
  };
  state.txs.openVaultPosition = txId;
  saveState(state);

  console.log(`Позиция успешно открыта! Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  return {
    txId,
    nftMint: positionNftMint.publicKey.toBase58(),
    tickLower,
    tickUpper,
    liquidity: liqCalc.liquidity.toString(),
  };
}

export async function harvestVaultFees(options?: { customSigner?: Keypair }) {
  const { connection, owner } = await createContext();
  const state = loadState();

  if (!state.pool || !state.position) {
    throw new Error("No active position in state. Run pos:open first.");
  }

  const signer = options?.customSigner ?? owner;
  const { program } = getProgram(connection, signer);
  const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

  const baseMintPk = new PublicKey(state.tokens.baseMint!);
  const poolPk = new PublicKey(state.pool.id);
  const clmmProgram = new PublicKey(state.pool.programId);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);
  const nftMint = new PublicKey(state.position.nftMint);

  const tickLower = state.position.tickLower;
  const tickUpper = state.position.tickUpper;
  const tickSpacing = 60;
  const startLower = TickUtils.getTickArrayStartIndexByTick(tickLower, tickSpacing);
  const startUpper = TickUtils.getTickArrayStartIndexByTick(tickUpper, tickSpacing);

  const pdas = derivePositionAccounts({
    clmmProgram,
    poolId: poolPk,
    nftMint,
    vaultPda,
    tickLower,
    tickUpper,
    startLower,
    startUpper,
  });

  const poolVaultA = new PublicKey(state.pool.vaultA);
  const poolVaultB = new PublicKey(state.pool.vaultB);

  const balBefore = await getVaultBalances();

  console.log(`Сбор накопленных комиссий для позиции ${nftMint.toBase58()}...`);
  const txId = await program.methods
    .harvestPositionFees()
    .accounts({
      authority: signer.publicKey,
      vault: vaultPda,
      swapRoute: swapRoutePda,
      positionNftAccount: pdas.positionNftAccount,
      personalPosition: pdas.personalPosition,
      poolState: poolPk,
      protocolPosition: pdas.protocolPosition,
      tokenVault0: poolVaultA,
      tokenVault1: poolVaultB,
      tickArrayLower: pdas.tickArrayLower,
      tickArrayUpper: pdas.tickArrayUpper,
      tokenAccount0: quoteTreasuryPda,
      tokenAccount1: baseTreasury,
      baseTreasury,
      quoteTreasury: quoteTreasuryPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      vaultMint0: state.pool.mintA,
      vaultMint1: state.pool.mintB,
      raydiumProgram: clmmProgram,
    })
    .rpc();

  const balAfter = await getVaultBalances();
  const baseDelta = balAfter.base - balBefore.base;
  const quoteDelta = balAfter.quote - balBefore.quote;

  state.txs.harvestFees = txId;
  saveState(state);

  console.log(`Комиссии успешно собраны в хранилища Vault!`);
  console.log(`  Base fees received:  +${baseDelta.toFixed(6)}`);
  console.log(`  Quote fees received: +${quoteDelta.toFixed(6)}`);
  console.log(`  Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  return {
    txId,
    baseDelta,
    quoteDelta,
  };
}

export async function closeVaultPosition(options?: CloseVaultPositionOptions) {
  const { connection, owner } = await createContext();
  const state = loadState();

  if (!state.pool || !state.position) {
    throw new Error("No active position to close");
  }

  const signer = options?.customSigner ?? owner;
  const { program } = getProgram(connection, signer);
  const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

  const baseMintPk = new PublicKey(state.tokens.baseMint!);
  const poolPk = new PublicKey(state.pool.id);
  const clmmProgram = new PublicKey(state.pool.programId);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);
  const nftMint = new PublicKey(state.position.nftMint);

  const tickLower = state.position.tickLower;
  const tickUpper = state.position.tickUpper;
  const tickSpacing = 60;
  const startLower = TickUtils.getTickArrayStartIndexByTick(tickLower, tickSpacing);
  const startUpper = TickUtils.getTickArrayStartIndexByTick(tickUpper, tickSpacing);

  const pdas = derivePositionAccounts({
    clmmProgram,
    poolId: poolPk,
    nftMint,
    vaultPda,
    tickLower,
    tickUpper,
    startLower,
    startUpper,
  });

  const poolVaultA = new PublicKey(state.pool.vaultA);
  const poolVaultB = new PublicKey(state.pool.vaultB);

  console.log(`Закрытие позиции Vault ${nftMint.toBase58()} (вывод ликвидности + сжигание NFT)...`);

  const closeParams = {
    amount0Min: new BN(0),
    amount1Min: new BN(0),
  };

  const txId = await program.methods
    .withdrawAndBurnPosition(closeParams)
    .accounts({
      authority: signer.publicKey,
      vault: vaultPda,
      swapRoute: swapRoutePda,
      positionNftMint: nftMint,
      positionNftAccount: pdas.positionNftAccount,
      personalPosition: pdas.personalPosition,
      poolState: poolPk,
      protocolPosition: pdas.protocolPosition,
      tokenVault0: poolVaultA,
      tokenVault1: poolVaultB,
      tickArrayLower: pdas.tickArrayLower,
      tickArrayUpper: pdas.tickArrayUpper,
      tokenAccount0: quoteTreasuryPda,
      tokenAccount1: baseTreasury,
      baseTreasury,
      quoteTreasury: quoteTreasuryPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      vaultMint0: state.pool.mintA,
      vaultMint1: state.pool.mintB,
      systemProgram: SystemProgram.programId,
      raydiumProgram: clmmProgram,
    })
    .rpc();

  // Verify personalPosition is closed
  const posAcc = await connection.getAccountInfo(pdas.personalPosition);
  if (posAcc !== null) {
    console.warn("Внимание: personalPosition аккаунт всё ещё существует");
  } else {
    console.log("PersonalPosition аккаунт успешно закрыт.");
  }

  delete state.position;
  state.txs.closePosition = txId;
  saveState(state);

  console.log(`Позиция закрыта! Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  return { txId };
}

export async function rebalanceVaultPosition(options: RebalanceVaultPositionOptions) {
  const state = loadState();
  let closeTxId: string | undefined;

  if (state.position) {
    console.log("Существующая позиция обнаружена. Выполняется закрытие...");
    const closeRes = await closeVaultPosition({ slippageBps: options.slippageBps });
    closeTxId = closeRes.txId;
  }

  console.log(`Открытие новой сбалансированной позиции (±${options.rangePct}%)...`);
  const openRes = await openVaultPosition({
    rangePct: options.rangePct,
    amountUi: options.amountUi,
    slippageBps: options.slippageBps,
  });

  const updatedState = loadState();
  updatedState.txs.rebalancePosition = openRes.txId;
  saveState(updatedState);

  return {
    closeTxId,
    openTxId: openRes.txId,
    newNftMint: openRes.nftMint,
    tickLower: openRes.tickLower,
    tickUpper: openRes.tickUpper,
  };
}

export async function externalTrade(options: ExternalTradeOptions) {
  const { connection, owner, raydium } = await createContext();
  const state = loadState();

  if (!state.pool || !state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Pool and tokens not configured");
  }

  const { side, amountUi } = options;
  const isBuy = side === "buy"; // buy = spend quote, receive base
  const inputMint = isBuy
    ? new PublicKey(state.tokens.quoteMint)
    : new PublicKey(state.tokens.baseMint);

  const amountIn = new BN(new Decimal(amountUi).mul(10 ** state.tokens.decimals).toFixed(0));

  const res = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
  const epochInfo = await connection.getEpochInfo();

  const tokenOut = inputMint.equals(new PublicKey(state.tokens.baseMint))
    ? res.computePoolInfo.mintA.address === state.tokens.quoteMint
      ? res.computePoolInfo.mintA
      : res.computePoolInfo.mintB
    : res.computePoolInfo.mintA.address === state.tokens.baseMint
    ? res.computePoolInfo.mintA
    : res.computePoolInfo.mintB;

  const priceBefore = (res.poolInfo as any).currentPrice ?? (res.poolInfo as any).price;
  console.log(`Внешний трейд: ${side.toUpperCase()} ${amountUi} токенов...`);
  console.log(`  Current Price Before: ${priceBefore}`);

  const quote = PoolUtils.computeAmountOutFormat({
    poolInfo: res.computePoolInfo,
    tickArrayCache: res.tickData[state.pool.id],
    amountIn,
    tokenOut,
    slippage: 0.1, // 10% tolerance for price impact pushes
    epochInfo,
  });

  const { execute } = await raydium.clmm.swap({
    poolInfo: res.poolInfo,
    poolKeys: res.poolKeys,
    inputMint,
    amountIn,
    amountOutMin: quote.minAmountOut.amount.raw,
    observationId: new PublicKey(state.pool.observationId),
    ownerInfo: { useSOLBalance: false },
    remainingAccounts: quote.remainingAccounts,
    txVersion: TX_VERSION,
  });

  const { txId } = await execute({ sendAndConfirm: true });

  const rpcAfter = await raydium.clmm.getRpcClmmPoolInfo({ poolId: state.pool.id });
  const priceAfter = (rpcAfter as any).currentPrice ?? (rpcAfter as any).price;
  console.log(`  Current Price After:  ${priceAfter}`);
  console.log(`  Tx: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  state.txs[`externalTrade_${Date.now()}`] = txId;
  saveState(state);

  return {
    txId,
    priceBefore,
    priceAfter,
  };
}
