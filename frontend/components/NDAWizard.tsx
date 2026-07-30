"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  assertWritable,
  client,
  CONTRACT_ADDRESS,
  ensureCorrectChainBeforeWrite,
  explorerTxUrl,
  WalletNotReadyError,
} from "@/lib/genlayer"
import { parseGenAmount } from "@/lib/amount"
import { generateSalt, hashKeyword } from "@/lib/crypto"
import { downloadVaultFile } from "@/lib/vault"
import { parseContractError } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, Download, Check } from "lucide-react"

const ALLOWED_SCOPES = [
  "ma_pricing", "product_roadmap", "source_code", "personal_info",
  "financial_data", "trade_secret", "employment_terms", "litigation_info",
  "research_data", "customer_list", "other"
]

const formSchema = z.object({
  counterpartyHex: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  scope: z.string().min(1, "Required"),
  contextDescription: z.string().min(10).max(500),
  expiryDate: z.string().min(1, "Required"),
  keywordsText: z.string().min(1, "Required"),
  vaultPassword: z.string().min(6, "Minimum 6 characters"),
  stakeAmount: z.string().regex(/^\d+(\.\d+)?$/, "Must be a valid number"),
})

export function NDAWizard() {
  const [step, setStep] = useState(1)
  const [salt, setSalt] = useState("")
  const [keywordsList, setKeywordsList] = useState<string[]>([])
  const [downloaded, setDownloaded] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastTxHash, setLastTxHash] = useState<string | null>(null)
  const router = useRouter()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      counterpartyHex: "",
      scope: "",
      contextDescription: "",
      expiryDate: "",
      keywordsText: "",
      vaultPassword: "",
      stakeAmount: "100",
    },
  })

  const handleGenerateSalt = () => {
    setSalt(generateSalt())
    const kwText = form.getValues("keywordsText")
    setKeywordsList(kwText.split("\n").map(k => k.trim()).filter(k => k.length > 0))
  }

  const handleDownloadVault = () => {
    const password = form.getValues("vaultPassword")
    if (!password) {
      alert("Please enter a vault password first")
      return
    }
    const data = {
      keywords: keywordsList,
      salt,
      nda_context: form.getValues("contextDescription")
    }
    downloadVaultFile(data, password, "nda_secret_vault.json")
    setDownloaded(true)
  }

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!downloaded) {
      alert("You must download your Secret Vault first!")
      return
    }
    
    setIsSubmitting(true)
    try {
      await assertWritable()

      const hashes = keywordsList.map(kw => hashKeyword(kw, salt))
      const hashesJson = JSON.stringify(hashes)

      const expiryTimestamp = BigInt(
        Math.floor(new Date(values.expiryDate).getTime() / 1000)
      )
      const weiAmount = parseGenAmount(values.stakeAmount)

      await ensureCorrectChainBeforeWrite()
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: "create_nda",
        args: [
          values.counterpartyHex,
          values.scope,
          values.contextDescription,
          expiryTimestamp,
          hashesJson,
        ],
        value: weiAmount,
      })
      setLastTxHash(hash)

      // ACCEPTED = leader executed + validators agreed. FINALIZED needs
      // the full appeal window (~5+ min) to close — not a good UI block.
      await client.waitForTransactionReceipt({
        hash,
        status: "ACCEPTED" as never,
        retries: 120,
        interval: 3000,
      })

      router.push("/ndas")

    } catch (err) {
      console.error(err)
      if (err instanceof WalletNotReadyError) {
        alert(err.message)
      } else {
        alert(parseContractError(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New NDA - Step {step} of 3</CardTitle>
        <CardDescription>
          {step === 1 && "Counterparty & Basics"}
          {step === 2 && "Protected Keywords & Secret Vault"}
          {step === 3 && "Stake & Confirm"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {step === 1 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="counterpartyHex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Counterparty Address</FormLabel>
                      <FormControl>
                        <Input placeholder="0x..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scope Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a scope" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ALLOWED_SCOPES.map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="contextDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Public Context</FormLabel>
                      <FormControl>
                        <Textarea placeholder="e.g. Series B negotiations between Acme & Sequoia" {...field} />
                      </FormControl>
                      <FormDescription>This will be public on-chain to provide context to the AI Jury.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="button" onClick={() => form.trigger(["counterpartyHex", "scope", "contextDescription", "expiryDate"]).then(v => v && setStep(2))}>
                  Next: Keywords
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-md flex items-start gap-3 text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="w-5 h-5 mt-0.5" />
                  <p className="text-sm">
                    <strong>CRITICAL:</strong> These keywords NEVER leave your browser. They are hashed locally and only the hashes go on-chain.
                  </p>
                </div>

                <FormField
                  control={form.control}
                  name="keywordsText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Protected Keywords (One per line)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="$45M Series B&#10;0.7% discount" rows={5} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!salt ? (
                  <Button type="button" onClick={handleGenerateSalt} variant="secondary">
                    Generate Salt & Hashes
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <FormLabel>Generated Salt</FormLabel>
                      <code className="block p-2 bg-slate-100 dark:bg-slate-800 rounded mt-1 font-mono text-sm break-all">
                        {salt}
                      </code>
                    </div>

                    <div className="space-y-2">
                      <FormLabel>Hash Preview (Stored on-chain)</FormLabel>
                      <div className="max-h-32 overflow-y-auto bg-slate-50 dark:bg-slate-900 rounded border p-2 space-y-1">
                        {keywordsList.map((k, i) => (
                          <div key={i} className="text-xs font-mono flex gap-2">
                            <span className="text-slate-500 w-24 truncate">{k}</span>
                            <span className="text-slate-400">→</span>
                            <span className="truncate">{hashKeyword(k, salt)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="vaultPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secret Vault Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Strong password" {...field} />
                          </FormControl>
                          <FormDescription>Used to encrypt your local JSON vault file.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button type="button" onClick={handleDownloadVault} disabled={downloaded} className="bg-emerald-600 hover:bg-emerald-700">
                        {downloaded ? <Check className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                        {downloaded ? "Vault Downloaded" : "Download Secret Vault"}
                      </Button>
                      
                      {downloaded && (
                        <Button type="button" onClick={() => setStep(3)}>
                          Next: Stake
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="stakeAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Stake Amount (GEN)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} />
                      </FormControl>
                      <FormDescription>This will be slashed if you violate the NDA.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md">
                  <h4 className="font-semibold mb-2">Summary</h4>
                  <ul className="text-sm space-y-1 text-slate-600 dark:text-slate-400">
                    <li><strong>Counterparty:</strong> {form.getValues("counterpartyHex")}</li>
                    <li><strong>Scope:</strong> {form.getValues("scope")}</li>
                    <li><strong>Keywords Protected:</strong> {keywordsList.length}</li>
                    <li><strong>Stake:</strong> {form.getValues("stakeAmount")} GEN</li>
                  </ul>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit" disabled={!downloaded || isSubmitting}>
                    {isSubmitting ? "Awaiting consensus…" : "Create NDA & Stake"}
                  </Button>
                </div>
                {isSubmitting && (
                  <p className="text-xs text-slate-500 pt-2">
                    A non-deterministic transaction ran through GenLayer consensus can take
                    30 s – 3 min depending on validator load. Keep this tab open.
                  </p>
                )}
                {lastTxHash && (
                  <div className="text-xs text-slate-500 pt-2">
                    Tx:{" "}
                    <a
                      href={explorerTxUrl(lastTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {lastTxHash.substring(0, 10)}…{lastTxHash.substring(60)}
                    </a>
                  </div>
                )}
              </div>
            )}

          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
