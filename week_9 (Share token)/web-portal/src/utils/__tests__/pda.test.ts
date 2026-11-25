import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import {
  deriveVaultPda,
  deriveUserCardPda,
  deriveVaultTreasury,
  deriveAta,
  deriveSwapRoutePda,
  deriveQuoteTreasuryPda,
} from "../pda";

describe("PDA derivation utils", () => {
  const authority = new PublicKey("F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM");
  const programId = new PublicKey("CnBm8DNdWJ5WfTj92czXWm9PHad8fseYeWgBZ3535qkP");
  const baseMint = new PublicKey("6frqPxC5jtzSk1P3eS6xqFvTq6yY5b2ujDwtw5w2g6A1");
  const user = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");

  it("1. deriveVaultPda matches expected seeds [b'vault', authority]", () => {
    const [vaultPda, bump] = deriveVaultPda(authority, programId);
    expect(vaultPda).toBeInstanceOf(PublicKey);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
    expect(vaultPda.toBase58()).toBe("7Bc2iVWad9gdcsa6KwMYH2gj4VK5KhNbnDwCzX4BCWDR");
  });

  it("2. deriveUserCardPda derives deterministic PDA for user", () => {
    const [vaultPda] = deriveVaultPda(authority, programId);
    const [card1, bump1] = deriveUserCardPda(vaultPda, user, programId);
    const [card2, bump2] = deriveUserCardPda(vaultPda, user, programId);
    expect(card1.toBase58()).toBe(card2.toBase58());
    expect(bump1).toBe(bump2);
  });

  it("3. deriveVaultTreasury derives correct ATA for Vault PDA", () => {
    const [vaultPda] = deriveVaultPda(authority, programId);
    const treasury = deriveVaultTreasury(vaultPda, baseMint);
    expect(treasury.toBase58()).toBe("G94UboyVwtgYUEa6t3PW65D4X3z5y68v5Sdo3cFaEzZm");
  });

  it("4. deriveAta derives correct associated token account for user", () => {
    const ata = deriveAta(user, baseMint);
    expect(ata).toBeInstanceOf(PublicKey);
    expect(ata.toBase58()).toBe("FfLfYPLJdkUpRxcYDfi3rpcvwQtW7vK4F28CdCBUkTbZ");
  });

  it("5. deriveSwapRoutePda matches seeds [b'swap_route', vault]", () => {
    const [vaultPda] = deriveVaultPda(authority, programId);
    const [swapRoutePda] = deriveSwapRoutePda(vaultPda, programId);
    expect(swapRoutePda.toBase58()).toBe("6qAb2MhgrY9cSFSMki36bz3vAYWs4pNMToBdJwAxBBFW");
  });

  it("6. deriveQuoteTreasuryPda matches seeds [b'quote_treasury', vault]", () => {
    const [vaultPda] = deriveVaultPda(authority, programId);
    const [quoteTreasuryPda] = deriveQuoteTreasuryPda(vaultPda, programId);
    expect(quoteTreasuryPda.toBase58()).toBe("Dk1Xwbmq7gDArxtrC6NPjqRYqbaFMLFUPaMSx4gfuMrK");
  });
});
