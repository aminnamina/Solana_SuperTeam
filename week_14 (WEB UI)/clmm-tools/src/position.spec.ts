import test, { describe, it } from "node:test";
import assert from "node:assert";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { createContext } from "./config.js";
import { loadState } from "./store.js";
import {
  getProgram,
  deriveVaultPdas,
  getVaultBalances,
  RAYDIUM_CLMM_PROGRAM_ID,
  MEMO_PROGRAM_ID,
} from "./vault-adapter.js";
import {
  openVaultPosition,
  harvestVaultFees,
  closeVaultPosition,
  rebalanceVaultPosition,
  externalTrade,
  derivePositionAccounts,
} from "./position-manager.js";

describe("Raydium CLMM CPI Vault Position Management Tests (Solana Devnet)", () => {
  it("1. Успешный минт позиции от Vault PDA (проверка владельца NFT и ликвидности)", async () => {
    const { connection, owner } = await createContext();
    const state = loadState();
    assert.ok(state.pool, "Pool must be configured in state");

    const { vaultPda } = deriveVaultPdas(owner.publicKey);

    // If an existing position is open, close it first for a clean state
    if (state.position) {
      try {
        await closeVaultPosition();
      } catch (e) {
        console.log("Cleanup previous position:", e);
      }
    }

    const openRes = await openVaultPosition({
      rangePct: 7,
      amountUi: 50,
      slippageBps: 100,
    });

    assert.ok(openRes.txId, "TxId must be returned");
    assert.ok(openRes.nftMint, "NFT mint must be generated");
    assert.ok(BigInt(openRes.liquidity) > 0n, "Position liquidity must be > 0");

    // Verify position NFT account exists and is owned by vault PDA
    const nftMintPk = new PublicKey(openRes.nftMint);
    const nftAta = getAssociatedTokenAddressSync(
      nftMintPk,
      vaultPda,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    const nftAcc = await getAccount(connection, nftAta, "confirmed", TOKEN_2022_PROGRAM_ID);

    assert.strictEqual(
      nftAcc.owner.toBase58(),
      vaultPda.toBase58(),
      "Position NFT account owner must be vault PDA"
    );
    assert.strictEqual(
      nftAcc.amount.toString(),
      "1",
      "Position NFT account must hold exactly 1 NFT"
    );

    // Verify personal position account exists
    const clmmProgram = new PublicKey(state.pool.programId);
    const pdas = derivePositionAccounts({
      clmmProgram,
      poolId: new PublicKey(state.pool.id),
      nftMint: nftMintPk,
      vaultPda,
      tickLower: openRes.tickLower,
      tickUpper: openRes.tickUpper,
      startLower: 0,
      startUpper: 0,
    });

    const personalPosInfo = await connection.getAccountInfo(pdas.personalPosition);
    assert.ok(personalPosInfo, "personalPosition account must exist on-chain");
    assert.strictEqual(
      personalPosInfo.owner.toBase58(),
      clmmProgram.toBase58(),
      "personalPosition must be owned by Raydium CLMM program"
    );
  });

  it("2. Защита от сторонних пользователей (ConstraintHasOne / ConstraintSeeds 2001/2006)", async () => {
    const { connection, owner } = await createContext();
    const nonAdmin = Keypair.generate();

    // Fund non-admin with 0.005 SOL for transaction fees
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: nonAdmin.publicKey,
        lamports: 5_000_000,
      })
    );
    await sendAndConfirmTransaction(connection, fundTx, [owner]);

    let threwNonAdmin = false;
    let nonAdminErrMsg = "";
    try {
      await harvestVaultFees({ customSigner: nonAdmin });
    } catch (err: any) {
      threwNonAdmin = true;
      nonAdminErrMsg = err.message ?? String(err);
    }

    assert.ok(threwNonAdmin, "Harvest fees from non-admin must be rejected");
    assert.ok(
      nonAdminErrMsg.includes("ConstraintSeeds") ||
        nonAdminErrMsg.includes("2006") ||
        nonAdminErrMsg.includes("ConstraintHasOne") ||
        nonAdminErrMsg.includes("2001") ||
        nonAdminErrMsg.includes("has_one") ||
        nonAdminErrMsg.includes("seeds") ||
        nonAdminErrMsg.includes("custom program error"),
      `Expected authority/seeds constraint error, got: ${nonAdminErrMsg}`
    );
  });

  it("3. Защита от невалидного диапазона тиков (InvalidTickRange 6007)", async () => {
    const { connection, owner } = await createContext();
    const state = loadState();
    const { program } = getProgram(connection, owner);
    const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

    const baseMintPk = new PublicKey(state.tokens.baseMint!);
    const poolPk = new PublicKey(state.pool!.id);
    const clmmProgram = new PublicKey(state.pool!.programId);
    const baseTreasury = getAssociatedTokenAddressSync(baseMintPk, vaultPda, true);

    const positionNftMint = Keypair.generate();
    const pdas = derivePositionAccounts({
      clmmProgram,
      poolId: poolPk,
      nftMint: positionNftMint.publicKey,
      vaultPda,
      tickLower: 1000,
      tickUpper: 1000,
      startLower: 0,
      startUpper: 0,
    });

    const invalidParams = {
      tickLowerIndex: 1000,
      tickUpperIndex: 1000, // Invalid: lower >= upper
      tickArrayLowerStartIndex: 0,
      tickArrayUpperStartIndex: 0,
      liquidity: new BN(0),
      amount0Max: new BN(0),
      amount1Max: new BN(0),
      withMetadata: false,
      baseFlag: null,
    };

    let threwInvalid = false;
    let invalidErrMsg = "";
    try {
      await program.methods
        .mintVaultPosition(invalidParams)
        .accounts({
          authority: owner.publicKey,
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
          tokenVault0: new PublicKey(state.pool!.vaultA),
          tokenVault1: new PublicKey(state.pool!.vaultB),
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          vaultMint0: state.pool!.mintA,
          vaultMint1: state.pool!.mintB,
          raydiumProgram: clmmProgram,
        })
        .signers([positionNftMint])
        .rpc();
    } catch (err: any) {
      threwInvalid = true;
      invalidErrMsg = err.message ?? String(err);
    }

    assert.ok(threwInvalid, "mint_vault_position with lower >= upper must be rejected");
    assert.ok(
      invalidErrMsg.includes("InvalidTickRange") || invalidErrMsg.includes("6007"),
      `Expected InvalidTickRange (6007), got: ${invalidErrMsg}`
    );
  });

  it("4. Сбор накопленных комиссий в хранилища Vault (harvest_position_fees)", async () => {
    // Generate trades in the pool to accumulate trading fees
    console.log("Выполнение внешних трейдов для генерации комиссий...");
    try {
      await externalTrade({ side: "buy", amountUi: 10 });
      await externalTrade({ side: "sell", amountUi: 10 });
    } catch (e) {
      console.warn("External trades in test 4:", e);
    }

    const balBefore = await getVaultBalances();
    const harvestRes = await harvestVaultFees();

    assert.ok(harvestRes.txId, "Harvest fees transaction must succeed");

    const balAfter = await getVaultBalances();
    assert.ok(
      balAfter.base >= balBefore.base && balAfter.quote >= balBefore.quote,
      "Vault treasury balances must not decrease after harvesting fees"
    );
  });

  it("5. Закрытие позиции и ребалансировка (вывод ликвидности, сжигание NFT)", async () => {
    const { connection, owner } = await createContext();
    const state = loadState();
    assert.ok(state.position, "Position must exist in state");

    const nftMintPk = new PublicKey(state.position.nftMint);
    const clmmProgram = new PublicKey(state.pool!.programId);
    const { vaultPda } = deriveVaultPdas(owner.publicKey);
    const pdas = derivePositionAccounts({
      clmmProgram,
      poolId: new PublicKey(state.pool!.id),
      nftMint: nftMintPk,
      vaultPda,
      tickLower: state.position.tickLower,
      tickUpper: state.position.tickUpper,
      startLower: 0,
      startUpper: 0,
    });

    // Close position
    const closeRes = await closeVaultPosition();
    assert.ok(closeRes.txId, "Close position txId must be returned");

    // Check personalPosition account is deleted/closed
    const posInfo = await connection.getAccountInfo(pdas.personalPosition);
    assert.strictEqual(posInfo, null, "personalPosition account must be closed");

    // Check rebalance opens a new active position
    const rebalanceRes = await rebalanceVaultPosition({
      rangePct: 7,
      amountUi: 50,
      slippageBps: 100,
    });
    assert.ok(rebalanceRes.openTxId, "Rebalance must open a new position");
    assert.notStrictEqual(
      rebalanceRes.newNftMint,
      nftMintPk.toBase58(),
      "Rebalanced position must have a fresh NFT mint"
    );
  });
});
