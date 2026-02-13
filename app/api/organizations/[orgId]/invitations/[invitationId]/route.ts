import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";

// DELETE - Revoke/delete an invitation
export async function DELETE(
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
        { error: "Only admins and owners can revoke invitations" },
        { status: 403 }
      );
    }

    // Update invitation status to revoked (or delete it)
    const { error: updateError } = await supabase
      .from("organization_invitations")
      .update({ status: "revoked" })
      .eq("id", invitationId)
      .eq("organization_id", orgId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
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
