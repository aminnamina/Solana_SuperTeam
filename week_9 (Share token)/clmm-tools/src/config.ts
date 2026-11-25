import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Raydium, DEVNET_PROGRAM_ID, TxVersion } from "@raydium-io/raydium-sdk-v2";

export const RPC_URL = process.env.SOLANA_RPC_URL ?? clusterApiUrl("devnet");
export const TX_VERSION = TxVersion.V0;
export const CLMM_PROGRAM =
  process.env.CLMM_PROGRAM_ID != null
    ? new PublicKey(process.env.CLMM_PROGRAM_ID)
    : new PublicKey("DRayAUgENGQBKVaX8owNhgzkEDyoHTGVEGHVJT1E9pfH");

export const DEVNET_AMM_CONFIG = {
  id: new PublicKey("CD4aJtX11cqTCAc83nxSPkkh5JW2yjD6uwHeovjqQ1qu"),
  index: 0,
  protocolFeeRate: 120000,
  tradeFeeRate: 2500,
  tickSpacing: 60,
  fundFeeRate: 40000,
  fundOwner: "",
  description: "Devnet 0.25% tier",
};

export function loadWallet(): Keypair {
  const defaultPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const localProjectKeypair = path.resolve(process.cwd(), "..", "devnet-keypair.json");
  const localKeypair = path.resolve(process.cwd(), "devnet-keypair.json");

  const walletPath =
    process.env.WALLET_PATH ??
    (fs.existsSync(localKeypair)
      ? localKeypair
      : fs.existsSync(localProjectKeypair)
      ? localProjectKeypair
      : defaultPath);

  const secret = JSON.parse(fs.readFileSync(walletPath, "utf-8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

export async function createContext() {
  const connection = new Connection(RPC_URL, "confirmed");
  const owner = loadWallet();
  const raydium = await Raydium.load({
    connection,
    owner,
    cluster: "devnet",
    disableLoadToken: true,
  });

  return { connection, owner, raydium };
}
