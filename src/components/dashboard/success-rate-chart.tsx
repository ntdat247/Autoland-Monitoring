"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDashboardData } from "@/hooks/use-dashboard"
import {
  Chart as ChartJS,
  ChartOptions,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
} from "chart.js"
import { Line } from "react-chartjs-2"

// Register Chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement
)

interface SuccessRateChartProps {
  height?: number
  showLegend?: boolean
}

export function SuccessRateChart({ height = 300, showLegend = true }: SuccessRateChartProps) {
  const { stats, isLoading, refetch } = useDashboardData()

  // Mock data for chart - TODO: Replace with actual API data when available
  const mockLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const mockRates = [92, 94, 93, 95, 96, 94, 95, 97, 96, 98, 97, 98]
  const mockTotals = [45, 52, 48, 55, 60, 58, 62, 65, 58, 70, 68, 72]

  // Prepare chart data
  const chartData = {
    labels: mockLabels,
    datasets: [
      {
        label: "Success Rate (%)",
        data: mockRates,
        borderColor: "#E31837", // VietJet Red
        backgroundColor: "rgba(227, 24, 55, 0.2)",
        borderWidth: 2,
        tension: 0.1,
        fill: true,
      },
      {
        label: "Total Autolands",
        data: mockTotals,
        borderColor: "#3B82F6",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        tension: 0.1,
      },
    ],
  }

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 80,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + "%"
          },
        },
      },
      x: {
        ticks: {
          callback: function(value: any, index: number, ticks: any[]) {
            return mockLabels[index] || value
          },
        },
      },
    },
    plugins: {
      legend: {
        display: showLegend,
        position: "top" as const,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || ""
            if (context.parsed.y !== null) {
              return `${label}: ${context.parsed.y}${context.datasetIndex === 0 ? '%' : ''}`
            }
            return label
          },
          title: function(tooltipItems: any[]) {
            return tooltipItems[0]?.label || ''
          },
        },
      },
    },
    animation: {
      duration: 500,
      easing: "easeInOutQuart" as "easeInOutQuart",
    },
    interaction: {
      mode: "nearest" as "nearest",
      intersect: false,
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6,
      },
    },
  }


  if (isLoading || !stats) {
    return (
      <Card className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col min-h-[400px]">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Success Rate Trend</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-vj-red border-t-transparent rounded-full"></div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="rounded-xl border border-gray-200 bg-white text-gray-950 shadow-sm hover:shadow-lg transition-shadow h-full flex flex-col min-h-[400px]">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center justify-between">
          Success Rate Trend
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
      <CardContent className="flex-1 flex flex-col">
        {stats?.successRate && (
          <div className="mb-4 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-sm text-gray-500">
                Current Success Rate
              </p>
              <p className="text-2xl font-bold text-vj-red">
                {stats.successRate}%
              </p>
            </div>
          </div>
        )}
        <div className="flex-1" style={{ minHeight: height }}>
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}
