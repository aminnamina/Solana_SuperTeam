import { describe, it, expect } from "vitest";
import {
  getShareRate,
  previewDeposit,
  previewWithdraw,
  evaluateUserPosition,
} from "../math";

describe("Vault Math & Share Calculations (bigint precision)", () => {
  it("1. getShareRate returns 1.0 for initial empty vault", () => {
    expect(getShareRate(0n, 0n)).toBe(1.0);
    expect(getShareRate(100_000_000n, 0n)).toBe(1.0);
  });

  it("2. getShareRate returns 1.0 when assets == shares", () => {
    const assets = 1_000_000_000n; // 1,000 tokens
    const shares = 1_000_000_000n; // 1,000 shares
    expect(getShareRate(assets, shares)).toBe(1.0);
  });

  it("3. getShareRate reflects price appreciation (NAV growth)", () => {
    const assets = 2_000_000_000n; // 2,000 tokens (yield accumulated)
    const shares = 1_000_000_000n; // 1,000 shares
    expect(getShareRate(assets, shares)).toBe(2.0);
  });

  it("4. previewDeposit calculates 1:1 on first deposit", () => {
    const depositAmount = 500_000_000n; // 500 tokens
    const shares = previewDeposit(depositAmount, 0n, 0n);
    expect(shares).toBe(depositAmount);
  });

  it("5. previewDeposit scales down shares when share rate is higher", () => {
    const totalAssets = 2_000_000_000n; // 2,000 tokens
    const totalShares = 1_000_000_000n; // 1,000 shares (1 share = 2 tokens)
    const depositAmount = 200_000_000n; // deposit 200 tokens

    // Expected: 200 * 1000 / 2000 = 100 shares
    const shares = previewDeposit(depositAmount, totalAssets, totalShares);
    expect(shares).toBe(100_000_000n);
  });

  it("6. previewDeposit returns 0 for 0 deposit", () => {
    expect(previewDeposit(0n, 100_000n, 100_000n)).toBe(0n);
  });

  it("7. previewWithdraw returns proportional assets", () => {
    const totalAssets = 2_000_000_000n; // 2,000 tokens
    const totalShares = 1_000_000_000n; // 1,000 shares (1 share = 2 tokens)
    const sharesToWithdraw = 100_000_000n; // withdraw 100 shares

    // Expected: 100 * 2000 / 1000 = 200 tokens
    const assets = previewWithdraw(sharesToWithdraw, totalAssets, totalShares);
    expect(assets).toBe(200_000_000n);
  });

  it("8. previewWithdraw caps at totalAssets and handles 0 shares", () => {
    expect(previewWithdraw(0n, 1_000n, 1_000n)).toBe(0n);
    expect(previewWithdraw(100n, 1_000n, 0n)).toBe(0n);
  });

  it("9. evaluateUserPosition returns correct valuation of shares in base token", () => {
    const userShares = 250_000_000n; // 250 shares
    const totalAssets = 1_500_000_000n; // 1,500 tokens
    const totalShares = 1_000_000_000n; // 1,000 shares (rate = 1.5)

    // Expected: 250 * 1.5 = 375 tokens
    const valuation = evaluateUserPosition(userShares, totalAssets, totalShares);
    expect(valuation).toBe(375_000_000n);
  });
});
