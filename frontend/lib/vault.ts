import CryptoJS from "crypto-js";

export interface VaultData {
  keywords: string[];
  salt: string;
  nda_context: string;
}

export function encryptVault(data: VaultData, password: string): string {
  const jsonStr = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonStr, password).toString();
}

export function decryptVault(encrypted: string, password: string): VaultData | null {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, password);
    const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedData) return null;
    return JSON.parse(decryptedData);
  } catch {
    return null;
  }
}

export function downloadVaultFile(data: VaultData, password: string, filename: string) {
  const encrypted = encryptVault(data, password);
  const blob = new Blob([encrypted], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
