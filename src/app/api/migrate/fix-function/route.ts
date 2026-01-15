import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { readFileSync } from "fs"
import { join } from "path"

// Force dynamic rendering - this route uses database
export const dynamic = 'force-dynamic'

/**
 * Temporary API endpoint to fix calculate_autoland_to_go function
 * This should be removed after migration is complete
 */
export async function POST() {
  try {
    // Read the migration file
    const migrationPath = join(
      process.cwd(),
      "database",
      "migrations",
      "003_fix_calculate_autoland_to_go.sql"
    )

    const migrationSQL = readFileSync(migrationPath, "utf-8")

    // Execute the migration
    await db.query(migrationSQL)

    return NextResponse.json({
      success: true,
      message: "Function calculate_autoland_to_go has been fixed successfully",
    })
  } catch (error: any) {
    console.error("Migration error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to run migration",
        message: error.message,
        details: error,
      },
      { status: 500 }
    )
  }
}

