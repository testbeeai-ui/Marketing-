import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { DEMO_ORGANIZATION_ID } from "@/lib/constants";

/**
 * POST - Create an access request (e.g. from demo mode users requesting to become a marketing member).
 * Body: { organization_id?, message?, details?: { linkedin?, twitter?, instagram?, facebook?, company_name? } }
 * If organization_id is omitted, defaults to Demo Organization.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId = body.organization_id ?? DEMO_ORGANIZATION_ID;
    const message = typeof body.message === "string" ? body.message.trim() || null : null;
    const detailsFromBody = body.details && typeof body.details === "object" ? body.details : {};
    const details = {
      ...detailsFromBody,
      email: user.email ?? undefined,
    };

    if (organizationId !== DEMO_ORGANIZATION_ID) {
      return NextResponse.json(
        { error: "Access requests are only supported for the demo organization" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from("access_requests")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        requested_role: "member",
        status: "pending",
        message: message ?? null,
        details,
      });

    if (insertError) {
      console.error("Error creating access request:", insertError);
      return NextResponse.json(
        { error: insertError.message || "Failed to submit request" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your request has been submitted. An admin will review it shortly.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
