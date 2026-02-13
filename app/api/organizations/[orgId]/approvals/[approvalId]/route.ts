import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";

// GET - Get single approval details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; approvalId: string }> }
) {
  try {
    const { orgId, approvalId } = await params;
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a member
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }

    // Get approval
    const { data: approval, error } = await supabase
      .from("content_approvals")
      .select("*")
      .eq("id", approvalId)
      .eq("organization_id", orgId)
      .single();

    if (error || !approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    // For members: only show if assigned to them
    // For admins/owners: show all
    if (membership.role === "member" && approval.assigned_to !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Resolve block_id from sub_blocks
    let block_id: string | null = null;
    if (approval.sub_block_id) {
      const { data: subBlock } = await supabase
        .from("sub_blocks")
        .select("block_id")
        .eq("id", approval.sub_block_id)
        .single();
      block_id = subBlock?.block_id ?? null;
    }

    // Get creator, assignee, and approver emails
    let creatorEmail = "Unknown";
    if (approval.created_by === user.id) {
      creatorEmail = user.email || "Unknown";
    } else {
      const { data: creatorEmailData } = await supabase.rpc("get_user_email", {
        user_uuid: approval.created_by,
      });
      creatorEmail = creatorEmailData || "Unknown";
    }

    let assigneeEmail = "Unknown";
    if (approval.assigned_to === user.id) {
      assigneeEmail = user.email || "Unknown";
    } else {
      const { data: assigneeEmailData } = await supabase.rpc("get_user_email", {
        user_uuid: approval.assigned_to,
      });
      assigneeEmail = assigneeEmailData || "Unknown";
    }

    let approverEmail = null;
    if (approval.approved_by) {
      if (approval.approved_by === user.id) {
        approverEmail = user.email || null;
      } else {
        const { data: approverEmailData } = await supabase.rpc("get_user_email", {
          user_uuid: approval.approved_by,
        });
        approverEmail = approverEmailData || null;
      }
    }

    return NextResponse.json({
      approval: {
        ...approval,
        block_id: block_id ?? undefined,
        creator_email: creatorEmail,
        assignee_email: assigneeEmail,
        approver_email: approverEmail,
      },
    });
  } catch (error) {
    console.error("Error in GET approval:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// PATCH - Update approval status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; approvalId: string }> }
) {
  try {
    const { orgId, approvalId } = await params;
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is a member
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      );
    }

    // Get approval
    const { data: approval, error: fetchError } = await supabase
      .from("content_approvals")
      .select("*")
      .eq("id", approvalId)
      .eq("organization_id", orgId)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    // Verify user can update (assigned member or creator)
    if (approval.assigned_to !== user.id && approval.created_by !== user.id) {
      return NextResponse.json(
        { error: "You can only update approvals assigned to you or created by you" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, changes_requested, changes_requested_per_asset, resubmit } = body;

    // Resubmit: creator sets status back to pending from changes_requested/rejected
    const isResubmit =
      resubmit === true &&
      (approval.status === "changes_requested" || approval.status === "rejected") &&
      approval.created_by === user.id;

    if (isResubmit) {
      const { data: updatedApproval, error: updateError } = await supabase
        .from("content_approvals")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", approvalId)
        .select()
        .single();

      if (updateError) {
        console.error("Error resubmitting approval:", updateError);
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, approval: updatedApproval });
    }

    if (!status || !["pending", "approved", "changes_requested", "rejected"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be: pending, approved, changes_requested, or rejected" },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === "approved") {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = user.id;
    }

    if (status === "changes_requested") {
      if (changes_requested) updateData.changes_requested = changes_requested;
      if (changes_requested_per_asset != null) updateData.changes_requested_per_asset = changes_requested_per_asset;
    }

    if (status === "rejected") {
      updateData.changes_requested = changes_requested || null;
      if (changes_requested_per_asset != null) updateData.changes_requested_per_asset = changes_requested_per_asset;
    }

    // Update approval
    const { data: updatedApproval, error: updateError } = await supabase
      .from("content_approvals")
      .update(updateData)
      .eq("id", approvalId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating approval:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      approval: updatedApproval,
    });
  } catch (error) {
    console.error("Error in PATCH approval:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
