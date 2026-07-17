import { Verdict } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldAlert, Info } from "lucide-react"

export function VerdictPanel({ verdict }: { verdict: Verdict }) {
  if (!verdict) return null;

  return (
    <Card className="border-rose-200 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/50">
      <CardHeader>
        <CardTitle className="text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          AI Jury Verdict: Violation Confirmed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {verdict.reasoning}
        </p>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-rose-200/50 dark:border-rose-900/50">
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Confidence</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{verdict.confidence}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Match Score</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{verdict.match_score}/100</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Specificity</p>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{verdict.specificity_score}/100</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">Intent</p>
            <p className="text-lg font-bold capitalize text-slate-700 dark:text-slate-300">{verdict.intent}</p>
          </div>
        </div>

        {verdict.evidence_quote && (
          <div className="mt-4 p-4 bg-white dark:bg-[#1A1D24] rounded border border-rose-100 dark:border-rose-900/50">
            <p className="text-xs text-slate-500 uppercase font-semibold mb-2 flex items-center gap-1">
              <Info className="w-3 h-3" />
              Evidence Quote
            </p>
            <blockquote className="text-sm italic border-l-2 border-rose-300 pl-3 text-slate-700 dark:text-slate-300">
              &ldquo;{verdict.evidence_quote}&rdquo;
            </blockquote>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
