import fs from "node:fs";
import path from "node:path";

export interface DevnetState {
  network: "devnet";
  tokens: {
    baseMint?: string;
    quoteMint?: string;
    decimals: number;
  };
  pool?: {
    id: string;
    programId: string;
    ammConfigId: string;
    mintA: string;
    mintB: string;
    vaultA: string;
    vaultB: string;
    observationId: string;
    exBitmapAccount: string;
    initialPrice: number;
  };
  position?: {
    nftMint: string;
    tickLower: number;
    tickUpper: number;
    priceLower: string;
    priceUpper: string;
  };
  txs: {
    createPool?: string;
    openPosition?: string;
  };
}

const STATE_PATH = path.resolve(process.cwd(), "devnet-state.json");

export function loadState(): DevnetState {
  if (!fs.existsSync(STATE_PATH)) {
    return { network: "devnet", tokens: { decimals: 6 }, txs: {} };
  }
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8")) as DevnetState;
}

export function saveState(state: DevnetState): void {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}
