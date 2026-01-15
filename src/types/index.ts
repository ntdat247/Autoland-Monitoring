// Aircraft Types
export interface Aircraft {
  id: number
  aircraft_reg: string
  last_autoland_date: string
  last_autoland_report_id: number | null
  next_required_date: string
  days_remaining: number
  status: 'ON_TIME' | 'DUE_SOON' | 'OVERDUE'
  updated_at: string
}

// Autoland Report Types
export interface AutolandReport {
  id: number
  report_number: string
  aircraft_reg: string
  flight_number: string
  airport: string
  runway: string
  captain: string | null
  first_officer: string | null
  date_utc: string
  time_utc: string
  datetime_utc: string
  wind_velocity: string | null
  td_point: string | null
  tracking: string | null
  qnh: number | null
  alignment: string | null
  speed_control: string | null
  temperature: number | null
  landing: string | null
  aircraft_dropout: string | null
  visibility_rvr: string | null  // Can be number (as string) or "CAVOK"
  other: string | null
  result: 'SUCCESSFUL' | 'UNSUCCESSFUL'
  reasons: string | null
  captain_signature: string | null
  email_id: string | null
  email_subject: string | null
  email_sender: string | null
  email_received_time: string | null
  pdf_filename: string
  pdf_storage_path: string
  pdf_storage_bucket: string
  processed_at: string
  extraction_status: string
  extraction_errors: string | null
  raw_extracted_text: string | null
  created_at: string
  updated_at: string
}

// Dashboard Stats Types
export interface DashboardStats {
  totalAircraft: number
  overdueCount: number
  dueSoonCount: number
  onTimeCount: number
  successRate: string
}

// Filter Types
export interface ReportFilters {
  aircraft_reg?: string
  date_from?: string
  date_to?: string
  result?: 'SUCCESSFUL' | 'UNSUCCESSFUL' | 'ALL'
  status?: string
  search?: string
  page?: number
  per_page?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface FleetFilters {
  status?: 'ON_TIME' | 'DUE_SOON' | 'OVERDUE' | 'ALL'
  station?: string
  sort_by?: 'days_remaining' | 'last_autoland_date' | 'aircraft_reg'
  sort_order?: 'asc' | 'desc'
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    per_page: number
    total: number
    total_pages: number
  }
}

// Audit Log Types
export interface AuditLog {
  id: number
  action: string
  entity_type: string | null
  entity_id: string | null
  user_id: string | null
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  ip_address: string | null
  created_at: string
}

// Dashboard Settings Types
export interface DashboardSettings {
  due_soon_threshold: number
  alert_recipients: string[]
  auto_refresh_interval: number
}

