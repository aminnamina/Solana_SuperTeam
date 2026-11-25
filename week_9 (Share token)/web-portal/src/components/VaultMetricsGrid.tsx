import React from "react";
import { VaultMetrics } from "../hooks/useVaultData";
import { formatUnits } from "../utils/format";
import { Coins, Layers, TrendingUp, Activity, ExternalLink } from "lucide-react";
import networkConfig from "../generated/network.json";

interface VaultMetricsGridProps {
  metrics: VaultMetrics;
  loading: boolean;
}

export const VaultMetricsGrid: React.FC<VaultMetricsGridProps> = ({
  metrics,
  loading,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. TVL */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <div className="flex items-center justify-between text-zinc-400 mb-3">
          <span className="text-xs font-medium uppercase tracking-wider">
            Общий баланс (TVL)
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Coins className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-100 font-mono">
            {loading ? "..." : formatUnits(metrics.tvl, metrics.decimals, 2)}
          </span>
          <span className="text-xs text-zinc-400">Base</span>
        </div>
        <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Казначейство Vault</span>
          <a
            href={`https://explorer.solana.com/address/${networkConfig.vaultTokenAccount}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            <span>ATA</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* 2. Total Shares */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <div className="flex items-center justify-between text-zinc-400 mb-3">
          <span className="text-xs font-medium uppercase tracking-wider">
            Выпущено Shares
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-100 font-mono">
            {loading ? "..." : formatUnits(metrics.totalShares, metrics.decimals, 2)}
          </span>
          <span className="text-xs text-zinc-400">Shares</span>
        </div>
        <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Доли инвесторов</span>
          <a
            href={`https://explorer.solana.com/address/${networkConfig.shareMint}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Mint</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>

      {/* 3. Share Price Rate */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <div className="flex items-center justify-between text-zinc-400 mb-3">
          <span className="text-xs font-medium uppercase tracking-wider">
            Курс 1 Share
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-zinc-100 font-mono">
            {loading ? "..." : metrics.shareRate.toFixed(4)}
          </span>
          <span className="text-xs text-zinc-400">Base / Share</span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          Оценка чистых активов (NAV)
        </p>
      </div>

      {/* 4. Vault Status */}
      <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all shadow-sm">
        <div className="flex items-center justify-between text-zinc-400 mb-3">
          <span className="text-xs font-medium uppercase tracking-wider">
            Статус Vault
          </span>
          <div
            className={`p-2 rounded-xl ${
              metrics.status === "in_market"
                ? "bg-purple-500/10 text-purple-400"
                : metrics.status === "paused"
                ? "bg-rose-500/10 text-rose-400"
                : "bg-emerald-500/10 text-emerald-400"
            }`}
          >
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              metrics.status === "in_market"
                ? "bg-purple-500 animate-pulse"
                : metrics.status === "paused"
                ? "bg-rose-500"
                : "bg-emerald-500"
            }`}
          />
          <span className="text-base font-semibold text-zinc-100">
            {metrics.status === "in_market"
              ? "Средства в рынке"
              : metrics.status === "paused"
              ? "На паузе"
              : "Активен"}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400 truncate">
          {metrics.status === "in_market"
            ? "Концентрированная позиция CLMM"
            : "Готов к депозитам и выводу"}
        </p>
      </div>
    </div>
  );
};
