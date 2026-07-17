import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseContractError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  
  if (raw.includes("Contract Queues not found") || raw.includes("RevealingPhase not found")) {
    return "Consensus mismatch or network issue. Please try again in 30 seconds.";
  }
  
  if (raw.includes("UserError:")) {
    const match = raw.match(/UserError:\s*([^"\\]+)/);
    return match ? match[1].trim() : raw;
  }
  
  if (raw.includes("Counterparty cannot be sender")) {
    return "You cannot create an NDA with yourself.";
  }
  if (raw.includes("Scope must be one of")) {
    return "Invalid scope selected.";
  }
  if (raw.includes("Expiry must be in the future")) {
    return "Expiry date must be in the future.";
  }
  if (raw.includes("Must provide 1 to 50 keyword hashes")) {
    return "Please add between 1 and 50 keywords.";
  }
  if (raw.includes("Activation stake must be > 0")) {
    return "Activation stake must be greater than 0.";
  }
  if (raw.includes("Only party_b can activate")) {
    return "Only the counterparty (party_b) can activate this NDA.";
  }
  if (raw.includes("Only a party to the NDA can report")) {
    return "Only the involved parties can report a leak.";
  }
  if (raw.includes("No revealed keywords matched the stored hashes")) {
    return "None of the selected keywords match the NDA hashes. Check your vault/password.";
  }
  if (raw.includes("Only the determined violator can appeal")) {
    return "Only the violator determined by the AI Jury can submit an appeal.";
  }
  if (raw.includes("Appeal fee must be at least")) {
    return "Insufficient appeal fee. You must stake at least 10% of the slashed amount.";
  }
  
  return `Transaction failed: ${raw.slice(0, 200)}`;
}
