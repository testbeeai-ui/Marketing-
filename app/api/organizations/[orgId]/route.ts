import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { isDemoOrganizationId, isPublicDemoOrganizationId } from "@/lib/constants";

// GET - Get detailed organization info
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

    // Demo org (legacy) or public demo org: allow read-only without membership
    if (isDemoOrganizationId(orgId) || isPublicDemoOrganizationId(orgId)) {
      const { data: org } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();
      const [blocksCount, analyticsCount] = await Promise.all([
        supabase.from("blocks").select("*", { count: "exact", head: true }).eq("organization_id", orgId).then((r) => r.count ?? 0),
        supabase.from("analytics_snapshots").select("*", { count: "exact", head: true }).eq("organization_id", orgId).then((r) => r.count ?? 0),
      ]);
      return NextResponse.json({
        organization: {
          ...(org ?? { id: orgId, name: "Demo Organization", slug: "demo", description: "Explore in read-only mode." }),
          member_count: 0,
          blocks_count: blocksCount,
          analytics_count: analyticsCount,
          user_role: "member",
        },
        members: [],
        user_role: "member",
      });
    }

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

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from("organization_members")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId);

    // Get member list - all org members (including role "member") can view who is admin/member (read-only)
    let members: any[] = [];
    const { data: memberList } = await supabase
      .from("organization_members")
      .select("role, joined_at, user_id")
      .eq("organization_id", orgId)
      .order("joined_at", { ascending: false });

    const membersWithEmails = await Promise.all(
      (memberList || []).map(async (m: any) => {
        let email = "Unknown";
        if (m.user_id === user.id) {
          email = user.email || "Unknown";
        } else {
          const { data: emailData } = await supabase.rpc("get_user_email", {
            user_uuid: m.user_id,
          });
          email = emailData || "Unknown";
        }
        return {
          role: m.role,
          joined_at: m.joined_at,
          email,
          user_id: m.user_id,
        };
      })
    );
    members = membersWithEmails;

    // Get statistics (blocks count, analytics snapshots count)
    const [blocksCount, analyticsCount] = await Promise.all([
      supabase
        .from("blocks")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .then((res) => res.count || 0),
      supabase
        .from("analytics_snapshots")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .then((res) => res.count || 0),
    ]);

    return NextResponse.json({
      organization: {
        ...org,
        member_count: memberCount || 0,
        blocks_count: blocksCount,
        analytics_count: analyticsCount,
        user_role: membership.role, // Include user_role in organization object
      },
      members,
      user_role: membership.role, // Keep for backward compatibility
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
