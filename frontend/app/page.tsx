import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Shield,
  BrainCircuit,
  Zap,
  Users,
  Code,
  Scale,
  AlertTriangle,
  FileSignature,
  CheckCircle2,
  Gavel,
  Coins,
} from "lucide-react"
import Link from "next/link"
import { ConnectWalletButton } from "@/components/ConnectWalletButton"

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex h-16 items-center px-6 border-b bg-card">
        <div className="flex items-center gap-2 font-bold text-xl">
          <Shield className="h-6 w-6 text-purple-600" />
          <span>DoodleGuard</span>
        </div>
        <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
          <Link href="/ndas" className="text-sm font-medium hover:underline underline-offset-4">
            Dashboard
          </Link>
          <Link
            href="/report"
            className="text-sm font-medium text-rose-600 dark:text-rose-400 hover:underline underline-offset-4 flex items-center gap-1"
          >
            <AlertTriangle className="w-4 h-4" />
            Report Leak
          </Link>
          <Link href="/violations" className="text-sm font-medium hover:underline underline-offset-4 hidden sm:block">
            Violations Log
          </Link>
          <div className="ml-4">
            <ConnectWalletButton />
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-background">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  NDA enforcement at the speed of consensus
                </h1>
                <p className="mx-auto max-w-[700px] text-slate-500 md:text-xl dark:text-slate-400">
                  AI Jury detects leaks. Smart contracts slash violators. No $200k lawsuits. No 2-year waits.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/ndas/new">
                  <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white">
                    <FileSignature className="w-4 h-4 mr-2" />
                    Create NDA
                  </Button>
                </Link>
                <Link href="/report">
                  <Button size="lg" variant="destructive">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Report a Leak
                  </Button>
                </Link>
                <Link href="/ndas">
                  <Button variant="outline" size="lg">
                    View My NDAs
                  </Button>
                </Link>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 pt-2 max-w-[600px]">
                Party to an existing NDA? Skip creation and{" "}
                <Link href="/report" className="text-rose-600 dark:text-rose-400 underline">
                  submit a leak report
                </Link>{" "}
                — the AI Jury will fetch the suspect URL on-chain and rule within minutes.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-20 border-b">
          <div className="container px-4 md:px-6 mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tighter">
                Full protocol lifecycle
              </h2>
              <p className="text-slate-500 dark:text-slate-400 mt-2">
                Both sides of the NDA use the same app: creators lock the secret in,
                either party reports a leak, and the AI Jury adjudicates on-chain.
              </p>
            </div>
            <ol className="grid gap-6 md:grid-cols-5">
              {[
                {
                  n: "1",
                  icon: <FileSignature className="w-5 h-5" />,
                  title: "Create",
                  body: "Party A commits keyword hashes and stakes GEN.",
                  href: "/ndas/new",
                  cta: "Create NDA",
                },
                {
                  n: "2",
                  icon: <CheckCircle2 className="w-5 h-5" />,
                  title: "Activate",
                  body: "Party B matches the stake to activate the NDA.",
                  href: "/ndas",
                  cta: "My NDAs",
                },
                {
                  n: "3",
                  icon: <AlertTriangle className="w-5 h-5" />,
                  title: "Report Leak",
                  body: "Either party submits a suspect URL + the leaked keywords.",
                  href: "/report",
                  cta: "Report a Leak",
                  highlight: true,
                },
                {
                  n: "4",
                  icon: <BrainCircuit className="w-5 h-5" />,
                  title: "AI Jury Verdict",
                  body: "Validators fetch primary + Wayback + Google, agree on the verdict via prompt_comparative.",
                },
                {
                  n: "5",
                  icon: <Gavel className="w-5 h-5" />,
                  title: "Appeal or Slash",
                  body: "7-day appeal window. Escrow splits 80/17/3 on finalize.",
                },
              ].map((step) => (
                <li
                  key={step.n}
                  className={`rounded-lg border p-4 flex flex-col gap-2 ${
                    step.highlight
                      ? "border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/20"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        step.highlight
                          ? "bg-rose-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800"
                      }`}
                    >
                      {step.n}
                    </span>
                    {step.icon}
                    <span>{step.title}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 flex-1">
                    {step.body}
                  </p>
                  {step.href && step.cta && (
                    <Link
                      href={step.href}
                      className={`text-xs font-medium underline underline-offset-2 ${
                        step.highlight
                          ? "text-rose-700 dark:text-rose-300"
                          : "text-purple-700 dark:text-purple-300"
                      }`}
                    >
                      {step.cta} →
                    </Link>
                  )}
                </li>
              ))}
            </ol>
            <div className="mt-8 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
              <Coins className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <b>Reviewer note.</b> To test the leak-report flow end-to-end you
                need to be Party A or Party B of an active NDA. If you don&apos;t
                want to create one, ask the team for a demo NDA ID and open
                <Link href="/report" className="underline mx-1">
                  /report
                </Link>
                to submit against it.
              </div>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-8 sm:grid-cols-3">
              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-purple-100 dark:bg-purple-900/50 rounded-full">
                    <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold">Commit-Reveal Privacy</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Your confidential terms never go on-chain. Only cryptographic hashes are stored. Secrets stay in your browser.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                    <BrainCircuit className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold">AI Jury Verification</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    GenLayer validators run intelligent consensus to semantically evaluate suspected leaks against your protected terms.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-none bg-transparent">
                <CardContent className="flex flex-col items-center text-center space-y-4 p-6">
                  <div className="p-4 bg-rose-100 dark:bg-rose-900/50 rounded-full">
                    <Zap className="h-8 w-8 text-rose-600 dark:text-rose-400" />
                  </div>
                  <h3 className="text-xl font-bold">Automated Slashing</h3>
                  <p className="text-slate-500 dark:text-slate-400">
                    Violators automatically lose their staked GEN collateral. The reporter is immediately rewarded. Trustless enforcement.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-background border-t">
          <div className="container px-4 md:px-6 mx-auto text-center space-y-12">
            <h2 className="text-3xl font-bold tracking-tighter">Built for Modern Businesses</h2>
            <div className="grid gap-8 sm:grid-cols-3">
              <div className="flex flex-col items-center space-y-2">
                <Users className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">M&A Advisors</h4>
                <p className="text-sm text-slate-500">Protect deal pricing and buyer lists.</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Code className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">Tech Startups</h4>
                <p className="text-sm text-slate-500">Secure source code and product roadmaps.</p>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <Scale className="h-10 w-10 text-slate-400" />
                <h4 className="font-bold">Litigation</h4>
                <p className="text-sm text-slate-500">Enforce out-of-court settlement privacy.</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
