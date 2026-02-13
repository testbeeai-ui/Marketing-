import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { APP_ADMIN_EMAILS } from "@/lib/constants";

/**
 * PATCH /api/admin/access-requests/[id]
 * Approve or reject an access request. Only app admins can call this.
 * Body: { status: "approved" | "rejected" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing request id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const status = body.status === "approved" || body.status === "rejected" ? body.status : null;
    if (!status) {
      return NextResponse.json(
        { error: "Body must include status: 'approved' or 'rejected'" },
        { status: 400 }
      );
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

    const { data, error } = await supabaseAdmin
      .from("access_requests")
      .update({
        status,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, status, reviewed_at")
      .single();

    if (error) {
      console.error("Error updating access request:", error);
      return NextResponse.json(
        { error: error.message || "Failed to update request" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ error: "Access request not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
