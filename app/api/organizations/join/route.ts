import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invitation_code } = await request.json();

    if (!invitation_code) {
      return NextResponse.json(
        { error: "Invitation code is required" },
        { status: 400 }
      );
    }

    // Find invitation
    const { data: invitation, error: invError } = await supabase
      .from("organization_invitations")
      .select("*, organization:organizations(*)")
      .eq("invitation_code", invitation_code.toUpperCase().trim())
      .eq("status", "pending")
      .single();

    if (invError || !invitation) {
      return NextResponse.json(
        { error: "Invalid invitation code" },
        { status: 400 }
      );
    }

    // Check expiration
    if (
      invitation.expires_at &&
      new Date(invitation.expires_at) < new Date()
    ) {
      await supabase
        .from("organization_invitations")
        .update({ status: "expired" })
        .eq("id", invitation.id);
      return NextResponse.json(
        { error: "Invitation code has expired" },
        { status: 400 }
      );
    }

    // Check max uses
    if (invitation.uses_count >= invitation.max_uses) {
      return NextResponse.json(
        { error: "Invitation code has reached maximum uses" },
        { status: 400 }
      );
    }

    // Check email restriction
    if (invitation.email && invitation.email !== user.email) {
      return NextResponse.json(
        { error: `This invitation is for ${invitation.email}` },
        { status: 400 }
      );
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", invitation.organization_id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You are already a member of this organization" },
        { status: 400 }
      );
    }

    // Add user to organization
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: invitation.organization_id,
        user_id: user.id,
        role: invitation.role || "member",
      });

    if (memberError) {
      return NextResponse.json(
        { error: memberError.message },
        { status: 500 }
      );
    }

    // Update invitation
    await supabase
      .from("organization_invitations")
      .update({
        uses_count: (invitation.uses_count || 0) + 1,
        status:
          (invitation.uses_count || 0) + 1 >= invitation.max_uses
            ? "accepted"
            : "pending",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invitation.id);

    return NextResponse.json({
      success: true,
      organization: invitation.organization,
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
