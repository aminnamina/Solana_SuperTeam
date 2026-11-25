import * as fs from "fs";
import * as crypto from "crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import assert from "assert";

const PROGRAM_ID = new PublicKey("7REqUSGJk9NFp9gpnqieQmku3PKwWtfsE8Cj3AYk623s");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const KEYPAIR_PATH = "./devnet-keypair.json";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeGetAccount(connection: Connection, address: PublicKey, retries = 6) {
  for (let i = 0; i < retries; i++) {
    try {
      return await getAccount(connection, address);
    } catch (e: any) {
      if (i === retries - 1) throw e;
      await sleep(2000 * (i + 1));
    }
  }
  throw new Error("Failed to get account after retries");
}

function anchorDiscriminator(name: string): Buffer {
  return crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function u64ToLeBytes(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value), 0);
  return buf;
}

async function main() {
  console.log("=== TOKEN VAULT INTEGRATION TEST (WEEKS 8, 9, 10) ===");
  const connection = new Connection(RPC_URL, "confirmed");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf-8")));
  const payer = Keypair.fromSecretKey(secretKey);

  console.log("Payer / Authority:", payer.publicKey.toBase58());
  console.log("Program ID:       ", PROGRAM_ID.toBase58());

  // 1. Setup Base Asset Mint (6 decimals)
  console.log("\n[0] Creating Asset Mint on Devnet...");
  const assetMint = await createMint(connection, payer, payer.publicKey, null, 6);
  console.log("Asset Mint created:", assetMint.toBase58());

  // Mint 10,000,000 raw units (10.0 tokens) to payer ATA
  const userAssetAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    assetMint,
    payer.publicKey
  );
  await mintTo(connection, payer, assetMint, userAssetAta.address, payer, 10_000_000n);
  console.log("Minted 10.0 asset tokens to user ATA:", userAssetAta.address.toBase58());

  // 2. Derive PDAs
  const [vaultConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault_config"), assetMint.toBuffer()],
    PROGRAM_ID
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), vaultConfigPda.toBuffer()],
    PROGRAM_ID
  );
  const [shareMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("share_mint"), vaultConfigPda.toBuffer()],
    PROGRAM_ID
  );
  const [memberPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("member"), vaultConfigPda.toBuffer(), payer.publicKey.toBuffer()],
    PROGRAM_ID
  );

  console.log("\nDerived PDAs:");
  console.log("VaultConfig PDA:   ", vaultConfigPda.toBase58());
  console.log("Treasury PDA:      ", treasuryPda.toBase58());
  console.log("ShareMint PDA:     ", shareMintPda.toBase58());
  console.log("Member PDA:        ", memberPda.toBase58());

  const txSignatures: Record<string, string> = {};

  // =========================================================================
  // WEEK 8: Token Vault Skeleton, Member Card & Pause Controls
  // =========================================================================
  console.log("\n=======================================================");
  console.log(">>> WEEK 8: SKELETON, MEMBER CARD & PAUSE CONTROLS <<<");
  console.log("=======================================================");

  // 1.1 init_vault
  console.log("\n[Week 8.1] Initializing Token Vault...");
  const initVaultIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: assetMint, isSigner: false, isWritable: false },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: shareMintPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: anchorDiscriminator("init_vault"),
  });
  const initVaultTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(initVaultIx),
    [payer]
  );
  txSignatures.initVault = initVaultTx;
  console.log("Vault Initialized! Tx:", initVaultTx);

  // Associated token account for share mint (created on-chain after init_vault)
  const userShareAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    shareMintPda,
    payer.publicKey,
    true
  );
  console.log("User Share ATA created:", userShareAta.address.toBase58());

  // 1.2 toggle_pause (true)
  console.log("\n[Week 8.2] Testing toggle_pause (pausing vault)...");
  const pauseIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("toggle_pause"), Buffer.from([1])]),
  });
  const pauseTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(pauseIx),
    [payer]
  );
  txSignatures.togglePauseOn = pauseTx;
  console.log("Vault Paused! Tx:", pauseTx);

  // 1.3 toggle_pause (false)
  console.log("\n[Week 8.3] Testing toggle_pause (unpausing vault)...");
  const unpauseIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("toggle_pause"), Buffer.from([0])]),
  });
  const unpauseTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(unpauseIx),
    [payer]
  );
  txSignatures.togglePauseOff = unpauseTx;
  console.log("Vault Unpaused! Tx:", unpauseTx);

  // 1.4 register_member
  console.log("\n[Week 8.4] Registering Member Card...");
  const registerMemberIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: false },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: anchorDiscriminator("register_member"),
  });
  const registerMemberTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(registerMemberIx),
    [payer]
  );
  txSignatures.registerMember = registerMemberTx;
  console.log("Member Card Registered! Tx:", registerMemberTx);

  // 1.5 close_member (while empty) and re-register
  console.log("\n[Week 8.5] Testing close_member (closing empty card with rent refund)...");
  const closeMemberIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: vaultConfigPda, isSigner: false, isWritable: false },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
    ],
    data: anchorDiscriminator("close_member"),
  });
  const closeMemberTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(closeMemberIx),
    [payer]
  );
  txSignatures.closeMemberEmpty = closeMemberTx;
  console.log("Empty Member Card Closed! Tx:", closeMemberTx);

  // Re-register member for upcoming deposits
  console.log("\nRe-registering Member Card for deposit testing...");
  const reRegisterTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(registerMemberIx),
    [payer]
  );
  console.log("Member Card Re-registered! Tx:", reRegisterTx);

  // =========================================================================
  // WEEK 9: Asset Deposit & Share Token Minting via PDA
  // =========================================================================
  console.log("\n=======================================================");
  console.log(">>> WEEK 9: ASSET DEPOSIT & SHARE TOKEN MINTING <<<");
  console.log("=======================================================");

  // 2.1 First Deposit: 1,000,000 raw units (1.0 token)
  console.log("\n[Week 9.1] Making initial deposit of 1.0 asset tokens (1,000,000 units)...");
  const deposit1Amount = 1_000_000n;
  const deposit1Ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: shareMintPda, isSigner: false, isWritable: true },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: userAssetAta.address, isSigner: false, isWritable: true },
      { pubkey: userShareAta.address, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("deposit_assets"), u64ToLeBytes(deposit1Amount)]),
  });
  const deposit1Tx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(deposit1Ix),
    [payer]
  );
  txSignatures.firstDeposit = deposit1Tx;
  console.log("First Deposit Confirmed! Tx:", deposit1Tx);

  await sleep(1500);
  let treasuryAcc = await safeGetAccount(connection, treasuryPda);
  let userShareAcc = await safeGetAccount(connection, userShareAta.address);
  console.log("Treasury Balance:  ", treasuryAcc.amount.toString(), "units");
  console.log("User Share Balance:", userShareAcc.amount.toString(), "shares");
  assert.strictEqual(treasuryAcc.amount, 1_000_000n);
  assert.strictEqual(userShareAcc.amount, 1_000_000n);

  // 2.2 Second Deposit: 500,000 raw units (0.5 token)
  console.log("\n[Week 9.2] Making second deposit of 0.5 asset tokens (500,000 units)...");
  await sleep(1500);
  const deposit2Amount = 500_000n;
  const deposit2Ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: shareMintPda, isSigner: false, isWritable: true },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: userAssetAta.address, isSigner: false, isWritable: true },
      { pubkey: userShareAta.address, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("deposit_assets"), u64ToLeBytes(deposit2Amount)]),
  });
  const deposit2Tx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(deposit2Ix),
    [payer]
  );
  txSignatures.secondDeposit = deposit2Tx;
  console.log("Second Deposit Confirmed! Tx:", deposit2Tx);

  await sleep(1500);
  treasuryAcc = await safeGetAccount(connection, treasuryPda);
  userShareAcc = await safeGetAccount(connection, userShareAta.address);
  console.log("Treasury Balance:  ", treasuryAcc.amount.toString(), "units");
  console.log("User Share Balance:", userShareAcc.amount.toString(), "shares");
  assert.strictEqual(treasuryAcc.amount, 1_500_000n);
  assert.strictEqual(userShareAcc.amount, 1_500_000n);

  // =========================================================================
  // WEEK 10: CPI Withdrawal with Share Burning & PDA Transfer
  // =========================================================================
  console.log("\n=======================================================");
  console.log(">>> WEEK 10: CPI WITHDRAWAL WITH SHARE BURNING <<<");
  console.log("=======================================================");

  // 3.1 Partial Withdrawal: 500,000 shares
  console.log("\n[Week 10.1] Executing partial withdrawal (burning 500,000 shares)...");
  await sleep(1500);
  const withdraw1Shares = 500_000n;
  const withdraw1Ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: shareMintPda, isSigner: false, isWritable: true },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: userAssetAta.address, isSigner: false, isWritable: true },
      { pubkey: userShareAta.address, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("withdraw_assets"), u64ToLeBytes(withdraw1Shares)]),
  });
  const withdraw1Tx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(withdraw1Ix),
    [payer]
  );
  txSignatures.partialWithdrawal = withdraw1Tx;
  console.log("Partial Withdrawal Confirmed! Tx:", withdraw1Tx);

  await sleep(1500);
  treasuryAcc = await safeGetAccount(connection, treasuryPda);
  userShareAcc = await safeGetAccount(connection, userShareAta.address);
  console.log("Remaining Treasury Balance:  ", treasuryAcc.amount.toString(), "units");
  console.log("Remaining User Share Balance:", userShareAcc.amount.toString(), "shares");
  assert.strictEqual(treasuryAcc.amount, 1_000_000n);
  assert.strictEqual(userShareAcc.amount, 1_000_000n);

  // 3.2 Full Withdrawal: remaining 1,000,000 shares
  console.log("\n[Week 10.2] Executing full withdrawal (burning remaining 1,000,000 shares)...");
  await sleep(1500);
  const withdraw2Shares = 1_000_000n;
  const withdraw2Ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: vaultConfigPda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: shareMintPda, isSigner: false, isWritable: true },
      { pubkey: memberPda, isSigner: false, isWritable: true },
      { pubkey: userAssetAta.address, isSigner: false, isWritable: true },
      { pubkey: userShareAta.address, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([anchorDiscriminator("withdraw_assets"), u64ToLeBytes(withdraw2Shares)]),
  });
  const withdraw2Tx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(withdraw2Ix),
    [payer]
  );
  txSignatures.fullWithdrawal = withdraw2Tx;
  console.log("Full Withdrawal Confirmed! Tx:", withdraw2Tx);

  await sleep(2000);
  treasuryAcc = await safeGetAccount(connection, treasuryPda);
  userShareAcc = await safeGetAccount(connection, userShareAta.address);
  console.log("Final Treasury Balance:  ", treasuryAcc.amount.toString(), "units");
  console.log("Final User Share Balance:", userShareAcc.amount.toString(), "shares");
  assert.strictEqual(treasuryAcc.amount, 0n);
  assert.strictEqual(userShareAcc.amount, 0n);

  // 3.3 Close Member Card after full withdrawal
  console.log("\n[Week 10.3] Closing member card after 100% withdrawal...");
  await sleep(1500);
  const closeFinalTx = await sendAndConfirmTransaction(
    connection,
    new Transaction().add(closeMemberIx),
    [payer]
  );
  txSignatures.closeMemberFinal = closeFinalTx;
  console.log("Member Card Closed & Rent Refunded! Tx:", closeFinalTx);

  console.log("\n=======================================================");
  console.log(">>> ALL INTEGRATION TESTS PASSED SUCCESSFULLY! <<<");
  console.log("=======================================================");
  console.log("\nConfirmed Devnet Signatures:");
  for (const [key, sig] of Object.entries(txSignatures)) {
    console.log(`- ${key}: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }

  // Save results to file for README update
  fs.writeFileSync(
    "token_vault_devnet_results.json",
    JSON.stringify(
      {
        programId: PROGRAM_ID.toBase58(),
        assetMint: assetMint.toBase58(),
        vaultConfigPda: vaultConfigPda.toBase58(),
        treasuryPda: treasuryPda.toBase58(),
        shareMintPda: shareMintPda.toBase58(),
        memberPda: memberPda.toBase58(),
        txs: txSignatures,
      },
      null,
      2
    )
  );
  console.log("\nResults saved to token_vault_devnet_results.json");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
