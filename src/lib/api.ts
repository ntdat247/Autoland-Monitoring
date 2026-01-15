/**
 * API Utility Functions
 * 
 * Common utilities for API operations including error handling,
 * response formatting, and standard response structures.
 */

/**
 * Standard success response
 */
export function successResponse(data: any) {
  return {
    success: true,
    data,
  }
}

/**
 * Standard error response
 */
export function errorResponse(
  error: string,
  message?: string,
  status: number = 500
) {
  const response = {
    success: false,
    error,
  }
  
  if (message) {
    Object.assign(response, { message })
  }
  
  return {
    ...response,
    status,
  }
}

/**
 * Paginated response with metadata
 */
export function paginatedResponse(
  items: any[],
  page: number,
  perPage: number,
  total: number,
  additionalData: Record<string, any> = {}
) {
  const totalPages = Math.ceil(total / perPage)
  
  return successResponse({
    items,
    pagination: {
      page,
      per_page: perPage,
      total,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
    ...additionalData,
  })
}

/**
 * Validate aircraft registration format
 */
export function validateAircraftReg(reg: string): boolean {
  const regex = /^VN-A\d{4}$/
  return regex.test(reg)
}

/**
 * Validate date format (YYYY-MM-DD)
 */
export function validateDate(date: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/
  return regex.test(date)
}

/**
 * Validate filter parameters
 */
export function validateFilters(filters: Record<string, any>): {
  valid: boolean,
  errors: string[]
} {
  const errors: string[] = []
  
  // Validate aircraft_reg
  if (filters.aircraft_reg && !validateAircraftReg(filters.aircraft_reg)) {
    errors.push("Invalid aircraft registration format. Expected: VN-A525")
  }
  
  // Validate date_from
  if (filters.date_from && !validateDate(filters.date_from)) {
    errors.push("Invalid date_from format. Expected: YYYY-MM-DD")
  }
  
  // Validate date_to
  if (filters.date_to && !validateDate(filters.date_to)) {
    errors.push("Invalid date_to format. Expected: YYYY-MM-DD")
  }
  
  // Validate status
  const validStatuses = ["ON_TIME", "DUE_SOON", "OVERDUE", "ALL"]
  if (filters.status && !validStatuses.includes(filters.status)) {
    errors.push("Invalid status. Expected: ON_TIME, DUE_SOON, OVERDUE, or ALL")
  }
  
  // Validate sort_by
  const validSortBys = ["days_remaining", "last_autoland_date", "aircraft_reg", "date_utc"]
  if (filters.sort_by && !validSortBys.includes(filters.sort_by)) {
    errors.push("Invalid sort_by. Expected: days_remaining, last_autoland_date, aircraft_reg, or date_utc")
  }
  
  // Validate sort_order
  const validSortOrders = ["asc", "desc"]
  if (filters.sort_order && !validSortOrders.includes(filters.sort_order)) {
    errors.push("Invalid sort_order. Expected: asc or desc")
  }
  
  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Build WHERE clause from filters
 */
export function buildWhereClause(filters: Record<string, any>): {
  whereClause: string
  params: any[]
} {
  const conditions: string[] = []
  const params: any[] = []
  
  // Aircraft filter
  if (filters.aircraft_reg) {
    conditions.push(`aircraft_reg = '${filters.aircraft_reg}'`)
  }
  
  // Date range filter
  if (filters.date_from) {
    conditions.push(`date_utc >= '${filters.date_from}'`)
    params.push(filters.date_from)
  }
  
  if (filters.date_to) {
    conditions.push(`date_utc <= '${filters.date_to}'`)
    params.push(filters.date_to)
  }
  
  // Status filter
  if (filters.status && filters.status !== "ALL") {
    conditions.push(`result = '${filters.result}'`)
  }
  
  // Search filter (search in report_number, captain, flight_number)
  if (filters.search) {
    conditions.push(`(report_number ILIKE '%${filters.search}%' OR captain ILIKE '%${filters.search}%' OR flight_number ILIKE '%${filters.search}%')`)
    params.push(`%${filters.search}%`)
  }
  
  if (conditions.length > 0) {
    return {
      whereClause: `WHERE ${conditions.join(" AND ")}`,
      params,
    }
  }
  
  return {
    whereClause: "WHERE 1=1",
    params: [],
  }
}

/**
 * Log API request (for debugging and monitoring)
 */
export function logApiRequest(
  method: string,
  endpoint: string,
  filters?: Record<string, any>,
  params?: any,
) {
  console.log(`[${new Date().toISOString()}] API Request:`, {
    method,
    endpoint,
    filters: filters || {},
    params: params || {},
  })
}

/**
 * Handle database errors with proper logging
 */
export function handleDatabaseError(
  error: any,
  operation: string,
  context?: Record<string, any>,
) {
  console.error(`[${new Date().toISOString()}] Database Error:`, {
    operation,
    error: error instanceof Error ? error.message : String(error),
    context: context || {},
  })
  
  // Return user-friendly error message
  if (error instanceof Error) {
    if (error.message.includes("connection")) {
      return "Database connection failed. Please try again later."
    } else if (error.message.includes("timeout")) {
      return "Request timed out. Please try again."
    } else {
      return "An unexpected error occurred. Our team has been notified."
    }
  }
  
  return "An error occurred. Please try again."
}


