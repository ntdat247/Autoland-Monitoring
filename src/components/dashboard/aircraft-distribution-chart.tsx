"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/use-dashboard"
import {
  Chart as ChartJS,
  ChartOptions,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js"
import { Doughnut } from "react-chartjs-2"

// Register Chart.js components
ChartJS.register(Tooltip, Legend, ArcElement)

interface AircraftDistributionChartProps {
  showLegend?: boolean
  height?: number
}

export function AircraftDistributionChart({ showLegend = true, height = 300 }: AircraftDistributionChartProps) {
  const { stats, isLoading, refetch } = useDashboardData()

  // Prepare chart data
  const chartData = {
    labels: ["On Time", "Due Soon", "Overdue"],
    datasets: [
      {
        data: [stats?.onTimeCount || 0, stats?.dueSoonCount || 0, stats?.overdueCount || 0],
        backgroundColor: [
          "#10B981", // Green
          "#F59E0B", // Yellow
          "#EF4444", // Red
        ],
        borderColor: [
          "#059669",
          "#D97706",
          "#B91C1C",
        ],
        borderWidth: 2,
      },
    ],
  }

  const options: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: showLegend,
        position: "right" as const,
        labels: {
          color: "#6B7280",
          font: {
            size: 12,
            family: "Inter, sans-serif",
          },
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        enabled: true,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        titleFont: {
          size: 14,
          weight: "bold",
          family: "Inter, sans-serif",
        },
        bodyFont: {
          size: 12,
          family: "Inter, sans-serif",
        },
        callbacks: {
          label: function(context: any) {
            const label = context.label || ""
            const value = context.raw || 0
            const total = context.chart?.data?.datasets?.[0]?.data?.reduce((a: any, b: any) => a + b, 0) || stats?.totalAircraft || 1
            const percentage = ((value / total) * 100).toFixed(1)
            return `${label}: ${value} (${percentage}%)`
          },
        },
      },
    },
    cutout: "50%",
    elements: {
      arc: {
        borderWidth: 2,
        borderColor: "#ffffff",
      },
    },
  }


  if (isLoading || !stats) {
    return (
      <Card className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col min-h-[400px]">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Aircraft Distribution</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-vj-red border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    )
  }

  const totalAircraft = stats?.totalAircraft || 0

  return (
    <Card className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col min-h-[400px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          Aircraft Distribution
          {stats && (
            <button
              onClick={() => refetch()}
              className="text-xs text-vj-red hover:underline flex items-center gap-1"
              title="Refresh data"
            >
              🔄 Refresh
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          {/* Chart */}
          <div className="flex items-center justify-center">
            <div style={{ height: 250, maxWidth: "300px" }}>
              <Doughnut data={chartData} options={options} />
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-4 flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Total Aircraft: {totalAircraft}
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-success"></div>
                <div>
                  <p className="text-sm text-gray-600">On Time</p>
                  <p className="text-xs text-gray-500">{stats?.onTimeCount || 0}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-warning"></div>
                <div>
                  <p className="text-sm text-gray-600">Due Soon</p>
                  <p className="text-xs text-gray-500">{stats?.dueSoonCount || 0}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 rounded-full bg-error"></div>
                <div>
                  <p className="text-sm text-gray-600">Overdue</p>
                  <p className="text-xs text-gray-500">{stats?.overdueCount || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

