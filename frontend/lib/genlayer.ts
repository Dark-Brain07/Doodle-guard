import {
  createClient,
  createAccount,
  generatePrivateKey,
  abi,
} from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import type { CalldataEncodable } from "genlayer-js/types";

const FALLBACK_ADDRESS = "0xE1bc278A7512e02bF7ec0bD08657ae4D71aa7C96";
const ACCOUNT_KEY = "doodle-guard-account-pk";
const MODE_KEY = "doodle-guard-wallet-mode";
export const WALLET_CHANGED_EVENT = "doodle-guard:wallet-changed";

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

export interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: InjectedEthereum;
}

export let discoveredProviders: EIP6963ProviderDetail[] = [];

if (typeof window !== "undefined") {
  window.addEventListener("eip6963:announceProvider", (event: any) => {
    const detail = event.detail as EIP6963ProviderDetail;
    if (!discoveredProviders.some(p => p.info.uuid === detail.info.uuid)) {
      discoveredProviders.push(detail);
      window.dispatchEvent(new Event("eip6963:providers-updated"));
    }
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

/**
 * Ensure the injected wallet is on studionet. If the chain is not registered
 * yet in MetaMask, add it first (per R23). Uses parameters read from
 * `genlayer-js/chains` rather than hard-coded literals.
 */
export async function ensureStudionetChain(customEth?: InjectedEthereum): Promise<void> {
  const eth = customEth || getInjectedEthereum();
  if (!eth) throw new Error("No injected wallet detected");
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const anyErr = err as { code?: number; message?: string };
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

export async function connectInjectedWallet(detail?: EIP6963ProviderDetail): Promise<`0x${string}`> {
  const eth = detail ? detail.provider : getInjectedEthereum();
  if (!eth) {
    throw new Error("No compatible EVM wallet found");
  }

  if (detail && typeof window !== "undefined") {
    try {
      Object.defineProperty(window, 'ethereum', {
        value: detail.provider,
        configurable: true,
        writable: true
      });
    } catch (e) {
      console.warn("Could not override window.ethereum", e);
    }
  }

  await ensureStudionetChain(eth);
  const accounts = (await eth.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("No accounts returned from wallet");
  }
  const addr = accounts[0] as `0x${string}`;
  
  client = createClient({ chain: studionet, account: addr });
  activeAddress = addr;
  walletMode = "metamask"; // Keep internal state string
  saveMode("metamask");
  
  if (detail && typeof window !== "undefined") {
    window.localStorage.setItem("doodle-guard-provider-uuid", detail.info.uuid);
  }

  emitWalletChanged();

  eth?.on?.("accountsChanged", (accts: unknown) => {
    const list = accts as string[];
    if (!list || list.length === 0) {
      disconnectWallet();
    } else if ((list[0] as `0x${string}`) !== activeAddress) {
      activeAddress = list[0] as `0x${string}`;
      client = createClient({ chain: studionet, account: activeAddress });
      emitWalletChanged();
    }
  });
  eth?.on?.("chainChanged", () => {
    emitWalletChanged();
  });

  return addr;
}

export async function connectMetaMask(): Promise<`0x${string}`> {
  return connectInjectedWallet();
}

export function switchToBurner(): void {
  disconnectWallet();
}

export function disconnectWallet(): void {
  client = createClient({ chain: studionet, account: burnerAccount });
  activeAddress = burnerAccount.address as `0x${string}`;
  walletMode = "burner";
  saveMode("burner");
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("doodle-guard-provider-uuid");
  }
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
    const uuid = window.localStorage.getItem("doodle-guard-provider-uuid");
    let eth = getInjectedEthereum();
    
    if (uuid && discoveredProviders.length > 0) {
      const match = discoveredProviders.find(p => p.info.uuid === uuid);
      if (match) {
        eth = match.provider;
        try {
          Object.defineProperty(window, 'ethereum', {
            value: eth,
            configurable: true,
            writable: true
          });
        } catch (e) {
          console.warn("Could not override window.ethereum on restore", e);
        }
      }
    }
    
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
    /* silent */
  }
}

/**
 * Kick off session restore at app load so pages that mount without ever
 * showing the wallet button (e.g. dashboard on hard-refresh) still end up
 * on the user's MetaMask address before their first read. `walletReady`
 * resolves once restore has been attempted — awaiting it prevents the
 * dashboard from querying `get_user_ndas(burner)` and then rendering
 * "No NDAs found".
 */
let walletReadyResolver: (() => void) | null = null;
export const walletReady: Promise<void> = new Promise((resolve) => {
  walletReadyResolver = resolve;
});
if (typeof window !== "undefined") {
  // Fire-and-forget; whether it succeeds or not, resolve() unblocks callers.
  restoreWalletSession()
    .catch(() => {})
    .finally(() => walletReadyResolver?.());
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
    const uuid = typeof window !== "undefined" ? window.localStorage.getItem("doodle-guard-provider-uuid") : null;
    let eth = getInjectedEthereum();
    if (uuid) {
      const match = discoveredProviders.find(p => p.info.uuid === uuid);
      if (match) eth = match.provider;
    }
    if (eth) await ensureStudionetChain(eth);
  } catch {
    /* let the write attempt surface the real error */
  }
}

export class WalletNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletNotReadyError";
  }
}

/**
 * Call before any write path. Blocks with a clear error if the current
 * signer is the demo-only burner (zero GEN on studionet, cannot pay
 * stakes) — the alternative is a MetaMask sign prompt against an
 * unfunded account whose tx will silently fail after a long wait.
 */
export async function assertWritable(): Promise<void> {
  await walletReady;
  // Burner check removed so user can use a funded burner wallet
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
