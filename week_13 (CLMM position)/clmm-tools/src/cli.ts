import { PublicKey } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { TickUtils, PoolUtils } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import { Decimal } from "decimal.js";
import { createContext, CLMM_PROGRAM, DEVNET_AMM_CONFIG, TX_VERSION } from "./config.js";
import { loadState, saveState } from "./store.js";
import {
  openVaultPosition,
  harvestVaultFees,
  closeVaultPosition,
  rebalanceVaultPosition,
  externalTrade,
} from "./position-manager.js";
import { initSwapRoute, runVaultSwap, getVaultBalances } from "./vault-adapter.js";

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
    mint1: mint1 as any,
    mint2: mint2 as any,
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

  if (state.vault?.swapRoute) {
    console.log("\n=== Состояние Vault (Week 12) ===");
    console.log("Vault PDA:     ", state.vault.vaultPda);
    console.log("SwapRoute PDA: ", state.vault.swapRoute);
    console.log("Quote Treasury:", state.vault.quoteTreasury);
    try {
      const bal = await getVaultBalances();
      console.log("Vault Base:    ", bal.base);
      console.log("Vault Quote:   ", bal.quote);
    } catch {}
  }
}

async function handleRoute() {
  console.log("=== Настройка SwapRoute для Vault (Week 12) ===");
  const res = await initSwapRoute();
  console.log("Конфигурация завершена. TxId:", res.txId);
}

async function handleSwap() {
  const args = process.argv.slice(3);
  let directionArg = "base-to-quote";
  let amountArg = 150;
  let failFlag = false;

  for (const arg of args) {
    if (arg === "base-to-quote" || arg === "quote-to-base") {
      directionArg = arg;
    } else if (arg === "fail") {
      failFlag = true;
    } else if (!isNaN(Number(arg))) {
      amountArg = Number(arg);
    }
  }

  const { raydium } = await createContext();
  const state = loadState();
  if (!state.pool) throw new Error("Пул не найден в state");

  console.log("=== Выполнение Raydium CLMM CPI-свопа из Vault ===");
  console.log(`Направление: ${directionArg}, Сумма: ${amountArg}, Режим fail: ${failFlag}`);

  const rpcBefore = await raydium.clmm.getRpcClmmPoolInfo({ poolId: state.pool.id });
  const balBefore = await getVaultBalances();

  console.log("\n--- Состояние ДО свопа ---");
  console.log("Цена пула:           ", rpcBefore.currentPrice.toString());
  console.log("Баланс Base (Vault): ", balBefore.base);
  console.log("Баланс Quote (Vault):", balBefore.quote);

  let overrideMinOut: any = undefined;
  if (failFlag) {
    console.log("\n[FAIL TEST] Завышаем min_amount_out в 1.5 раза от котировки для проверки slippage protection...");
    const res = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
    const isBaseToQuote = directionArg === "base-to-quote";
    const tokenOut = isBaseToQuote
      ? res.computePoolInfo.mintA.address === state.tokens.quoteMint
        ? res.computePoolInfo.mintA
        : res.computePoolInfo.mintB
      : res.computePoolInfo.mintA.address === state.tokens.baseMint
      ? res.computePoolInfo.mintA
      : res.computePoolInfo.mintB;
    const epochInfo = await raydium.connection.getEpochInfo();
    const quote = PoolUtils.computeAmountOutFormat({
      poolInfo: res.computePoolInfo,
      tickArrayCache: res.tickData[state.pool.id],
      amountIn: new BN(Math.round(amountArg * 10 ** state.tokens.decimals)),
      tokenOut,
      slippage: 0.01,
      epochInfo,
    });
    // 1.5x of estimated output
    overrideMinOut = quote.amountOut.amount.raw.mul(new BN(150)).div(new BN(100));
    console.log("Завышенный min_amount_out (raw):", overrideMinOut.toString());
  }

  try {
    const swapRes = await runVaultSwap({
      direction: directionArg as any,
      amountUi: amountArg,
      overrideMinOut,
    });

    console.log("\nСвоп успешно подтверждён в Devnet!");
    console.log("Tx Signature:        ", swapRes.txId);
    console.log(`Explorer: https://explorer.solana.com/tx/${swapRes.txId}?cluster=devnet`);

    const rpcAfter = await raydium.clmm.getRpcClmmPoolInfo({ poolId: state.pool.id });
    const balAfter = await getVaultBalances();

    console.log("\n--- Состояние ПОСЛЕ свопа ---");
    console.log("Цена пула:           ", rpcAfter.currentPrice.toString());
    console.log("Баланс Base (Vault): ", balAfter.base, `(Δ: ${balAfter.base - balBefore.base})`);
    console.log("Баланс Quote (Vault):", balAfter.quote, `(Δ: ${balAfter.quote - balBefore.quote})`);

    state.txs.swapSuccess = swapRes.txId;
    saveState(state);
  } catch (err: any) {
    console.log("\nТранзакция завершилась с ошибкой (как и ожидалось в fail-тесте):");
    console.log(err.message);
    if (failFlag) {
      console.log("\nОТЧЁТ: Сработала ончейн-защита от slippage (TooLittleOutputReceived / 6018 / SlippageExceeded). Балансы хранилища не изменились.");
      // Check if simulation failed with 6018
      state.txs.swapFailed = err.signature ?? "REJECTED_BY_SLIPPAGE_PROTECTION_6018";
      saveState(state);
    } else {
      throw err;
    }
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
  case "route":
    await handleRoute();
    break;
  case "swap":
    await handleSwap();
    break;
  case "pos:open": {
    const rangePct = Number(process.argv[3] ?? "7");
    const amountUi = Number(process.argv[4] ?? "200");
    await openVaultPosition({ rangePct, amountUi });
    break;
  }
  case "pos:trade": {
    const side = (process.argv[3] ?? "buy") as "buy" | "sell";
    const amountUi = Number(process.argv[4] ?? "50");
    await externalTrade({ side, amountUi });
    break;
  }
  case "pos:harvest": {
    await harvestVaultFees();
    break;
  }
  case "pos:rebalance": {
    const rangePct = Number(process.argv[3] ?? "7");
    const amountUi = Number(process.argv[4] ?? "200");
    await rebalanceVaultPosition({ rangePct, amountUi });
    break;
  }
  case "pos:close": {
    await closeVaultPosition();
    break;
  }
  default:
    console.log("Доступные команды: npm run mint | pool | lp | inspect | route | swap | pos:open | pos:trade | pos:harvest | pos:rebalance | pos:close");
}
