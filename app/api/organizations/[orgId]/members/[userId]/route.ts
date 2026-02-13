import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { isDemoOrganizationId, isPublicDemoOrganizationId } from "@/lib/constants";

// PATCH - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const { orgId, userId } = await params;
    if (isDemoOrganizationId(orgId) || isPublicDemoOrganizationId(orgId)) {
      return NextResponse.json({ error: "Cannot modify members in demo organization" }, { status: 403 });
    }
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify requester is owner/admin
    const { data: requesterMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
      return NextResponse.json(
        { error: "Only owners and admins can update member roles" },
        { status: 403 }
      );
    }

    // Only owners can change roles to/from owner
    const { role } = await request.json();
    if (role === "owner" && requesterMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can assign owner role" },
        { status: 403 }
      );
    }

    // Check if target user is owner and requester is trying to change it
    const { data: targetMember } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .single();

    if (targetMember?.role === "owner" && requesterMembership.role !== "owner") {
      return NextResponse.json(
        { error: "Only owners can modify other owners" },
        { status: 403 }
      );
    }

    // Update role
    const { error: updateError } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// DELETE - Remove member from organization
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const { orgId, userId } = await params;
    if (isDemoOrganizationId(orgId) || isPublicDemoOrganizationId(orgId)) {
      return NextResponse.json({ error: "Cannot modify members in demo organization" }, { status: 403 });
    }
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can remove themselves, or owners/admins can remove others
    const isSelf = user.id === userId;

    if (!isSelf) {
      // Verify requester is owner/admin
      const { data: requesterMembership } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .single();

      if (!requesterMembership || !["owner", "admin"].includes(requesterMembership.role)) {
        return NextResponse.json(
          { error: "Only owners and admins can remove members" },
          { status: 403 }
        );
      }

      // Check if target user is owner
      const { data: targetMember } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", userId)
        .single();

      if (targetMember?.role === "owner") {
        return NextResponse.json(
          { error: "Cannot remove organization owner" },
          { status: 403 }
        );
      }
    }

    // Remove member
    const { error: deleteError } = await supabase
      .from("organization_members")
      .delete()
      .eq("organization_id", orgId)
      .eq("user_id", userId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
