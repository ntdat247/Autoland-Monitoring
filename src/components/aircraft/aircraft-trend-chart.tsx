"use client"

import { useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Chart as ChartJS, ChartOptions, TimeScale, LinearScale, Point, LineElement, Title, Tooltip, Legend } from "chart.js/auto"
import { Line as ChartReact } from "react-chartjs-2"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { Aircraft } from "@/types"

interface AircraftTrendChartProps {
  aircraft: Aircraft
  height?: number
}

export function AircraftTrendChart({ aircraft, height = 300 }: AircraftTrendChartProps) {
  const chartRef = useRef<ChartJS | null>(null)

  // Mock data - should be fetched from API
  const chartData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    datasets: [
      {
        label: "Success Rate (%)",
        data: [95, 96, 94, 97, 98, 95, 93, 94, 95, 96, 97, 98],
        borderColor: "#E31837", // VietJet Red
        backgroundColor: "rgba(227, 24, 55, 0.2)",
        borderWidth: 2,
        tension: 0.4,
        fill: true,
      },
      {
        label: "Total Autolands",
        data: [4, 5, 6, 5, 7, 6, 7, 8, 9, 10, 11, 12],
        borderColor: "#3B82F6", // Purple
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        tension: 0.4,
        fill: false,
      },
    ],
  }

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAt: 80,
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
            return value
          },
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
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
      title: {
        display: true,
        text: `Success Rate Trend - ${aircraft.aircraft_reg}`,
        color: "#111827",
        font: {
          size: 16,
          weight: "bold",
          family: "Inter, sans-serif",
        },
        padding: {
          bottom: 20,
        },
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
        callbacks: {
          title: function(context: any) {
            let label = context.dataset.label || ""
            const dataIndex = context.dataIndex

            if (context.parsed.y !== null) {
              if (dataIndex === 0) {
                const value = context.parsed.y + "%"
                const month = context.label
                label += `: ${value} Success Rate`
              } else if (dataIndex === 1) {
                const value = context.parsed.y
                const month = context.label
                label += `: ${value} Autolands`
              }
            }

            return label
          },
          label: function(context: any) {
            return context.label
          },
          body: function(tooltipItems: any[]) {
            const item = tooltipItems[0]
            const dataIndex = item.dataIndex
            const datasetIndex = item.datasetIndex
            const dataset = chartData.datasets[datasetIndex]
            const month = item.label

            let trendIcon: React.ReactNode = null
            const prevValue = dataIndex > 0 ? chartData.datasets[0].data[dataIndex - 1] : 0
            const currentValue = chartData.datasets[0].data[dataIndex]
            const trend = currentValue - prevValue

            if (trend > 0) {
              trendIcon = <TrendingUp className="w-4 h-4 text-success ml-2" />
            } else if (trend < 0) {
              trendIcon = <TrendingDown className="w-4 h-4 text-error ml-2" />
            }

            return `
              <div class="text-sm font-medium text-gray-900">
                ${month}
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-2xl font-bold ${datasetIndex === 0 ? "text-vj-red" : "text-purple-600"}">
                  ${item.formattedValue}
                </span>
                ${trendIcon}
              </div>
            `
          },
        },
      },
    },
    animation: {
      duration: 500,
      easing: "easeInOutQuart" as "easeInOutQuart",
    },
    interaction: {
      mode: "nearest" as const,
      intersect: false,
    },
    elements: {
      point: {
        radius: 3,
        hoverRadius: 5,
      },
    },
  }

  // Destroy chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy()
      }
    }
  }, [])

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle>Success Rate Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-500">
              Last 12 months trend
            </p>
            <p className="text-xs text-gray-400">
              {aircraft.aircraft_reg}
            </p>
          </div>
          {/* Mock data indicator */}
          <div className="text-xs text-gray-400 bg-yellow-100 px-2 py-1 rounded">
            Mock Data - API integration required
          </div>
        </div>
        <div style={{ height }}>
          <canvas ref={chartRef} />
        </div>
      </CardContent>
    </Card>
  )
}


