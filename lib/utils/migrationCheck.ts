/**
 * Utility to check if database migrations have been applied
 * This helps catch migration issues before they cause runtime errors
 */

import { createAuthenticatedClient } from "@/lib/auth-server";

export interface MigrationStatus {
  hasOrganizationId: boolean;
  tablesChecked: string[];
  missingColumns: string[];
}

/**
 * Check if organization_id columns exist in required tables
 */
export async function checkOrganizationMigrationStatus(): Promise<MigrationStatus> {
  const tablesToCheck = [
    "blocks",
    "sub_blocks",
    "documents",
    "vector_chunks",
    "analytics_snapshots",
    "sessions",
    "user_memories",
  ];

  const missingColumns: string[] = [];
  const tablesChecked: string[] = [];

  try {
    const supabase = await createAuthenticatedClient();

    for (const tableName of tablesToCheck) {
      try {
        // Try to query the organization_id column
        const { error } = await supabase
          .from(tableName)
          .select("organization_id")
          .limit(0);

        if (error) {
          // Check if error is about missing column
          if (
            error.message?.includes("organization_id") ||
            error.message?.includes("column") ||
            error.code === "42703" // PostgreSQL undefined_column error code
          ) {
            missingColumns.push(`${tableName}.organization_id`);
          }
        } else {
          tablesChecked.push(tableName);
        }
      } catch (err) {
        // If we can't check, assume it's missing
        missingColumns.push(`${tableName}.organization_id`);
      }
    }

    return {
      hasOrganizationId: missingColumns.length === 0,
      tablesChecked,
      missingColumns,
    };
  } catch (error) {
    console.error("Error checking migration status:", error);
    // If we can't check, assume migrations haven't been run
    return {
      hasOrganizationId: false,
      tablesChecked: [],
      missingColumns: tablesToCheck.map((t) => `${t}.organization_id`),
    };
  }
}

/**
 * Get a user-friendly error message for missing migrations
 */
export function getMigrationErrorMessage(status: MigrationStatus): string {
  if (status.hasOrganizationId) {
    return "";
  }

  return `Database migrations have not been applied. Missing columns: ${status.missingColumns.join(", ")}. Please run the migrations in Supabase Dashboard or via CLI.`;
}
