import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getMint } from "@solana/spl-token";
import networkConfig from "../generated/network.json";
import { deriveVaultPda, deriveVaultTreasury, deriveAta, deriveUserCardPda } from "../utils/pda";
import { getShareRate, evaluateUserPosition } from "../utils/math";

export interface VaultMetrics {
  tvl: bigint;
  totalShares: bigint;
  shareRate: number;
  status: "active" | "in_market" | "paused";
  statusText: string;
  vaultPda: string;
  baseMint: string;
  shareMint: string;
  vaultTokenAccount: string;
  decimals: number;
}

export interface UserVaultData {
  connected: boolean;
  walletAddress: string;
  solBalanceLamports: bigint;
  baseTokenBalance: bigint;
  sharesBalance: bigint;
  estimatedBaseValue: bigint;
  hasUserCard: boolean;
}

export function useVaultData(
  connection: Connection,
  walletPublicKey: PublicKey | null
) {
  const [metrics, setMetrics] = useState<VaultMetrics>({
    tvl: 0n,
    totalShares: 0n,
    shareRate: 1.0,
    status: "active",
    statusText: "Загрузка...",
    vaultPda: networkConfig.vaultPda,
    baseMint: networkConfig.baseMint,
    shareMint: networkConfig.shareMint,
    vaultTokenAccount: networkConfig.vaultTokenAccount,
    decimals: networkConfig.decimals,
  });

  const [userData, setUserData] = useState<UserVaultData>({
    connected: false,
    walletAddress: "",
    solBalanceLamports: 0n,
    baseTokenBalance: 0n,
    sharesBalance: 0n,
    estimatedBaseValue: 0n,
    hasUserCard: false,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVaultAndUserData = useCallback(async () => {
    try {
      setError(null);
      const vaultTreasuryPk = new PublicKey(networkConfig.vaultTokenAccount);
      const shareMintPk = new PublicKey(networkConfig.shareMint);
      const baseMintPk = new PublicKey(networkConfig.baseMint);
      const programId = new PublicKey(networkConfig.programId);
      const vaultPda = new PublicKey(networkConfig.vaultPda);

      // 1. Чтение баланса казначейства Vault (TVL в базовом токене)
      let vaultTokens = 0n;
      try {
        const treasuryAcc = await getAccount(connection, vaultTreasuryPk, "confirmed");
        vaultTokens = treasuryAcc.amount;
      } catch (e) {
        console.warn("Vault treasury account not found or empty:", e);
      }

      // 2. Чтение total supply shares
      let totalShares = 0n;
      try {
        const shareMintInfo = await getMint(connection, shareMintPk, "confirmed");
        totalShares = shareMintInfo.supply;
      } catch (e) {
        console.warn("Share mint not found:", e);
      }

      // 3. Определение статуса Vault («Средства в рынке» / «Активен»)
      // Если в networkConfig указан poolId или в рынке развернута позиция
      let status: "active" | "in_market" | "paused" = "active";
      if (networkConfig.poolId) {
        status = "in_market";
      }
      const statusText =
        (status as string) === "in_market"
          ? "Средства в рынке (Raydium CLMM)"
          : (status as string) === "paused"
          ? "На паузе"
          : "Активен";

      const shareRate = getShareRate(vaultTokens, totalShares);

      setMetrics({
        tvl: vaultTokens,
        totalShares,
        shareRate,
        status,
        statusText,
        vaultPda: networkConfig.vaultPda,
        baseMint: networkConfig.baseMint,
        shareMint: networkConfig.shareMint,
        vaultTokenAccount: networkConfig.vaultTokenAccount,
        decimals: networkConfig.decimals,
      });

      // 4. Чтение данных пользователя (если кошелёк подключён)
      if (walletPublicKey) {
        let solBal = 0n;
        try {
          const lamports = await connection.getBalance(walletPublicKey, "confirmed");
          solBal = BigInt(lamports);
        } catch {}

        let userBase = 0n;
        try {
          const userBaseAta = deriveAta(walletPublicKey, baseMintPk);
          const baseAcc = await getAccount(connection, userBaseAta, "confirmed");
          userBase = baseAcc.amount;
        } catch {}

        let userShares = 0n;
        try {
          const userShareAta = deriveAta(walletPublicKey, shareMintPk);
          const shareAcc = await getAccount(connection, userShareAta, "confirmed");
          userShares = shareAcc.amount;
        } catch {}

        // Проверка наличия карточки пользователя (PDA [b"user_card", vault, user])
        let hasCard = false;
        try {
          const [userCardPda] = deriveUserCardPda(vaultPda, walletPublicKey, programId);
          const cardInfo = await connection.getAccountInfo(userCardPda, "confirmed");
          hasCard = cardInfo !== null || userShares > 0n;
        } catch {}

        const estimatedVal = evaluateUserPosition(userShares, vaultTokens, totalShares);

        setUserData({
          connected: true,
          walletAddress: walletPublicKey.toBase58(),
          solBalanceLamports: solBal,
          baseTokenBalance: userBase,
          sharesBalance: userShares,
          estimatedBaseValue: estimatedVal,
          hasUserCard: hasCard,
        });
      } else {
        setUserData({
          connected: false,
          walletAddress: "",
          solBalanceLamports: 0n,
          baseTokenBalance: 0n,
          sharesBalance: 0n,
          estimatedBaseValue: 0n,
          hasUserCard: false,
        });
      }
    } catch (err: any) {
      console.error("useVaultData error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [connection, walletPublicKey]);

  useEffect(() => {
    fetchVaultAndUserData();
    const interval = setInterval(fetchVaultAndUserData, 10000);
    return () => clearInterval(interval);
  }, [fetchVaultAndUserData]);

  return {
    metrics,
    userData,
    loading,
    error,
    refresh: fetchVaultAndUserData,
  };
}
