import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient, getAuthenticatedUser } from "@/lib/auth-server";
import { isDemoOrganizationId, isPublicDemoOrganizationId } from "@/lib/constants";

// GET - List approvals for organization
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    let membership: { role: string } | null = null;
    if (isDemoOrganizationId(orgId) || isPublicDemoOrganizationId(orgId)) {
      membership = { role: "member" };
    } else {
      const { data: m } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .single();
      membership = m;
      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this organization" },
          { status: 403 }
        );
      }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // Filter by status

    // Build query
    let query = supabase
      .from("content_approvals")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq("status", status);
    }

    // For members: only show approvals assigned to them
    // For admins/owners: show all approvals
    if (membership.role === "member") {
      query = query.eq("assigned_to", user.id);
    }

    const { data: approvals, error } = await query;

    if (error) {
      console.error("Error fetching approvals:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Resolve block_id for each approval from sub_blocks
    const subBlockIds = [...new Set((approvals || []).map((a: any) => a.sub_block_id).filter(Boolean))];
    let blockIdBySubBlock: Record<string, string> = {};
    if (subBlockIds.length > 0) {
      const { data: subBlocks } = await supabase
        .from("sub_blocks")
        .select("id, block_id")
        .in("id", subBlockIds);
      if (subBlocks) {
        subBlocks.forEach((sb: { id: string; block_id: string }) => {
          blockIdBySubBlock[sb.id] = sb.block_id;
        });
      }
    }

    // Get creator and assignee emails
    const approvalsWithUsers = await Promise.all(
      (approvals || []).map(async (approval: any) => {
        // Get creator email
        let creatorEmail = "Unknown";
        if (approval.created_by === user.id) {
          creatorEmail = user.email || "Unknown";
        } else {
          const { data: creatorEmailData } = await supabase.rpc("get_user_email", {
            user_uuid: approval.created_by,
          });
          creatorEmail = creatorEmailData || "Unknown";
        }

        // Get assignee email
        let assigneeEmail = "Unknown";
        if (approval.assigned_to === user.id) {
          assigneeEmail = user.email || "Unknown";
        } else {
          const { data: assigneeEmailData } = await supabase.rpc("get_user_email", {
            user_uuid: approval.assigned_to,
          });
          assigneeEmail = assigneeEmailData || "Unknown";
        }

        // Get approver email if approved
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

        return {
          ...approval,
          block_id: blockIdBySubBlock[approval.sub_block_id] ?? null,
          creator_email: creatorEmail,
          assignee_email: assigneeEmail,
          approver_email: approverEmail,
        };
      })
    );

    return NextResponse.json({ approvals: approvalsWithUsers });
  } catch (error) {
    console.error("Error in GET approvals:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}

// POST - Create approval request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;
    if (isDemoOrganizationId(orgId) || isPublicDemoOrganizationId(orgId)) {
      return NextResponse.json(
        { error: "Cannot create approvals in demo organization" },
        { status: 403 }
      );
    }
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    // Verify user is admin/owner
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Only admins and owners can create approval requests" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      sub_block_id,
      story_id,
      platform_contents,
      content_type,
      platforms,
      assigned_to, // user_id or array of user_ids for "all members"
    } = body;

    // Validate required fields
    if (!sub_block_id || !platform_contents || !content_type || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: sub_block_id, platform_contents, content_type, platforms" },
        { status: 400 }
      );
    }

    if (!assigned_to) {
      return NextResponse.json(
        { error: "assigned_to is required" },
        { status: 400 }
      );
    }

    // Handle "all members" case
    let assignedUserIds: string[] = [];
    if (assigned_to === "all_members") {
      // Get all members with "member" role
      const { data: members } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("role", "member");

      if (!members || members.length === 0) {
        return NextResponse.json(
          { error: "No members found in organization" },
          { status: 400 }
        );
      }

      assignedUserIds = members.map((m: any) => m.user_id);
    } else if (Array.isArray(assigned_to)) {
      // Multiple specific members
      assignedUserIds = assigned_to;
    } else {
      // Single member
      assignedUserIds = [assigned_to];
    }

    // Verify all assigned users are members of the organization
    const { data: assignedMembers } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .in("user_id", assignedUserIds);

    if (!assignedMembers || assignedMembers.length !== assignedUserIds.length) {
      return NextResponse.json(
        { error: "One or more assigned users are not members of this organization" },
        { status: 400 }
      );
    }

    // Prevent duplicate: do not create if there is already a pending approval for this sub_block
    const { data: existingPending } = await supabase
      .from("content_approvals")
      .select("id")
      .eq("sub_block_id", sub_block_id)
      .eq("status", "pending")
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return NextResponse.json(
        {
          error:
            "An approval for this content is already pending. Resubmit from the existing approval or wait for it to be completed.",
        },
        { status: 409 }
      );
    }

    // Create approval requests for each assigned member
    const approvals = await Promise.all(
      assignedUserIds.map(async (userId) => {
        const { data: approval, error: insertError } = await supabase
          .from("content_approvals")
          .insert({
            organization_id: orgId,
            sub_block_id,
            story_id: story_id || null,
            created_by: user.id,
            assigned_to: userId,
            platform_contents,
            content_type,
            platforms,
            status: "pending",
          })
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to create approval for user ${userId}: ${insertError.message}`);
        }

        return approval;
      })
    );

    return NextResponse.json({
      success: true,
      approvals,
      count: approvals.length,
    });
  } catch (error) {
    console.error("Error in POST approvals:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
