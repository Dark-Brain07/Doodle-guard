"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { client, CONTRACT_ADDRESS } from "@/lib/genlayer"
import { decryptVault, VaultData } from "@/lib/vault"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"

export function ReportLeakForm() {
  const { ndaId } = useParams()
  const router = useRouter()
  const [suspectUrl, setSuspectUrl] = useState("")
  const [vaultPassword, setVaultPassword] = useState("")
  const [vaultFile, setVaultFile] = useState<File | null>(null)
  const [decryptedVault, setDecryptedVault] = useState<VaultData | null>(null)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleDecrypt = async () => {
    if (!vaultFile || !vaultPassword) return;
    const text = await vaultFile.text();
    const data = decryptVault(text, vaultPassword);
    if (!data) {
      alert("Invalid password or corrupted vault file.");
    } else {
      setDecryptedVault(data);
    }
  }

  const toggleKeyword = (kw: string) => {
    setSelectedKeywords(prev => 
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    );
  }

  const onSubmit = async () => {
    if (!suspectUrl || selectedKeywords.length === 0 || !decryptedVault) return;
    setIsSubmitting(true);
    
    try {
      // 1 GEN reporting fee
      const reportFee = 10n ** 18n;

      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "report_leak",
        args: [
          BigInt(ndaId as string),
          suspectUrl,
          JSON.stringify(selectedKeywords),
          decryptedVault.salt,
        ],
        value: reportFee,
      });

      await client.waitForTransactionReceipt({
        hash,
        status: "FINALIZED" as never,
      });

      router.push(`/ndas/${ndaId}`);

    } catch (err) {
      console.error(err);
      alert(parseContractError(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto border-rose-200">
      <CardHeader>
        <CardTitle className="text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Report NDA Leak
        </CardTitle>
        <CardDescription>
          Reporting a false leak forfeits your 1 GEN reporter fee.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Suspect URL</label>
          <Input 
            placeholder="https://x.com/someone/status/123" 
            value={suspectUrl} 
            onChange={e => setSuspectUrl(e.target.value)} 
          />
        </div>

        {!decryptedVault ? (
          <div className="space-y-4 p-4 border rounded-md bg-slate-50 dark:bg-slate-900">
            <h3 className="font-semibold text-sm">Unlock Secret Vault</h3>
            <p className="text-xs text-slate-500">
              Upload the JSON vault you downloaded when creating this NDA.
            </p>
            <Input 
              type="file" 
              accept=".json" 
              onChange={e => setVaultFile(e.target.files?.[0] || null)} 
            />
            <Input 
              type="password" 
              placeholder="Vault Password" 
              value={vaultPassword} 
              onChange={e => setVaultPassword(e.target.value)} 
            />
            <Button onClick={handleDecrypt} disabled={!vaultFile || !vaultPassword}>
              Decrypt Vault
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded text-sm text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
              Vault decrypted successfully. Select the keywords you believe are leaked in the URL above.
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto border p-4 rounded-md">
              {decryptedVault.keywords.map(kw => (
                <div key={kw} className="flex items-center space-x-2">
                  <Checkbox 
                    id={`kw-${kw}`} 
                    checked={selectedKeywords.includes(kw)}
                    onCheckedChange={() => toggleKeyword(kw)}
                  />
                  <label 
                    htmlFor={`kw-${kw}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {kw}
                  </label>
                </div>
              ))}
            </div>

            <Button 
              className="w-full bg-rose-600 hover:bg-rose-700" 
              onClick={onSubmit}
              disabled={selectedKeywords.length === 0 || !suspectUrl || isSubmitting}
            >
              {isSubmitting ? "Submitting to AI Jury (this may take a few minutes)..." : "Pay 1 GEN & Submit Report"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
