import React, { useState, useMemo } from "react";
import { VaultMetrics, UserVaultData } from "../hooks/useVaultData";
import { formatUnits, parseUnits } from "../utils/format";
import { previewDeposit, previewWithdraw } from "../utils/math";
import { ArrowDownRight, ArrowUpRight, Lock, AlertTriangle, ArrowRight } from "lucide-react";

interface DepositWithdrawTabsProps {
  metrics: VaultMetrics;
  userData: UserVaultData;
  onDeposit: (amount: string) => Promise<any>;
  onWithdraw: (shares: string) => Promise<any>;
  loadingAction: boolean;
}

export const DepositWithdrawTabs: React.FC<DepositWithdrawTabsProps> = ({
  metrics,
  userData,
  onDeposit,
  onWithdraw,
  loadingAction,
}) => {
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [inputVal, setInputVal] = useState<string>("");

  const isDeposit = tab === "deposit";
  const isBlocked = metrics.status === "in_market" || metrics.status === "paused";

  // Максимальный доступный баланс для выбранного действия
  const maxAvailable = isDeposit ? userData.baseTokenBalance : userData.sharesBalance;

  const handlePercentage = (pct: number) => {
    if (maxAvailable <= 0n) {
      setInputVal("0");
      return;
    }
    const portion = (maxAvailable * BigInt(pct)) / 100n;
    setInputVal(formatUnits(portion, metrics.decimals, metrics.decimals));
  };

  // Живой предпросмотр результата
  const previewAmount = useMemo(() => {
    if (!inputVal || isNaN(Number(inputVal))) return 0n;
    const rawInput = parseUnits(inputVal, metrics.decimals);
    if (rawInput <= 0n) return 0n;

    if (isDeposit) {
      return previewDeposit(rawInput, metrics.tvl, metrics.totalShares);
    } else {
      return previewWithdraw(rawInput, metrics.tvl, metrics.totalShares);
    }
  }, [inputVal, isDeposit, metrics]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal || Number(inputVal) <= 0) return;
    if (isDeposit) {
      onDeposit(inputVal);
    } else {
      onWithdraw(inputVal);
    }
  };

  return (
    <div className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 shadow-sm">
      {/* Tab Switcher */}
      <div className="flex p-1 rounded-xl bg-zinc-950/80 border border-zinc-800/80 mb-6 max-w-xs">
        <button
          onClick={() => {
            setTab("deposit");
            setInputVal("");
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            isDeposit
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ArrowDownRight className="w-3.5 h-3.5" />
          <span>Внести (Deposit)</span>
        </button>

        <button
          onClick={() => {
            setTab("withdraw");
            setInputVal("");
          }}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            !isDeposit
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Вывести (Withdraw)</span>
        </button>
      </div>

      {/* Blocked Alert Banner */}
      {isBlocked && (
        <div className="mb-6 p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-purple-200">
              {metrics.status === "in_market"
                ? "Средства хранилища находятся в рынке (Raydium CLMM)"
                : "Хранилище приостановлено"}
            </h4>
            <p className="text-xs text-purple-300/80 mt-1 leading-relaxed">
              {metrics.status === "in_market"
                ? "В настоящее время капитал Vault задействован в активной позиции концентрированной ликвидности. Ввод и вывод заблокированы ончейн для защиты от изменения пропорций активов во время открытых ордеров. Дождитесь закрытия позиции администратором."
                : "Администратор временно отключил ввод и вывод средств."}
            </p>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
            <span>{isDeposit ? "Сумма депозита" : "Количество shares к выводу"}</span>
            <div className="flex items-center gap-2">
              <span>
                Доступно:{" "}
                <span className="font-mono text-zinc-200">
                  {formatUnits(maxAvailable, metrics.decimals, 2)}
                </span>{" "}
                {isDeposit ? "Base" : "Shares"}
              </span>
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              disabled={isBlocked || loadingAction}
              placeholder="0.00"
              className="w-full h-14 pl-4 pr-32 rounded-xl bg-zinc-950/90 border border-zinc-800 focus:border-indigo-500 focus:outline-none text-zinc-100 font-mono text-lg placeholder:text-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {[25, 50, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => handlePercentage(pct)}
                  disabled={isBlocked || loadingAction}
                  className="px-2 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-750 text-[11px] font-semibold text-zinc-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  {pct === 100 ? "MAX" : `${pct}%`}
                </button>
              ))}
              <span className="text-xs font-semibold text-zinc-400 pl-1">
                {isDeposit ? "Base" : "Shares"}
              </span>
            </div>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-800/40 flex items-center justify-between text-xs">
          <span className="text-zinc-400">
            {isDeposit ? "Вы получите ≈" : "Вы получите в базовом токене ≈"}
          </span>
          <div className="flex items-center gap-1.5 font-mono font-semibold text-sm text-indigo-300">
            <span>{formatUnits(previewAmount, metrics.decimals, 4)}</span>
            <span className="text-xs text-zinc-400">
              {isDeposit ? "Shares" : "Base"}
            </span>
          </div>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={
            isBlocked ||
            loadingAction ||
            !userData.connected ||
            !inputVal ||
            Number(inputVal) <= 0
          }
          className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:shadow-none disabled:text-zinc-500 disabled:cursor-not-allowed transition-all"
        >
          {loadingAction ? (
            <span>Подтверждение транзакции...</span>
          ) : !userData.connected ? (
            <span>Подключите кошелёк</span>
          ) : isBlocked ? (
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Действие заблокировано (средства в рынке)</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>{isDeposit ? "Внести средства в Vault" : "Вывести средства из Vault"}</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </button>
      </form>
    </div>
  );
};
