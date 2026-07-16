import { createClient, createAccount, generatePrivateKey, abi } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const FALLBACK_ADDRESS = "0x779dCA4ccb496456524ffCC12e95926245aaf89C";
const ACCOUNT_KEY = "nda-sentinel-account-pk";

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || FALLBACK_ADDRESS
) as `0x${string}`;

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

export const account = createAccount(loadOrCreatePrivateKey());

export const client = createClient({
  chain: studionet,
  account,
});

export function getAccountAddress(): `0x${string}` {
  return account.address as `0x${string}`;
}

export function resetLocalAccount(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ACCOUNT_KEY);
    window.location.reload();
  } catch {
    /* ignore */
  }
}

export function toCalldataAddress(hexAddress: string): any {
  const dummyBytes = new Uint8Array(21);
  dummyBytes[0] = 24; // SPECIAL_ADDR
  for (let i = 1; i <= 20; i++) dummyBytes[i] = 0;
  const decoded = abi.calldata.decode(dummyBytes) as any;
  const CalldataAddress = decoded.constructor;

  const cleanHex = hexAddress.startsWith("0x") ? hexAddress.slice(2) : hexAddress;
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return new CalldataAddress(bytes);
}

