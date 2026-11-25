import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

export function deriveVaultPda(
  authority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), authority.toBuffer()],
    programId
  );
}

export function deriveUserCardPda(
  vault: PublicKey,
  user: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("user_card"), vault.toBuffer(), user.toBuffer()],
    programId
  );
}

export function deriveVaultTreasury(vaultPda: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, vaultPda, true);
}

export function deriveAta(user: PublicKey, mint: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mint, user, false);
}

export function deriveSwapRoutePda(
  vault: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("swap_route"), vault.toBuffer()],
    programId
  );
}

export function deriveQuoteTreasuryPda(
  vault: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("quote_treasury"), vault.toBuffer()],
    programId
  );
}
