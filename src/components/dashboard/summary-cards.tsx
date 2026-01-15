"use client"

import { useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { SummaryCardSkeleton } from "@/components/shared/loading-skeleton"
import { useDashboardData } from "@/hooks/use-dashboard"
import { Plane, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function SummaryCards() {
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
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="w-8 h-8 text-vj-red" />
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
      </div>
    )
  }

  const totalAircraft = stats?.totalAircraft ?? 0
  const overdueCount = stats?.overdueCount ?? 0
  const dueSoonCount = stats?.dueSoonCount ?? 0
  const successRateNum = stats?.successRate ? parseFloat(stats.successRate) : 0

  const cards = [
    {
      title: "Total Aircraft",
      value: totalAircraft,
      icon: Plane,
      color: "text-vj-red",
      bgColor: "bg-vj-red/10",
      badge: totalAircraft > 0 ? (totalAircraft > 50 ? "Large Fleet" : "Normal") : null,
    },
    {
      title: "Overdue",
      value: overdueCount,
      icon: AlertTriangle,
      color: overdueCount > 0 ? "text-error" : "text-gray-900",
      bgColor: overdueCount > 0 ? "bg-error/10" : "bg-gray-100",
      badge: overdueCount > 0 ? "Critical" : null,
    },
    {
      title: "Due Soon",
      value: dueSoonCount,
      icon: TrendingUp,
      color: "text-warning",
      bgColor: "bg-warning/10",
      badge: dueSoonCount > 0 ? "Warning" : null,
    },
    {
      title: "Success Rate",
      value: `${stats?.successRate || 0}%`,
      icon: CheckCircle2,
      color: successRateNum > 0 ? "text-success" : "text-gray-900",
      bgColor: successRateNum > 0 ? (successRateNum >= 95 ? "bg-success/10" : successRateNum >= 90 ? "bg-warning/10" : "bg-gray-100") : "bg-gray-100",
      badge: successRateNum >= 95 ? "Excellent" : successRateNum >= 90 ? "Good" : successRateNum >= 80 ? "Fair" : null,
    },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">📊 Fleet Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className={cn("p-3 rounded-lg", card.bgColor)}>
                  <card.icon className={cn("w-6 h-6", card.color)} />
                </div>
                <div className="flex-1 ml-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-500">
                      {card.title}
                    </p>
                    {card.badge && (
                      <Badge 
                        variant={
                          card.badge === "Critical" 
                            ? "destructive" 
                            : card.badge === "Warning" 
                            ? "secondary" 
                            : card.badge === "Excellent" 
                            ? "default" 
                            : "default"
                        } 
                        className="text-xs"
                      >
                        {card.badge}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold text-gray-900">
                  {card.value}
                </p>
                <div className="flex gap-2 items-center">
                  <p className="text-xs text-gray-500">
                    {card.title === "Success Rate" ? "Last 30 days" : "Total"}
                  </p>
                  {card.title === "Overdue" && overdueCount > 0 && (
                    <TrendingUp className="w-4 h-4 text-error animate-pulse" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
