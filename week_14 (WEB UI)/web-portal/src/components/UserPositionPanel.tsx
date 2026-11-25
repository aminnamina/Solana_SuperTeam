import React from "react";
import { UserVaultData } from "../hooks/useVaultData";
import { formatUnits, shortenAddress } from "../utils/format";
import { UserCheck, Wallet, CreditCard, Sparkles, AlertCircle, ArrowUpRight } from "lucide-react";
import networkConfig from "../generated/network.json";

interface UserPositionPanelProps {
  userData: UserVaultData;
  onCreateCard: () => void;
  creatingCard: boolean;
  onRefresh: () => void;
  decimals: number;
}

export const UserPositionPanel: React.FC<UserPositionPanelProps> = ({
  userData,
  onCreateCard,
  creatingCard,
  decimals,
}) => {
  if (!userData.connected) {
    return (
      <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/80 flex items-center justify-center mx-auto mb-3 text-zinc-400">
          <Wallet className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">
          Кошелёк не подключён
        </h3>
        <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
          Подключите Solana Devnet кошелёк (Phantom, Solflare или тестовый) для управления своими инвестициями и карточкой Vault.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-100 text-sm">
                Инвестор: {shortenAddress(userData.walletAddress, 4)}
              </span>
              {userData.hasUserCard ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-3 h-3" />
                  Карточка активна
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertCircle className="w-3 h-3" />
                  Карточка не создана
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Баланс SOL: {formatUnits(userData.solBalanceLamports, 9, 3)} SOL
            </p>
          </div>
        </div>

        {!userData.hasUserCard && (
          <button
            onClick={onCreateCard}
            disabled={creatingCard}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 disabled:opacity-50 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {creatingCard ? "Создание карточки..." : "Создать карточку пользователя"}
            </span>
          </button>
        )}
      </div>

      {/* Balances grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
        <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">
            Доступно для депозита
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-zinc-100 font-mono">
              {formatUnits(userData.baseTokenBalance, decimals, 2)}
            </span>
            <span className="text-xs text-zinc-400">Base</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">
            Ваши Shares в Vault
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-cyan-400 font-mono">
              {formatUnits(userData.sharesBalance, decimals, 2)}
            </span>
            <span className="text-xs text-zinc-400">Shares</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-zinc-950/50 border border-zinc-800/50">
          <span className="text-[11px] text-zinc-400 uppercase tracking-wider block mb-1">
            Оценка позиции (NAV)
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-emerald-400 font-mono">
              ≈ {formatUnits(userData.estimatedBaseValue, decimals, 2)}
            </span>
            <span className="text-xs text-zinc-400">Base</span>
          </div>
        </div>
      </div>
    </div>
  );
};
