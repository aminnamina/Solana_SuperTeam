import React from "react";
import { CheckCircle2, AlertCircle, ExternalLink, X } from "lucide-react";

interface TxToastProps {
  signature: string | null;
  error: string | null;
  onClose: () => void;
}

export const TxToast: React.FC<TxToastProps> = ({ signature, error, onClose }) => {
  if (!signature && !error) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      {signature && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 flex items-start gap-3">
          <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-zinc-100">
              Транзакция успешно подтверждена!
            </h4>
            <p className="text-xs text-zinc-400 mt-1">
              Действие выполнено и зафиксировано в блокчейне Solana Devnet.
            </p>
            <a
              href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span>Посмотреть в Solana Explorer</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && !signature && (
        <div className="p-4 rounded-2xl bg-zinc-900 border border-rose-500/30 shadow-2xl shadow-rose-500/10 flex items-start gap-3">
          <div className="p-1 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-rose-200">
              Ошибка транзакции
            </h4>
            <p className="text-xs text-zinc-300 mt-1 leading-relaxed break-words">
              {error}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
