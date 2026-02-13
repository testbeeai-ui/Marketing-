import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { sendInvitationEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/app-url";

// POST - Resend invitation email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; invitationId: string }> }
) {
  try {
    const { orgId, invitationId } = await params;
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is admin/owner of organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only admins and owners can resend invitations" },
        { status: 403 }
      );
    }

    // Get invitation
    const { data: invitation, error: invError } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("organization_id", orgId)
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (!invitation.email) {
      return NextResponse.json(
        { error: "This invitation has no email address" },
        { status: 400 }
      );
    }

    if (invitation.status !== "pending") {
      return NextResponse.json(
        { error: "Can only resend pending invitations" },
        { status: 400 }
      );
    }

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const inviteUrl = `${getAppBaseUrl(request)}/invite/${invitation.invitation_code}`;

    // Send invitation email
    const emailResult = await sendInvitationEmail({
      to: invitation.email,
      organizationName: org.name,
      invitationCode: invitation.invitation_code,
      inviteUrl,
      inviterName: user.email?.split("@")[0] || "Team",
    });

    return NextResponse.json({
      success: true,
      email_sent: emailResult.success,
      email_error: emailResult.error || undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
