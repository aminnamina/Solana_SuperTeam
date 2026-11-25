import React from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Shield, ExternalLink, Globe, Key } from "lucide-react";
import networkConfig from "../generated/network.json";
import { shortenAddress } from "../utils/format";

interface HeaderBarProps {
  onUseDevWallet?: () => void;
  isDevWalletActive?: boolean;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  onUseDevWallet,
  isDevWalletActive,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-zinc-100 tracking-tight">
                Security Vault
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                MVP
              </span>
            </div>
            <p className="text-xs text-zinc-400">Raydium CLMM CPI & DeFi Treasury</p>
          </div>
        </div>

        {/* Network & Program info */}
        <div className="hidden md:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-300 font-medium">Solana Devnet</span>
          </div>

          <a
            href={`https://explorer.solana.com/address/${networkConfig.programId}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Открыть контракт в Solana Explorer"
          >
            <span>Program: {shortenAddress(networkConfig.programId, 4)}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Wallet & Controls */}
        <div className="flex items-center gap-3">
          {import.meta.env.DEV && onUseDevWallet && (
            <button
              onClick={onUseDevWallet}
              className={`text-xs px-3 py-2 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                isDevWalletActive
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                  : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200"
              }`}
              title="Переключить тестовый локальный кошелёк (Devnet)"
            >
              <Key className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {isDevWalletActive ? "Devnet Keypair" : "Demo Wallet"}
              </span>
            </button>
          )}

          <div className="wallet-adapter-button-wrapper">
            <WalletMultiButton className="!bg-indigo-600 hover:!bg-indigo-500 !h-10 !text-sm !font-medium !rounded-xl !transition-all shadow-md shadow-indigo-600/20" />
          </div>
        </div>
      </div>
    </header>
  );
};
