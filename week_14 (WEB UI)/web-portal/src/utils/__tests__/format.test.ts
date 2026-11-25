import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  shortenAddress,
  formatUnits,
  parseUnits,
  formatError,
} from "../format";

describe("Formatting, Parsing & Error Mapping", () => {
  describe("shortenAddress", () => {
    it("1. truncates base58 address with ellipsis", () => {
      const addr = "CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP";
      expect(shortenAddress(addr, 4)).toBe("CnBm...5qkP");
    });

    it("2. handles PublicKey instances", () => {
      const pk = new PublicKey("11111111111111111111111111111111");
      expect(shortenAddress(pk, 3)).toBe("111...111");
    });

    it("3. handles null and undefined safely", () => {
      expect(shortenAddress(null)).toBe("");
      expect(shortenAddress(undefined)).toBe("");
    });
  });

  describe("formatUnits", () => {
    it("4. formats whole units with 6 decimals", () => {
      expect(formatUnits(1_000_000n, 6)).toBe("1");
      expect(formatUnits(150_000_000n, 6)).toBe("150");
    });

    it("5. formats fractional amounts without trailing zeros", () => {
      expect(formatUnits(1_500_000n, 6)).toBe("1.5");
      expect(formatUnits(1_250_000n, 6)).toBe("1.25");
      expect(formatUnits(1_123_456n, 6, 2)).toBe("1.12");
    });

    it("6. formats 0 correctly", () => {
      expect(formatUnits(0n, 6)).toBe("0");
    });
  });

  describe("parseUnits", () => {
    it("7. parses integer strings into raw bigint", () => {
      expect(parseUnits("100", 6)).toBe(100_000_000n);
      expect(parseUnits("1", 6)).toBe(1_000_000n);
    });

    it("8. parses dot and comma decimal separators", () => {
      expect(parseUnits("1.5", 6)).toBe(1_500_000n);
      expect(parseUnits("2,75", 6)).toBe(2_750_000n);
    });

    it("9. handles edge cases (empty, non-numeric, 0)", () => {
      expect(parseUnits("", 6)).toBe(0n);
      expect(parseUnits("   ", 6)).toBe(0n);
      expect(parseUnits("abc", 6)).toBe(0n);
      expect(parseUnits("-10", 6)).toBe(0n);
      expect(parseUnits("0", 6)).toBe(0n);
    });

    it("10. truncates excessive decimals without throwing", () => {
      // 8 decimals passed for 6 decimals mint
      expect(parseUnits("1.12345678", 6)).toBe(1_123456n);
    });
  });

  describe("formatError", () => {
    it("11. maps wallet rejection to clear Russian message", () => {
      const err = new Error("User rejected the request.");
      expect(formatError(err)).toContain("Транзакция отклонена пользователем");
    });

    it("12. maps Anchor custom errors (6000-6008)", () => {
      expect(formatError(new Error("Error: 6000 InsufficientFunds"))).toContain(
        "Недостаточно средств в хранилище"
      );
      expect(formatError(new Error("custom program error: 0x1774"))).toContain( // 6004
        "Превышен лимит проскальзывания"
      );
      expect(formatError(new Error("InvalidTreasuryAccount"))).toContain(
        "не принадлежит казначейству Vault"
      );
      expect(formatError(new Error("InvalidTickRange"))).toContain(
        "Невалидный ценовой диапазон"
      );
    });

    it("13. maps ConstraintHasOne (2001) / ConstraintSeeds (2006)", () => {
      expect(formatError(new Error("AnchorError: ConstraintHasOne (2001)"))).toContain(
        "Ошибка доступа: действие доступно только администратору"
      );
      expect(formatError(new Error("ConstraintSeeds"))).toContain(
        "Некорректные seeds"
      );
    });

    it("14. maps Raydium slippage error (6018)", () => {
      expect(formatError(new Error("TooLittleOutputReceived (0x1782)"))).toContain(
        "защита от проскальзывания пула"
      );
    });

    it("15. maps insufficient lamports", () => {
      expect(formatError(new Error("Attempt to debit an account but found no record of a prior credit. insufficient lamports"))).toContain(
        "Недостаточно SOL"
      );
    });
  });
});
