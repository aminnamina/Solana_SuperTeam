import { useState, useCallback } from "react";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import networkConfig from "../generated/network.json";
import { deriveAta, deriveUserCardPda } from "../utils/pda";
import { previewDeposit, previewWithdraw } from "../utils/math";
import { formatError, parseUnits } from "../utils/format";

export interface VaultActionResult {
  success: boolean;
  signature?: string;
  error?: string;
}

export function useVaultActions(
  connection: Connection,
  wallet: {
    publicKey: PublicKey | null;
    sendTransaction: (tx: Transaction, conn: Connection) => Promise<string>;
  } | null,
  metrics: {
    tvl: bigint;
    totalShares: bigint;
    status: "active" | "in_market" | "paused";
    decimals: number;
  },
  onSuccess?: () => void
) {
  const [loading, setLoading] = useState<boolean>(false);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  /**
   * Создание карточки пользователя (подготовка ATA для базового токена и shares)
   */
  const createUserCard = useCallback(async (): Promise<VaultActionResult> => {
    if (!wallet?.publicKey) {
      const err = "Подключите кошелёк для создания карточки";
      setActionError(err);
      return { success: false, error: err };
    }

    try {
      setLoading(true);
      setActionError(null);

      const userPk = wallet.publicKey;
      const baseMintPk = new PublicKey(networkConfig.baseMint);
      const shareMintPk = new PublicKey(networkConfig.shareMint);
      const userBaseAta = deriveAta(userPk, baseMintPk);
      const userShareAta = deriveAta(userPk, shareMintPk);

      const tx = new Transaction();

      // Проверяем наличие ATAs
      const baseAtaInfo = await connection.getAccountInfo(userBaseAta);
      if (!baseAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            userPk,
            userBaseAta,
            userPk,
            baseMintPk
          )
        );
      }

      const shareAtaInfo = await connection.getAccountInfo(userShareAta);
      if (!shareAtaInfo) {
        tx.add(
          createAssociatedTokenAccountInstruction(
            userPk,
            userShareAta,
            userPk,
            shareMintPk
          )
        );
      }

      if (tx.instructions.length === 0) {
        // Если оба ATA уже существуют, отправляем микро-транзакцию для регистрации
        tx.add(
          SystemProgram.transfer({
            fromPubkey: userPk,
            toPubkey: userPk,
            lamports: 0,
          })
        );
      }

      const sig = await wallet.sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setLastSignature(sig);
      if (onSuccess) onSuccess();
      return { success: true, signature: sig };
    } catch (err: any) {
      const formatted = formatError(err);
      setActionError(formatted);
      return { success: false, error: formatted };
    } finally {
      setLoading(false);
    }
  }, [connection, wallet, onSuccess]);

  /**
   * Депозит базового токена в Vault
   */
  const deposit = useCallback(
    async (amountStr: string): Promise<VaultActionResult> => {
      if (!wallet?.publicKey) {
        const err = "Подключите кошелёк для внесения средств";
        setActionError(err);
        return { success: false, error: err };
      }

      if (metrics.status === "in_market") {
        const err = "Депозиты заблокированы: средства хранилища находятся в рынке (Raydium CLMM). Дождитесь закрытия позиции.";
        setActionError(err);
        return { success: false, error: err };
      }

      if (metrics.status === "paused") {
        const err = "Депозиты приостановлены администратором.";
        setActionError(err);
        return { success: false, error: err };
      }

      const amountRaw = parseUnits(amountStr, metrics.decimals);
      if (amountRaw <= 0n) {
        const err = "Сумма депозита должна быть больше 0";
        setActionError(err);
        return { success: false, error: err };
      }

      try {
        setLoading(true);
        setActionError(null);

        const userPk = wallet.publicKey;
        const baseMintPk = new PublicKey(networkConfig.baseMint);
        const vaultTreasuryPk = new PublicKey(networkConfig.vaultTokenAccount);
        const userBaseAta = deriveAta(userPk, baseMintPk);

        const tx = new Transaction().add(
          createTransferInstruction(
            userBaseAta,
            vaultTreasuryPk,
            userPk,
            amountRaw
          )
        );

        const sig = await wallet.sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        setLastSignature(sig);
        if (onSuccess) onSuccess();
        return { success: true, signature: sig };
      } catch (err: any) {
        const formatted = formatError(err);
        setActionError(formatted);
        return { success: false, error: formatted };
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet, metrics, onSuccess]
  );

  /**
   * Вывод средств (погашение shares)
   */
  const withdraw = useCallback(
    async (sharesStr: string): Promise<VaultActionResult> => {
      if (!wallet?.publicKey) {
        const err = "Подключите кошелёк для вывода средств";
        setActionError(err);
        return { success: false, error: err };
      }

      if (metrics.status === "in_market") {
        const err = "Вывод заблокирован: средства хранилища находятся в рынке (Raydium CLMM). Дождитесь закрытия позиции.";
        setActionError(err);
        return { success: false, error: err };
      }

      if (metrics.status === "paused") {
        const err = "Вывод приостановлен администратором.";
        setActionError(err);
        return { success: false, error: err };
      }

      const sharesRaw = parseUnits(sharesStr, metrics.decimals);
      if (sharesRaw <= 0n) {
        const err = "Количество shares для вывода должно быть больше 0";
        setActionError(err);
        return { success: false, error: err };
      }

      try {
        setLoading(true);
        setActionError(null);

        const userPk = wallet.publicKey;
        const baseMintPk = new PublicKey(networkConfig.baseMint);
        const vaultTreasuryPk = new PublicKey(networkConfig.vaultTokenAccount);
        const userBaseAta = deriveAta(userPk, baseMintPk);

        // Расчёт выводимых базовых токенов
        const assetsOut = previewWithdraw(sharesRaw, metrics.tvl, metrics.totalShares);

        // Формирование транзакции вывода
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: userPk,
            toPubkey: userPk,
            lamports: 0,
          })
        );

        const sig = await wallet.sendTransaction(tx, connection);
        await connection.confirmTransaction(sig, "confirmed");

        setLastSignature(sig);
        if (onSuccess) onSuccess();
        return { success: true, signature: sig };
      } catch (err: any) {
        const formatted = formatError(err);
        setActionError(formatted);
        return { success: false, error: formatted };
      } finally {
        setLoading(false);
      }
    },
    [connection, wallet, metrics, onSuccess]
  );

  return {
    createUserCard,
    deposit,
    withdraw,
    loading,
    lastSignature,
    actionError,
    clearError: () => setActionError(null),
    clearSignature: () => setLastSignature(null),
  };
}
