import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null | undefined, format: 'short' | 'long' | 'full' = 'short'): string {
  if (!date) return 'N/A'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Check if date is valid
  if (isNaN(d.getTime())) return 'N/A'
  
  const formatOptions: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: '2-digit' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
    full: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
  }
  const options = formatOptions[format]

  return d.toLocaleDateString('vi-VN', options)
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return 'N/A'
  
  const d = typeof date === 'string' ? new Date(date) : date
  
  // Check if date is valid
  if (isNaN(d.getTime())) return 'N/A'
  
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTime(time: string | Date | null | undefined): string {
  if (!time) return 'N/A'
  
  // If it's already a Date object, format it
  if (time instanceof Date) {
    if (isNaN(time.getTime())) return 'N/A'
    return time.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  
  // If it's a string, check if it's a TIME format (HH:mm or HH:mm:ss)
  if (typeof time === 'string') {
    // Check if it's a TIME format (HH:mm or HH:mm:ss)
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
    if (timeMatch) {
      // It's a TIME string, return as is (or format it)
      const hours = timeMatch[1].padStart(2, '0')
      const minutes = timeMatch[2]
      return `${hours}:${minutes}`
    }
    
    // Try to parse as Date
    const d = new Date(time)
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  }
  
  return 'N/A'
}

export function getDaysRemaining(nextRequiredDate: string | Date | null | undefined): number {
  if (!nextRequiredDate) return 0
  
  const now = new Date()
  const target = typeof nextRequiredDate === 'string' ? new Date(nextRequiredDate) : nextRequiredDate
  
  // Check if date is valid
  if (isNaN(target.getTime())) return 0
  
  const diffTime = target.getTime() - now.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ON_TIME: 'bg-green-100 text-green-700',
    DUE_SOON: 'bg-yellow-100 text-yellow-700',
    OVERDUE: 'bg-red-100 text-red-700',
    SUCCESSFUL: 'bg-green-100 text-green-700',
    UNSUCCESSFUL: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    ON_TIME: 'Đúng hạn',
    DUE_SOON: 'Sắp đến hạn',
    OVERDUE: 'Quá hạn',
    SUCCESSFUL: 'Thành công',
    UNSUCCESSFUL: 'Thất bại',
  }
  return labels[status] || status
}

export function calculateProgress(daysRemaining: number, totalDays: number = 30): number {
  const progress = ((totalDays - daysRemaining) / totalDays) * 100
  return Math.min(100, Math.max(0, progress))
}

export function getProgressColor(percentage: number): string {
  if (percentage < 50) return 'bg-vj-red'
  if (percentage < 80) return 'bg-vj-yellow'
  return 'bg-green-500'
}

export function truncateText(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num)
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateAircraftReg(reg: string): boolean {
  // VN-AXXX format
  const regRegex = /^VN-A\d{4}$/
  return regRegex.test(reg)
}

export function validateFlightNumber(flightNumber: string): boolean {
  // VJXXX format
  const flightRegex = /^VJ\d{3}$/
  return flightRegex.test(flightNumber)
}

export function generatePagination(
  currentPage: number,
  totalPages: number,
  maxVisiblePages: number = 5
): (number | '...' | 'prev' | 'next')[] {
  const pages: (number | '...' | 'prev' | 'next')[] = []
  
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i)
    }
    return pages
  }
  
  pages.push('prev')
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
  
  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }
  
  if (startPage > 1) {
    pages.push(1)
    if (startPage > 2) pages.push('...')
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i)
  }
  
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...')
    pages.push(totalPages)
  }
  
  pages.push('next')
  
  return pages
}

