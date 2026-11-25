import React, { useMemo, useState } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { Keypair, PublicKey } from "@solana/web3.js";
import networkConfig from "./generated/network.json";
import { useVaultData } from "./hooks/useVaultData";
import { useVaultActions } from "./hooks/useVaultActions";
import { HeaderBar } from "./components/HeaderBar";
import { VaultMetricsGrid } from "./components/VaultMetricsGrid";
import { UserPositionPanel } from "./components/UserPositionPanel";
import { DepositWithdrawTabs } from "./components/DepositWithdrawTabs";
import { TxToast } from "./components/TxToast";
import { RefreshCw, Terminal, ExternalLink, HelpCircle, Network } from "lucide-react";
import "@solana/wallet-adapter-react-ui/styles.css";

function VaultPortalContent() {
  const { connection } = useConnection();
  const wallet = useWallet();

  // Опциональный локальный devnet-кошелек для тестирования без расширения браузера
  const [useDevWallet, setUseDevWallet] = useState<boolean>(false);
  const devKeypair = useMemo(() => {
    // Дефолтный публичный ключ разработчика для отображения балансов
    return new PublicKey("F8VD2NvjMKSSDqRSDpTYzL2wrVyeDzt3zEDweSqmQqcM");
  }, []);

  const activePublicKey = wallet.publicKey ?? (useDevWallet ? devKeypair : null);

  const { metrics, userData, loading, error: fetchError, refresh } = useVaultData(
    connection,
    activePublicKey
  );

  const {
    createUserCard,
    deposit,
    withdraw,
    loading: loadingAction,
    lastSignature,
    actionError,
    clearError,
    clearSignature,
  } = useVaultActions(connection, wallet.publicKey ? wallet : null, metrics, refresh);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <HeaderBar
        onUseDevWallet={() => setUseDevWallet(!useDevWallet)}
        isDevWalletActive={useDevWallet}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top welcome & refresh bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">
              Security Vault MVP Portal
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Автономное хранилище с активным управлением ликвидностью в Raydium CLMM
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Обновить данные</span>
            </button>
          </div>
        </div>

        {/* 1. Vault Metrics Grid */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Метрики протокола (Protocol State)
            </h2>
          </div>
          <VaultMetricsGrid metrics={metrics} loading={loading} />
        </section>

        {/* 2. Interactive Area: Position + Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* User Position */}
          <section className="lg:col-span-6 space-y-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Ваша позиция в Vault
              </h2>
              <UserPositionPanel
                userData={userData}
                onCreateCard={createUserCard}
                creatingCard={loadingAction}
                onRefresh={refresh}
                decimals={metrics.decimals}
              />
            </div>

            {/* Architecture Banner */}
            <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-400 space-y-3">
              <div className="flex items-center gap-2 text-zinc-200 font-semibold">
                <Network className="w-4 h-4 text-indigo-400" />
                <span>Архитектура интеграции (Web & On-Chain)</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300 font-mono text-[11px] overflow-x-auto py-1">
                <span className="px-2 py-1 rounded bg-zinc-800">Browser (React)</span>
                <span>→</span>
                <span className="px-2 py-1 rounded bg-zinc-800">Wallet Adapter</span>
                <span>→</span>
                <span className="px-2 py-1 rounded bg-zinc-800">Devnet RPC</span>
                <span>→</span>
                <span className="px-2 py-1 rounded bg-indigo-950 text-indigo-300 border border-indigo-700/50">
                  security_vault
                </span>
                <span>→</span>
                <span className="px-2 py-1 rounded bg-purple-950 text-purple-300 border border-purple-700/50">
                  Raydium CLMM
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                Пользователи депонируют базовые токены и получают пропорциональные доли (shares).
                При формировании стратегии капитал размещается в активном пуле концентрированной ликвидности от имени Vault PDA.
              </p>
            </div>
          </section>

          {/* Deposit & Withdraw Tabs */}
          <section className="lg:col-span-6 space-y-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                Управление средствами
              </h2>
              <DepositWithdrawTabs
                metrics={metrics}
                userData={userData}
                onDeposit={deposit}
                onWithdraw={withdraw}
                loadingAction={loadingAction}
              />
            </div>

            {/* Faucet helper */}
            <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/40 text-xs text-zinc-400 flex items-start gap-3">
              <Terminal className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-300">
                  Нужны тестовые токены для проверки?
                </span>
                <p className="text-[11px] mt-0.5 text-zinc-400">
                  Используйте CLI faucet из папки clmm-tools:
                </p>
                <code className="mt-1 block px-2.5 py-1 rounded bg-zinc-950 border border-zinc-800/80 font-mono text-[11px] text-amber-300 select-all">
                  npm run demo:faucet -- {userData.walletAddress || "&lt;WALLET_PUBKEY&gt;"} 500
                </code>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 py-6 text-center text-xs text-zinc-400">
        <p>Security Vault MVP · SolFlow Web3 Hub · Solana Devnet</p>
      </footer>

      {/* Toast notifications */}
      <TxToast
        signature={lastSignature}
        error={actionError || fetchError}
        onClose={() => {
          clearSignature();
          clearError();
        }}
      />
    </div>
  );
}

export function App() {
  const endpoint = networkConfig.rpcUrl || "https://api.devnet.solana.com";
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  const ConnectionProviderComp = ConnectionProvider as any;
  const WalletProviderComp = WalletProvider as any;
  const WalletModalProviderComp = WalletModalProvider as any;

  return (
    <ConnectionProviderComp endpoint={endpoint}>
      <WalletProviderComp wallets={wallets} autoConnect>
        <WalletModalProviderComp>
          <VaultPortalContent />
        </WalletModalProviderComp>
      </WalletProviderComp>
    </ConnectionProviderComp>
  );
}

export default App;
