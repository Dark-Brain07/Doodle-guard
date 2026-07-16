import { createClient, createAccount, generatePrivateKey } from "genlayer-js";
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
