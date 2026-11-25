import test, { describe, it } from "node:test";
import assert from "node:assert";
import { Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { PoolUtils } from "@raydium-io/raydium-sdk-v2";
import { createContext } from "./config.js";
import { loadState } from "./store.js";
import {
  getProgram,
  deriveVaultPdas,
  getVaultBalances,
  runVaultSwap,
} from "./vault-adapter.js";

describe("Raydium CLMM CPI Vault Swap Integration Tests (Solana Devnet)", () => {
  it("1. Проверка аккаунта SwapRoute (соответствие пула, vault и quote_treasury)", async () => {
    const { connection, owner } = await createContext();
    const state = loadState();
    assert.ok(state.pool, "Pool must be configured in state");
    assert.ok(state.vault, "Vault must be configured in state");

    const { program } = getProgram(connection, owner);
    const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);

    const swapRouteAcc: any = await program.account.swapRoute.fetch(swapRoutePda);

    assert.strictEqual(
      swapRouteAcc.vault.toBase58(),
      vaultPda.toBase58(),
      "Vault PDA must match"
    );
    assert.strictEqual(
      swapRouteAcc.poolState.toBase58(),
      state.pool.id,
      "Pool ID must match configured pool"
    );
    assert.strictEqual(
      swapRouteAcc.quoteTreasury.toBase58(),
      quoteTreasuryPda.toBase58(),
      "Quote treasury PDA must match"
    );
    assert.strictEqual(
      swapRouteAcc.quoteMint.toBase58(),
      state.tokens.quoteMint,
      "Quote mint must match"
    );
  });

  it("2. Успешный своп BaseToQuote с проверкой изменения балансов vault", async () => {
    const state = loadState();
    const balBefore = await getVaultBalances();
    assert.ok(balBefore.base >= 10, "Vault must have at least 10 Base tokens");

    const swapAmount = 10;
    const res = await runVaultSwap({
      direction: "base-to-quote",
      amountUi: swapAmount,
      slippageBps: 100,
    });

    assert.ok(res.txId, "Swap transaction ID must be returned");

    const balAfter = await getVaultBalances();
    assert.strictEqual(
      Math.round((balBefore.base - balAfter.base) * 100) / 100,
      swapAmount,
      "Base balance must decrease by swap amount"
    );
    assert.ok(
      balAfter.quote > balBefore.quote,
      "Quote balance must increase after BaseToQuote swap"
    );
  });

  it("3. Успешный обратный своп QuoteToBase с проверкой изменения балансов vault", async () => {
    const balBefore = await getVaultBalances();
    assert.ok(balBefore.quote >= 15, "Vault must have at least 15 Quote tokens");

    const swapAmount = 15;
    const res = await runVaultSwap({
      direction: "quote-to-base",
      amountUi: swapAmount,
      slippageBps: 100,
    });

    assert.ok(res.txId, "Reverse swap transaction ID must be returned");

    const balAfter = await getVaultBalances();
    assert.ok(
      balAfter.quote < balBefore.quote,
      "Quote balance must decrease after QuoteToBase swap"
    );
    assert.ok(
      balAfter.base > balBefore.base,
      "Base balance must increase after QuoteToBase swap"
    );
  });

  it("4. Отклонение транзакции при завышенном min_amount_out (ошибка TooLittleOutputReceived / 6018)", async () => {
    const { connection, raydium } = await createContext();
    const state = loadState();
    assert.ok(state.pool, "Pool must be configured in state");

    const balBefore = await getVaultBalances();

    // Compute expected output for 10 units and inflate min_amount_out by 1.8x
    const res = await raydium.clmm.getPoolInfoFromRpc(state.pool.id);
    const tokenOut =
      res.computePoolInfo.mintA.address === state.tokens.quoteMint
        ? res.computePoolInfo.mintA
        : res.computePoolInfo.mintB;
    const epochInfo = await connection.getEpochInfo();
    const quote = PoolUtils.computeAmountOutFormat({
      poolInfo: res.computePoolInfo,
      tickArrayCache: res.tickData[state.pool.id],
      amountIn: new BN(10 * 10 ** state.tokens.decimals),
      tokenOut,
      slippage: 0.01,
      epochInfo,
    });

    const inflatedMinOut = quote.amountOut.amount.raw.mul(new BN(180)).div(new BN(100));

    let threw = false;
    let errorMsg = "";
    try {
      await runVaultSwap({
        direction: "base-to-quote",
        amountUi: 10,
        overrideMinOut: inflatedMinOut,
      });
    } catch (err: any) {
      threw = true;
      errorMsg = err.message ?? String(err);
    }

    assert.ok(threw, "Transaction must fail when min_amount_out is inflated");
    assert.ok(
      errorMsg.includes("TooLittleOutputReceived") ||
        errorMsg.includes("6018") ||
        errorMsg.includes("0x1782") ||
        errorMsg.includes("SlippageExceeded"),
      `Expected slippage protection error, received: ${errorMsg}`
    );

    const balAfter = await getVaultBalances();
    assert.strictEqual(
      balAfter.base,
      balBefore.base,
      "Vault Base balance must not change on rejected transaction"
    );
    assert.strictEqual(
      balAfter.quote,
      balBefore.quote,
      "Vault Quote balance must not change on rejected transaction"
    );
  });

  it("5. Отклонение попытки свопа с нулевой суммой (ончейн-ошибка ZeroSwapAmount / 6003)", async () => {
    const { connection, owner } = await createContext();
    const state = loadState();
    assert.ok(state.pool, "Pool must be configured in state");

    const { program } = getProgram(connection, owner);
    const { vaultPda, swapRoutePda, quoteTreasuryPda } = deriveVaultPdas(owner.publicKey);
    const { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");
    const { RAYDIUM_CLMM_PROGRAM_ID, MEMO_PROGRAM_ID } = await import("./vault-adapter.js");

    const baseTreasury = getAssociatedTokenAddressSync(new PublicKey(state.tokens.baseMint!), vaultPda, true);

    let threwZero = false;
    let zeroErrMsg = "";
    try {
      await program.methods
        .executeClmmSwap({
          direction: { baseToQuote: {} },
          amountIn: new BN(0),
          minAmountOut: new BN(0),
        })
        .accounts({
          authority: owner.publicKey,
          vault: vaultPda,
          swapRoute: swapRoutePda,
          poolState: new PublicKey(state.pool.id),
          ammConfig: new PublicKey(state.pool.ammConfigId),
          baseTreasury,
          quoteTreasury: quoteTreasuryPda,
          poolVaultA: new PublicKey(state.pool.vaultA),
          poolVaultB: new PublicKey(state.pool.vaultB),
          observationState: new PublicKey(state.pool.observationId),
          baseMint: new PublicKey(state.tokens.baseMint!),
          quoteMint: new PublicKey(state.tokens.quoteMint!),
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenProgram2022: TOKEN_2022_PROGRAM_ID,
          memoProgram: MEMO_PROGRAM_ID,
          raydiumProgram: RAYDIUM_CLMM_PROGRAM_ID,
        })
        .rpc();
    } catch (err: any) {
      threwZero = true;
      zeroErrMsg = err.message ?? String(err);
    }
    assert.ok(threwZero, "Swap with 0 amount must be rejected");
    assert.ok(
      zeroErrMsg.includes("ZeroSwapAmount") || zeroErrMsg.includes("6003"),
      `Expected ZeroSwapAmount (6003), got: ${zeroErrMsg}`
    );
  });

  it("6. Отклонение попытки свопа от не-админа (ConstraintHasOne / 2001)", async () => {
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
      await runVaultSwap({
        direction: "base-to-quote",
        amountUi: 1,
        customSigner: nonAdmin,
      });
    } catch (err: any) {
      threwNonAdmin = true;
      nonAdminErrMsg = err.message ?? String(err);
    }
    assert.ok(threwNonAdmin, "Swap from non-admin signer must be rejected");
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
});
