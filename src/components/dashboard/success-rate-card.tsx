"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SummaryCardSkeleton } from "@/components/shared/loading-skeleton"
import { useDashboardData } from "@/hooks/use-dashboard"
import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function SuccessRateCard() {
  const { stats, isLoading, error, refetch } = useDashboardData()

  // Auto-refresh every 5 minutes when there's an error
  useEffect(() => {
    if (error) {
      const interval = setInterval(() => {
        console.log("Auto-refreshing due to error...")
        refetch()
      }, 300000) // 5 minutes

      return () => clearInterval(interval)
    }
  }, [error, refetch])

  if (isLoading) {
    return <SummaryCardSkeleton />
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <CheckCircle2 className="w-8 h-8 text-vj-red" />
            <div className="text-right">
              <p className="text-sm font-medium text-vj-red">Error Loading Data</p>
              <button
                onClick={() => refetch()}
                className="text-xs text-vj-red hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
          <p className="text-gray-600 text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const successRateNum = stats?.successRate ? parseFloat(stats.successRate) : 0
  const bgColor = successRateNum > 0
    ? (successRateNum >= 95 ? "bg-success/10" : successRateNum >= 90 ? "bg-warning/10" : "bg-gray-100")
    : "bg-gray-100"
  const color = successRateNum > 0 ? "text-success" : "text-gray-900"
  const badge = successRateNum >= 95 ? "Excellent" : successRateNum >= 90 ? "Good" : successRateNum >= 80 ? "Fair" : null

  return (
    <Card className="hover:shadow-lg transition-shadow h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className={cn("p-3 rounded-lg", bgColor)}>
            <CheckCircle2 className={cn("w-6 h-6", color)} />
          </div>
          <div className="flex-1 ml-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-500">
                Success Rate
              </p>
              {badge && (
                <Badge 
                  variant={badge === "Excellent" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {badge}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="flex flex-col space-y-4">
          <div>
            <p className="text-3xl font-bold text-gray-900">
              {stats?.successRate || 0}%
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <p className="text-xs text-gray-500">
              Last 30 days
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

