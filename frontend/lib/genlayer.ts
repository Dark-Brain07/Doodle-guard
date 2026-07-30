import {
  createClient,
  createAccount,
  generatePrivateKey,
  abi,
} from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { CalldataEncodable } from "genlayer-js/types";

const FALLBACK_ADDRESS = "0xa39218800F583BB35B553a34ff479197Dc6Ca7DE";
const ACCOUNT_KEY = "nda-sentinel-account-pk";
const MODE_KEY = "nda-sentinel-wallet-mode";
export const WALLET_CHANGED_EVENT = "nda-sentinel:wallet-changed";

// studionet.id = 61999 (0xF1EF). Read from SDK per R23 so it tracks upstream.
export const STUDIONET_CHAIN_ID = studionet.id;
export const STUDIONET_CHAIN_ID_HEX = "0x" + STUDIONET_CHAIN_ID.toString(16);
export const STUDIONET_RPC_URL = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER_URL = "https://genlayer-explorer.vercel.app";

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_ADDRESS
) as `0x${string}`;

export type WalletMode = "metamask" | "burner";

// ---------------------------------------------------------------------------
// Burner (demo-mode fallback). Generated in-browser, persisted to localStorage.
// Kept because studionet has no public faucet — a random burner cannot
// transact against the live contract, but it lets read-only pages render even
// when MetaMask is missing. Prefer MetaMask for any write.
// ---------------------------------------------------------------------------

function loadOrCreatePrivateKey(): `0x${string}` {
  if (typeof window === "undefined") return generatePrivateKey();
  try {
    const stored = window.localStorage.getItem(ACCOUNT_KEY);
    if (stored && /^0x[0-9a-fA-F]{64}$/.test(stored)) {
      return stored as `0x${string}`;
    }
    const pk = generatePrivateKey();
    window.localStorage.setItem(ACCOUNT_KEY, pk);
    return pk;
  } catch {
    return generatePrivateKey();
  }
}

const burnerAccount = createAccount(loadOrCreatePrivateKey());

// ---------------------------------------------------------------------------
// Live-binding singletons. ES-module live bindings mean any file that
// `import { client }` will see the current post-connect value at call time,
// so switching wallets does not require refactoring every consumer.
// ---------------------------------------------------------------------------

// eslint-disable-next-line prefer-const
export let client = createClient({ chain: studionet, account: burnerAccount });
// eslint-disable-next-line prefer-const
export let activeAddress: `0x${string}` = burnerAccount.address as `0x${string}`;
// eslint-disable-next-line prefer-const
export let walletMode: WalletMode = "burner";

function emitWalletChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WALLET_CHANGED_EVENT));
}

function saveMode(mode: WalletMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// MetaMask (R21–R24).
// ---------------------------------------------------------------------------

type EthereumRequestArgs = { method: string; params?: unknown };
type InjectedEthereum = {
  request: (args: EthereumRequestArgs) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void
  ) => void;
};

function getInjectedEthereum(): InjectedEthereum | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: InjectedEthereum };
  return w.ethereum ?? null;
}

export function isMetaMaskAvailable(): boolean {
  return getInjectedEthereum() !== null;
}

/**
 * Ensure the injected wallet is on studionet. If the chain is not registered
 * yet in MetaMask, add it first (per R23). Uses parameters read from
 * `genlayer-js/chains` rather than hard-coded literals.
 */
export async function ensureStudionetChain(): Promise<void> {
  const eth = getInjectedEthereum();
  if (!eth) throw new Error("No injected wallet detected");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const anyErr = err as { code?: number; message?: string };
    // 4902: chain unknown; -32603: fallback in some MM builds.
    if (anyErr?.code === 4902 || anyErr?.code === -32603) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: STUDIONET_CHAIN_ID_HEX,
            chainName: "GenLayer Studio Network",
            nativeCurrency: { name: "GEN Token", symbol: "GEN", decimals: 18 },
            rpcUrls: [STUDIONET_RPC_URL],
            blockExplorerUrls: [STUDIONET_EXPLORER_URL],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export async function connectMetaMask(): Promise<`0x${string}`> {
  const eth = getInjectedEthereum();
  if (!eth) {
    throw new Error(
      "MetaMask (or a compatible EIP-1193 wallet) is not installed"
    );
  }
  await ensureStudionetChain();
  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from wallet");
  }
  const addr = accounts[0] as `0x${string}`;
  // genlayer-js accepts a bare address string as `account` (per R22): the
  // client then routes transaction signing through the injected wallet
  // rather than any key in the bundle.
  client = createClient({ chain: studionet, account: addr });
  activeAddress = addr;
  walletMode = "metamask";
  saveMode("metamask");
  emitWalletChanged();

  // React to wallet account/chain changes without a full reload.
  const eth2 = getInjectedEthereum();
  eth2?.on?.("accountsChanged", (accts: unknown) => {
    const list = accts as string[];
    if (!list || list.length === 0) {
      switchToBurner();
    } else if ((list[0] as `0x${string}`) !== activeAddress) {
      activeAddress = list[0] as `0x${string}`;
      client = createClient({ chain: studionet, account: activeAddress });
      emitWalletChanged();
    }
  });
  eth2?.on?.("chainChanged", () => {
    // Best-effort: re-enforce studionet on next write via ensureStudionetChain.
    emitWalletChanged();
  });

  return addr;
}

export function switchToBurner(): void {
  client = createClient({ chain: studionet, account: burnerAccount });
  activeAddress = burnerAccount.address as `0x${string}`;
  walletMode = "burner";
  saveMode("burner");
  emitWalletChanged();
}

/**
 * Restore prior session on page load. Called once by the wallet button.
 * Silent about failure — falls back to burner mode.
 */
export async function restoreWalletSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const savedMode = window.localStorage.getItem(MODE_KEY);
  if (savedMode !== "metamask") return;
  try {
    const eth = getInjectedEthereum();
    if (!eth) return;
    const accounts = (await eth.request({
      method: "eth_accounts",
    })) as string[];
    if (accounts && accounts.length > 0) {
      const addr = accounts[0] as `0x${string}`;
      client = createClient({ chain: studionet, account: addr });
      activeAddress = addr;
      walletMode = "metamask";
      emitWalletChanged();
    }
  } catch {
    /* silent — remain on burner */
  }
}

// ---------------------------------------------------------------------------
// Compatibility helpers used across pages.
// ---------------------------------------------------------------------------

export function getAccountAddress(): `0x${string}` {
  return activeAddress;
}

export function resetLocalAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
    window.localStorage.removeItem(MODE_KEY);
    window.location.reload();
  } catch {
    /* ignore */
  }
}

/** Ensure MetaMask is on studionet before every write. Cheap no-op on burner. */
export async function ensureCorrectChainBeforeWrite(): Promise<void> {
  if (walletMode !== "metamask") return;
  try {
    await ensureStudionetChain();
  } catch {
    /* let the write attempt surface the real error */
  }
}

export function explorerTxUrl(hash: string): string {
  return `${STUDIONET_EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(addr: string): string {
  return `${STUDIONET_EXPLORER_URL}/address/${addr}`;
}

// ---------------------------------------------------------------------------
// toCalldataAddress — pre-existing helper, unchanged.
// ---------------------------------------------------------------------------

export function toCalldataAddress(hexAddress: string): CalldataEncodable {
  const dummyBytes = new Uint8Array(21);
  dummyBytes[0] = 24; // SPECIAL_ADDR
  for (let i = 1; i <= 20; i++) dummyBytes[i] = 0;
  const decoded = abi.calldata.decode(dummyBytes) as object;
  const CalldataAddress = decoded.constructor as unknown as new (
    bytes: Uint8Array
  ) => CalldataEncodable;

  const cleanHex = hexAddress.startsWith("0x") ? hexAddress.slice(2) : hexAddress;
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return new CalldataAddress(bytes);
}
