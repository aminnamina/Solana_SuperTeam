import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import { AnchorProvider, Program, Wallet, BN } from "@coral-xyz/anchor";
import { PoolUtils } from "@raydium-io/raydium-sdk-v2";
import { createContext } from "./config.js";
import { loadState, saveState, DevnetState } from "./store.js";
import { SECURITY_VAULT_IDL, SECURITY_VAULT_PROGRAM_ID } from "./idl.js";

export const RAYDIUM_CLMM_PROGRAM_ID = new PublicKey(
  "DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH"
);
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function getProgram(connection: Connection, owner: Keypair) {
  const wallet = new Wallet(owner);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = new Program(SECURITY_VAULT_IDL, provider);
  return { program, provider };
}

export function deriveVaultPdas(ownerPk: PublicKey) {
  const programId = new PublicKey(SECURITY_VAULT_PROGRAM_ID);
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerPk.toBuffer()],
    programId
  );
  const [swapRoutePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("swap_route"), vaultPda.toBuffer()],
    programId
  );
  const [quoteTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("quote_treasury"), vaultPda.toBuffer()],
    programId
  );
  return { vaultPda, swapRoutePda, quoteTreasuryPda };
}

export async function getVaultBalances() {
  const { connection, owner } = await createContext();
  const state = loadState();
  if (!state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Tokens not found in state");
  }
  const { vaultPda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);
  const baseMintPk = new PublicKey(state.tokens.baseMint);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);

  let baseUi = 0;
  let quoteUi = 0;
  let baseRaw = "0";
  let quoteRaw = "0";

  try {
    const balA = await connection.getTokenAccountBalance(baseTreasury);
    baseUi = balA.value.uiAmount ?? 0;
    baseRaw = balA.value.amount;
  } catch {}

  try {
    const balB = await connection.getTokenAccountBalance(quoteTreasuryPda);
    quoteUi = balB.value.uiAmount ?? 0;
    quoteRaw = balB.value.amount;
  } catch {}

  return {
    vaultPda: vaultPda.toBase58(),
    baseTreasury: baseTreasury.toBase58(),
    quoteTreasury: quoteTreasuryPda.toBase58(),
    base: baseUi,
    quote: quoteUi,
    baseRaw,
    quoteRaw,
  };
}

export async function initSwapRoute() {
  const { connection, owner } = await createContext();
  const state = loadState();

  if (!state.pool || !state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Pool and tokens must exist in state. Run mint & pool first.");
  }

  const { program } = getProgram(connection, owner);
  const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

  // 1. Ensure vault account exists
  const vaultAcc = await connection.getAccountInfo(vaultPda);
  if (!vaultAcc) {
    console.log("Инициализация Vault PDA:", vaultPda.toBase58());
    await program.methods
      .initializeVault()
      .accounts({
        authority: owner.publicKey,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Vault PDA инициализирован");
  }

  // 2. Ensure base_treasury (ATA of vault) exists and is funded
  const baseMintPk = new PublicKey(state.tokens.baseMint);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);
  const baseTreasuryInfo = await connection.getAccountInfo(baseTreasury);

  if (!baseTreasuryInfo) {
    console.log("Создание base_treasury ATA для Vault:", baseTreasury.toBase58());
    const createAtaIx = createAssociatedTokenAccountInstruction(
      owner.publicKey,
      baseTreasury,
      vaultPda,
      baseMintPk
    );
    const tx = new Transaction().add(createAtaIx);
    await sendAndConfirmTransaction(connection, tx, [owner]);
  }

  // Fund base_treasury with initial balance from owner ATA if low
  try {
    const bal = await connection.getTokenAccountBalance(baseTreasury);
    if ((bal.value.uiAmount ?? 0) < 500) {
      console.log("Пополнение base_treasury из кошелька владельца...");
      const ownerAta = await getOrCreateAssociatedTokenAccount(
        connection,
        owner,
        baseMintPk,
        owner.publicKey
      );
      await transfer(
        connection,
        owner,
        ownerAta.address,
        baseTreasury,
        owner,
        BigInt(2000) * BigInt(10 ** state.tokens.decimals)
      );
      console.log("Пополнено 2000 Base токенов в base_treasury");
    }
  } catch (err: any) {
    console.warn("Проверка баланса base_treasury:", err.message);
  }

  // 3. Configure swap route
  const poolPk = new PublicKey(state.pool.id);
  const quoteMintPk = new PublicKey(state.tokens.quoteMint);

  console.log("Вызов configure_swap_route...");
  const txId = await program.methods
    .configureSwapRoute()
    .accounts({
      authority: owner.publicKey,
      vault: vaultPda,
      poolState: poolPk,
      vaultMint: baseMintPk,
      quoteMint: quoteMintPk,
      swapRoute: swapRoutePda,
      quoteTreasury: quoteTreasuryPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  state.vault = {
    programId: SECURITY_VAULT_PROGRAM_ID,
    vaultPda: vaultPda.toBase58(),
    baseTreasury: baseTreasury.toBase58(),
    swapRoute: swapRoutePda.toBase58(),
    quoteTreasury: quoteTreasuryPda.toBase58(),
  };
  state.txs.configureSwapRoute = txId;
  saveState(state);

  console.log("SwapRoute успешно настроен!");
  console.log("SwapRoute PDA:   ", swapRoutePda.toBase58());
  console.log("Quote Treasury:  ", quoteTreasuryPda.toBase58());
  console.log("Base Treasury:   ", baseTreasury.toBase58());
  console.log(`Explorer: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  return { txId, swapRoutePda, quoteTreasuryPda, baseTreasury };
}

export interface VaultSwapOptions {
  direction: "base-to-quote" | "quote-to-base" | "BaseToQuote" | "QuoteToBase";
  amountUi: number;
  slippageBps?: number;
  overrideMinOut?: BN;
  customSigner?: Keypair;
}

export async function runVaultSwap(options: VaultSwapOptions) {
  const { connection, owner, raydium } = await createContext();
  const state = loadState();

  if (!state.pool || !state.tokens.baseMint || !state.tokens.quoteMint) {
    throw new Error("Pool and tokens not configured");
  }

  const signer = options.customSigner ?? owner;
  const { program } = getProgram(connection, signer);
  const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

  const baseMintPk = new PublicKey(state.tokens.baseMint);
  const quoteMintPk = new PublicKey(state.tokens.quoteMint);
  const poolPk = new PublicKey(state.pool.id);
  const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);

  const isBaseToQuote =
    options.direction === "base-to-quote" || options.direction === "BaseToQuote";

  const decimals = state.tokens.decimals;
  const amountInRaw = new BN(
    Math.round(options.amountUi * 10 ** decimals)
  );

  const res = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
  const epochInfo = await connection.getEpochInfo();

  const tokenOut = isBaseToQuote
    ? res.computePoolInfo.mintA.address === state.tokens.quoteMint
      ? res.computePoolInfo.mintA
      : res.computePoolInfo.mintB
    : res.computePoolInfo.mintA.address === state.tokens.baseMint
    ? res.computePoolInfo.mintA
    : res.computePoolInfo.mintB;

  const slippageFraction = (options.slippageBps ?? 100) / 10000;
  const quote = PoolUtils.computeAmountOutFormat({
    poolInfo: res.computePoolInfo,
    tickArrayCache: res.tickData[state.pool.id],
    amountIn: amountInRaw,
    tokenOut,
    slippage: slippageFraction,
    epochInfo,
  });

  const estimatedOut = quote.amountOut.amount.raw;
  let minAmountOut = options.overrideMinOut ?? quote.minAmountOut.amount.raw;

  const currentPrice = res.poolInfo.currentPrice;

  // Remaining accounts: exBitmapAccount + tick arrays
  const exBitmapPk = new PublicKey(state.pool.exBitmapAccount);
  const remainingAccounts = [
    { pubkey: exBitmapPk, isSigner: false, isWritable: true },
    ...quote.remainingAccounts.map((pk) => ({
      pubkey: pk,
      isSigner: false,
      isWritable: true,
    })),
  ];

  const swapParams = {
    direction: isBaseToQuote ? { baseToQuote: {} } : { quoteToBase: {} },
    amountIn: amountInRaw,
    minAmountOut,
  };

  const poolVaultA = new PublicKey(state.pool.vaultA);
  const poolVaultB = new PublicKey(state.pool.vaultB);
  const ammConfigPk = new PublicKey(state.pool.ammConfigId);
  const observationPk = new PublicKey(state.pool.observationId);

  const txId = await program.methods
    .executeClmmSwap(swapParams)
    .accounts({
      authority: signer.publicKey,
      vault: vaultPda,
      swapRoute: swapRoutePda,
      poolState: poolPk,
      ammConfig: ammConfigPk,
      baseTreasury,
      quoteTreasury: quoteTreasuryPda,
      poolVaultA,
      poolVaultB,
      observationState: observationPk,
      baseMint: baseMintPk,
      quoteMint: quoteMintPk,
      tokenProgram: TOKEN_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      memoProgram: MEMO_PROGRAM_ID,
      raydiumProgram: RAYDIUM_CLMM_PROGRAM_ID,
    })
    .remainingAccounts(remainingAccounts)
    .rpc();

  return {
    txId,
    currentPrice,
    amountInUi: options.amountUi,
    estimatedOutRaw: estimatedOut.toString(),
    minAmountOutRaw: minAmountOut.toString(),
  };
}
