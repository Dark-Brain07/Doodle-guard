import { Badge } from "@/components/ui/badge"

export function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-slate-500"
  let label = status

  switch (status) {
    case "pending":
      colorClass = "bg-slate-500 hover:bg-slate-600 text-white"
      label = "Pending"
      break
    case "active":
      colorClass = "bg-emerald-500 hover:bg-emerald-600 text-white"
      label = "Active"
      break
    case "leaked":
      colorClass = "bg-rose-500 hover:bg-rose-600 text-white"
      label = "Leaked"
      break
    case "expired":
    case "cancelled":
      colorClass = "bg-slate-400 hover:bg-slate-500 text-white"
      label = status === "expired" ? "Expired" : "Cancelled"
      break
    case "disputed":
    case "appeal_pending":
      colorClass = "bg-amber-500 hover:bg-amber-600 text-white"
      label = "Disputed"
      break
  }

  return <Badge className={colorClass}>{label}</Badge>
}
