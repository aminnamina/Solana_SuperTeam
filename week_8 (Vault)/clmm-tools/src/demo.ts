import fs from "node:fs";
import path from "node:path";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createContext } from "./config.js";
import { loadState, saveState } from "./store.js";
import { getProgram, deriveVaultPdas } from "./vault-adapter.js";
import { SECURITY_VAULT_IDL, SECURITY_VAULT_PROGRAM_ID } from "./idl.js";

export async function handleDemoInit() {
  const { connection, owner } = await createContext();
  const state = loadState();

  console.log("=== [Demo Init] Инициализация демо-состояния для Web Portal ===");

  if (!state.tokens.baseMint) {
    throw new Error("Base mint not found in state. Run npm run mint first.");
  }

  const { program } = getProgram(connection, owner);
  const { vaultPda, quoteTreasuryPda, swapRoutePda } = deriveVaultPdas(owner.publicKey);
  const baseMintPk = new PublicKey(state.tokens.baseMint);

  // 1. Проверка инициализации Vault PDA
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (!vaultInfo) {
    console.log("Vault PDA не найден на Devnet. Создание Vault...");
    const initTx = await program.methods
      .initializeVault()
      .accounts({
        authority: owner.publicKey,
        vault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Vault инициализирован! Tx:", initTx);
  } else {
    console.log("Vault PDA уже существует:", vaultPda.toBase58());
  }

  // 2. Проверка казначейства базового токена (vaultTokenAccount)
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
    const { Transaction, sendAndConfirmTransaction } = await import("@solana/web3.js");
    const tx = new Transaction().add(createAtaIx);
    await sendAndConfirmTransaction(connection, tx, [owner]);
  } else {
    console.log("Base Treasury ATA существует:", baseTreasury.toBase58());
  }

  // 3. Проверка или создание shareMint
  let shareMintPk: PublicKey;
  if (state.tokens.shareMint) {
    shareMintPk = new PublicKey(state.tokens.shareMint);
    console.log("Share Mint уже существует:", shareMintPk.toBase58());
  } else {
    console.log("Создание нового Share Mint для Vault Shares...");
    shareMintPk = await createMint(
      connection,
      owner,
      owner.publicKey,
      null,
      state.tokens.decimals
    );
    state.tokens.shareMint = shareMintPk.toBase58();
    saveState(state);
    console.log("Создан Share Mint:", shareMintPk.toBase58());
  }

  // 4. Обновление состояния vault в devnet-state.json
  state.vault = {
    programId: SECURITY_VAULT_PROGRAM_ID,
    vaultPda: vaultPda.toBase58(),
    baseTreasury: baseTreasury.toBase58(),
    swapRoute: swapRoutePda.toBase58(),
    quoteTreasury: quoteTreasuryPda.toBase58(),
  };
  saveState(state);

  // 5. Создание папки web-portal/src/generated и экспорт network.json + idl.json
  const generatedDir = path.resolve(process.cwd(), "..", "web-portal", "src", "generated");
  fs.mkdirSync(generatedDir, { recursive: true });

  const networkConfig = {
    network: "devnet",
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    programId: SECURITY_VAULT_PROGRAM_ID,
    vaultPda: vaultPda.toBase58(),
    baseMint: state.tokens.baseMint,
    shareMint: state.tokens.shareMint,
    vaultTokenAccount: baseTreasury.toBase58(),
    quoteMint: state.tokens.quoteMint,
    poolId: state.pool?.id,
    decimals: state.tokens.decimals,
  };

  const networkPath = path.join(generatedDir, "network.json");
  fs.writeFileSync(networkPath, JSON.stringify(networkConfig, null, 2), "utf-8");
  console.log("Конфиг сети сгенерирован:", networkPath);

  // Копирование IDL
  const idlPath = path.join(generatedDir, "idl.json");
  const targetIdlPath = path.resolve(process.cwd(), "..", "target", "idl", "security_vault.json");
  if (fs.existsSync(targetIdlPath)) {
    fs.copyFileSync(targetIdlPath, idlPath);
  } else {
    fs.writeFileSync(idlPath, JSON.stringify(SECURITY_VAULT_IDL, null, 2), "utf-8");
  }
  console.log("IDL скопирован в web-portal:", idlPath);

  console.log("\n--- Сводка адресов для Web Portal ---");
  console.table({
    "Program ID": networkConfig.programId,
    "Vault PDA": networkConfig.vaultPda,
    "Base Mint": networkConfig.baseMint,
    "Share Mint": networkConfig.shareMint,
    "Vault Token Account": networkConfig.vaultTokenAccount,
    Decimals: networkConfig.decimals,
  });

  return networkConfig;
}

export async function handleDemoFaucet(recipientArg?: string, amountArg = 500) {
  if (!recipientArg) {
    console.error("Использование: npm run demo:faucet -- <WALLET_PUBKEY> [AMOUNT]");
    process.exit(1);
  }

  const { connection, owner } = await createContext();
  const state = loadState();

  if (!state.tokens.baseMint) {
    throw new Error("Base mint not found in state");
  }

  let recipientPk: PublicKey;
  try {
    recipientPk = new PublicKey(recipientArg);
  } catch {
    throw new Error(`Некорректный публичный адрес: ${recipientArg}`);
  }

  const baseMintPk = new PublicKey(state.tokens.baseMint);
  const decimals = state.tokens.decimals;
  const rawAmount = BigInt(Math.round(amountArg * 10 ** decimals));

  console.log(`=== [Faucet] Минт ${amountArg} базовых токенов для ${recipientPk.toBase58()} ===`);

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    owner,
    baseMintPk,
    recipientPk
  );

  console.log("Получатель ATA:", recipientAta.address.toBase58());

  const txId = await mintTo(
    connection,
    owner,
    baseMintPk,
    recipientAta.address,
    owner,
    rawAmount
  );

  console.log(`Минт успешен! Начислено: ${amountArg} токенов.`);
  console.log(`Explorer: https://explorer.solana.com/tx/${txId}?cluster=devnet`);

  return { txId, recipientAta: recipientAta.address.toBase58(), amount: amountArg };
}
