import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { APP_ADMIN_EMAILS } from "@/lib/constants";

/**
 * GET /api/admin/access-requests
 * List all access requests. Only app admins (APP_ADMIN_EMAILS) can call this.
 * Uses service role to bypass RLS so admin can see all requests.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = auth;

    const isAppAdmin = user?.email && APP_ADMIN_EMAILS.includes(user.email.toLowerCase());
    if (!isAppAdmin) {
      return NextResponse.json({ error: "Forbidden: app admin only" }, { status: 403 });
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: "Server misconfiguration: admin access requires SUPABASE_SERVICE_ROLE_KEY" },
        { status: 503 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: rows, error } = await supabaseAdmin
      .from("access_requests")
      .select("id, user_id, organization_id, status, message, details, requested_role, created_at, reviewed_at, reviewed_by")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error listing access requests:", error);
      return NextResponse.json(
        { error: error.message || "Failed to list access requests" },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: rows ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
