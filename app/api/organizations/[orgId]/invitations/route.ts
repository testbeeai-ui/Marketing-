import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { sendInvitationEmail } from "@/lib/email";
import { getAppBaseUrl } from "@/lib/app-url";

function generateInvitationCode(orgName: string): string {
  const prefix = orgName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "A");
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

// GET - List all invitations for an organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
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
        { error: "Only admins and owners can view invitations" },
        { status: 403 }
      );
    }

    // Fetch all invitations for this organization
    const { data: invitations, error } = await supabase
      .from("organization_invitations")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format invitations with invite URLs (safe base so links never show "undefined")
    const baseUrl = getAppBaseUrl(request);
    const formattedInvitations = (invitations || []).map((inv) => ({
      id: inv.id,
      email: inv.email,
      invitation_code: inv.invitation_code,
      role: inv.role,
      status: inv.status,
      created_at: inv.created_at,
      expires_at: inv.expires_at,
      uses_count: inv.uses_count || 0,
      max_uses: inv.max_uses || 1,
      invite_url: `${baseUrl}/invite/${inv.invitation_code}`,
    }));

    return NextResponse.json({ invitations: formattedInvitations });
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
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
        { error: "Only admins and owners can create invitations" },
        { status: 403 }
      );
    }

    const { email, role = "member" } = await request.json();

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Get organization name for code generation
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

    // Generate invitation code
    const invitationCode = generateInvitationCode(org.name);
    const inviteUrl = `${getAppBaseUrl(request)}/invite/${invitationCode}`;

    // Create invitation
    const { data: invitation, error } = await supabase
      .from("organization_invitations")
      .insert({
        organization_id: orgId,
        created_by: user.id,
        email: email.trim(),
        invitation_code: invitationCode,
        role,
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(), // 7 days
        max_uses: 1,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send invitation email
    const emailResult = await sendInvitationEmail({
      to: email.trim(),
      organizationName: org.name,
      invitationCode,
      inviteUrl,
      inviterName: user.email?.split("@")[0] || "Team",
    });

    // Log email sending result
    if (!emailResult.success) {
      console.warn("Failed to send invitation email:", emailResult.error);
      // Still return success - the invitation is created, admin can manually send the link
      // But include a warning in the response
    }

    return NextResponse.json({
      success: true,
      invitation_code: invitationCode,
      invite_url: inviteUrl,
      invitation,
      email_sent: emailResult.success,
      email_error: emailResult.error || undefined,
      message: emailResult.success 
        ? "Invitation created and email sent successfully"
        : `Invitation created but email not sent: ${emailResult.error}. Please configure email service (see EMAIL_SETUP_QUICK_START.md) or share the invitation link manually.`,
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
