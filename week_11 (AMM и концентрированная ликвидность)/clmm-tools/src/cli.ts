import { PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TickUtils, PoolUtils } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import Decimal from "decimal.js";
import { createContext, CLMM_PROGRAM, DEVNET_AMM_CONFIG, TX_VERSION } from "./config.js";
import { loadState, saveState } from "./store.js";

const DECIMALS = 6;

async function handleMint() {
  const { connection, owner } = await createContext();
  const state = loadState();

  let baseMintStr = process.env.BASE_MINT ?? state.tokens.baseMint;
  if (!baseMintStr) {
    const baseMint = await createMint(connection, owner, owner.publicKey, null, DECIMALS);
    baseMintStr = baseMint.toBase58();
    console.log("Создан базовый токен:", baseMintStr);
  }

  let quoteMintStr = state.tokens.quoteMint;
  if (!quoteMintStr) {
    const quoteMint = await createMint(connection, owner, owner.publicKey, null, DECIMALS);
    quoteMintStr = quoteMint.toBase58();
    console.log("Создан котируемый токен (mUSDC):", quoteMintStr);
  }

  const mintAmount = BigInt(100_000) * BigInt(10 ** DECIMALS);

  for (const mintStr of [baseMintStr, quoteMintStr]) {
    const mintPk = new PublicKey(mintStr);
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      owner,
      mintPk,
      owner.publicKey
    );
    await mintTo(connection, owner, mintPk, ata.address, owner, mintAmount);
    console.log(`Начислено 100 000 токенов на ATA ${ata.address.toBase58()}`);
  }

  state.tokens = { baseMint: baseMintStr, quoteMint: quoteMintStr, decimals: DECIMALS };
  saveState(state);
  console.log("Сохранено в devnet-state.json");
}

async function handleCreatePool() {
  const { raydium } = await createContext();
  const state = loadState();

  if (!state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Сначала выполните: npm run mint");
  }

  const targetPrice = Number(process.env.INIT_PRICE ?? "4");

  const mint1 = {
    address: state.tokens.baseMint,
    programId: TOKEN_PROGRAM_ID.toBase58(),
    decimals: state.tokens.decimals,
  };
  const mint2 = {
    address: state.tokens.quoteMint,
    programId: TOKEN_PROGRAM_ID.toBase58(),
    decimals: state.tokens.decimals,
  };

  const { execute, extInfo } = await raydium.clmm.createPool({
    programId: CLMM_PROGRAM,
    mint1,
    mint2,
    ammConfig: DEVNET_AMM_CONFIG,
    initialPrice: new Decimal(targetPrice),
    txVersion: TX_VERSION,
  });

  const { txId } = await execute({ sendAndConfirm: true });
  const addr = extInfo.address;

  state.pool = {
    id: addr.id,
    programId: CLMM_PROGRAM.toBase58(),
    ammConfigId: DEVNET_AMM_CONFIG.id.toBase58(),
    mintA: addr.mintA.address,
    mintB: addr.mintB.address,
    vaultA: addr.vault.A,
    vaultB: addr.vault.B,
    observationId: addr.observationId,
    exBitmapAccount: addr.exBitmapAccount,
    initialPrice: targetPrice,
  };
  state.txs.createPool = txId;
  saveState(state);

  console.log("CLMM-пул создан:", addr.id);
  console.log(`Explorer: https://explorer.solana.com/tx/${txId}?cluster=devnet`);
}

async function handleOpenPosition() {
  const { raydium } = await createContext();
  const state = loadState();

  if (!state.pool) {
    throw new Error("Сначала создайте пул: npm run pool");
  }

  const downPct = Number(process.env.LOWER_PCT ?? "15") / 100;
  const upPct = Number(process.env.UPPER_PCT ?? "25") / 100;
  const depositUi = Number(process.env.DEPOSIT_AMOUNT ?? "5000");

  const rpcPool = await raydium.clmm.getRpcClmmPoolInfo({ poolId: state.pool.id });
  const currentPrice = rpcPool.currentPrice;

  const minPrice = new Decimal(currentPrice).mul(1 - downPct);
  const maxPrice = new Decimal(currentPrice).mul(1 + upPct);

  let poolInfo: any;
  let poolKeys: any;

  try {
    const res = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
    poolInfo = res.poolInfo;
    poolKeys = res.poolKeys;
  } catch (err: any) {
    console.warn("getPoolInfoFromRpc failed, falling back to manual poolInfo/poolKeys assembly:", err.message);
    poolInfo = rpcPool;
    poolKeys = {
      id: new PublicKey(state.pool.id),
      programId: new PublicKey(state.pool.programId),
      ammConfig: DEVNET_AMM_CONFIG,
      mintA: {
        address: state.pool.mintA,
        decimals: state.tokens.decimals,
        programId: TOKEN_PROGRAM_ID.toBase58(),
      },
      mintB: {
        address: state.pool.mintB,
        decimals: state.tokens.decimals,
        programId: TOKEN_PROGRAM_ID.toBase58(),
      },
      vault: {
        A: state.pool.vaultA,
        B: state.pool.vaultB,
      },
      observationId: state.pool.observationId,
    };
  }

  const { tick: tickLower } = TickUtils.getPriceAndTick({
    poolInfo,
    price: minPrice,
    baseIn: true,
  });
  const { tick: tickUpper } = TickUtils.getPriceAndTick({
    poolInfo,
    price: maxPrice,
    baseIn: true,
  });

  const baseAmount = new BN(
    new Decimal(depositUi).mul(10 ** poolInfo.mintA.decimals).toFixed(0)
  );

  const epochInfo = await raydium.connection.getEpochInfo();
  const liquidityCalc = await PoolUtils.getLiquidityAmountOutFromAmountIn({
    poolInfo,
    slippage: 0,
    inputA: true,
    tickUpper: Math.max(tickLower, tickUpper),
    tickLower: Math.min(tickLower, tickUpper),
    amount: baseAmount,
    add: true,
    amountHasFee: true,
    epochInfo,
  });

  const { execute, extInfo } = await raydium.clmm.openPositionFromBase({
    poolInfo,
    poolKeys,
    tickLower: Math.min(tickLower, tickUpper),
    tickUpper: Math.max(tickLower, tickUpper),
    base: "MintA",
    ownerInfo: { useSOLBalance: true },
    baseAmount,
    otherAmountMax: liquidityCalc.amountSlippageB.amount,
    txVersion: TX_VERSION,
  });

  const { txId } = await execute({ sendAndConfirm: true });

  state.position = {
    nftMint: extInfo.nftMint.toBase58(),
    tickLower: Math.min(tickLower, tickUpper),
    tickUpper: Math.max(tickLower, tickUpper),
    priceLower: minPrice.toFixed(6),
    priceUpper: maxPrice.toFixed(6),
  };
  state.txs.openPosition = txId;
  saveState(state);

  console.log("NFT-позиция открыта:", extInfo.nftMint.toBase58());
  console.log(`Explorer: https://explorer.solana.com/tx/${txId}?cluster=devnet`);
}

async function handleInspect() {
  const { raydium } = await createContext();
  const state = loadState();

  if (!state.pool) {
    throw new Error("Пул ещё не создан.");
  }

  const rpcInfo = await raydium.clmm.getRpcClmmPoolInfo({ poolId: state.pool.id });
  console.log("=== Состояние CLMM-пула (Devnet) ===");
  console.log("Pool ID:       ", state.pool.id);
  console.log("Mint A / B:    ", state.pool.mintA, "/", state.pool.mintB);
  console.log("Текущая цена:  ", rpcInfo.currentPrice.toString());
  console.log("Текущий тик:   ", rpcInfo.tickCurrent);
  console.log("Ликвидность:   ", rpcInfo.liquidity.toString());

  if (state.position) {
    console.log("\n=== Открытая позиция ===");
    console.log("NFT Mint:      ", state.position.nftMint);
    console.log("Диапазон тиков:", `[${state.position.tickLower},${state.position.tickUpper}]`);
    console.log("Диапазон цен:  ", `${state.position.priceLower} — ${state.position.priceUpper}`);
  }
}

const cmd = process.argv[2];
switch (cmd) {
  case "mint":
    await handleMint();
    break;
  case "pool":
    await handleCreatePool();
    break;
  case "lp":
    await handleOpenPosition();
    break;
  case "inspect":
    await handleInspect();
    break;
  default:
    console.log("Доступные команды: npm run mint | pool | lp | inspect");
}
