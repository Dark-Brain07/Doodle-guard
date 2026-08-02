import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { StatusBadge } from "./StatusBadge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { AlertTriangle } from "lucide-react"

interface NDACardProps {
  id: string
  counterparty: string
  scope: string
  status: string
  stake: string
  expiryTimestamp: string
}

export function NDACard({ id, counterparty, scope, status, stake, expiryTimestamp }: NDACardProps) {
  const expiryDate = new Date(parseInt(expiryTimestamp) * 1000)
  const isExpired = expiryDate < new Date()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-bold">
          NDA #{id}
        </CardTitle>
        <StatusBadge status={status} />
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-slate-500">
          <div className="flex justify-between">
            <span>Counterparty:</span>
            <span className="font-mono">{counterparty.substring(0, 6)}...{counterparty.substring(38)}</span>
          </div>
          <div className="flex justify-between">
            <span>Scope:</span>
            <span className="capitalize">{scope.replace("_", " ")}</span>
          </div>
          <div className="flex justify-between">
            <span>Stake:</span>
            <span>{parseFloat(stake) / 1e18} GEN</span>
          </div>
          <div className="flex justify-between">
            <span>Expires:</span>
            <span>{isExpired ? "Expired" : formatDistanceToNow(expiryDate, { addSuffix: true })}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Link href={`/ndas/${id}`} className="w-full">
          <Button variant="outline" className="w-full">View Details</Button>
        </Link>
        {status === "active" && !isExpired && (
          <Link href={`/ndas/${id}/report`} className="w-full">
            <Button variant="destructive" className="w-full">
              <AlertTriangle className="w-4 h-4 mr-1" />
              Report Leak
            </Button>
          </Link>
        )}
      </CardFooter>
    </Card>
  )
}
