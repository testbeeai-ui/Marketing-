import { NextRequest, NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { PUBLIC_DEMO_ORGANIZATION_ID, APP_ADMIN_EMAILS } from "@/lib/constants";

function generateInvitationCode(orgName: string): string {
  const prefix = orgName
    .substring(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, "A");
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

// GET - List user's organizations with member counts
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organizations with their role
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select(
        `
        role,
        joined_at,
        organization:organizations (
          id,
          name,
          slug,
          logo_url,
          description,
          created_at
        )
      `
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const orgIds = memberships?.length ? memberships.map((m: any) => m.organization.id) : [];
    const hasPublicDemoInMemberships = orgIds.includes(PUBLIC_DEMO_ORGANIZATION_ID);

    const idsForCount = hasPublicDemoInMemberships ? orgIds : [...orgIds, PUBLIC_DEMO_ORGANIZATION_ID];
    const { data: memberCounts, error: countError } = await supabase
      .from("organization_members")
      .select("organization_id")
      .in("organization_id", idsForCount);

    if (countError) {
      console.error("Error fetching member counts:", countError);
    }

    const countsByOrg = new Map<string, number>();
    (memberCounts || []).forEach((m: any) => {
      countsByOrg.set(m.organization_id, (countsByOrg.get(m.organization_id) || 0) + 1);
    });

    let organizations: any[] = (memberships || []).map((m: any) => ({
      ...m.organization,
      role: m.role,
      member_count: countsByOrg.get(m.organization.id) || 0,
      joined_at: m.joined_at,
    }));

    // Always include the public demo org (your org 1305bb82-...) so new users see it read-only; members get their real role
    if (!hasPublicDemoInMemberships) {
      const { data: publicDemoRow } = await supabase
        .from("organizations")
        .select("id, name, slug, logo_url, description, created_at")
        .eq("id", PUBLIC_DEMO_ORGANIZATION_ID)
        .maybeSingle();

      const role = "member";
      const publicDemoOrg = publicDemoRow ? {
        ...publicDemoRow,
        role,
        member_count: countsByOrg.get(PUBLIC_DEMO_ORGANIZATION_ID) || 0,
        joined_at: null,
        description: publicDemoRow.description || "View content in read-only mode. Request access to create and edit.",
      } : {
        id: PUBLIC_DEMO_ORGANIZATION_ID,
        name: "Organization",
        slug: "demo",
        logo_url: null,
        description: "View content in read-only mode. Request access to create and edit.",
        created_at: null,
        role,
        member_count: countsByOrg.get(PUBLIC_DEMO_ORGANIZATION_ID) || 0,
        joined_at: null,
      };
      organizations = [...organizations, publicDemoOrg];
    }

    // App admins see this org with their real role (from memberships); no override needed
    const isAppAdmin = user?.email && APP_ADMIN_EMAILS.includes(user.email.toLowerCase());
    if (isAppAdmin) {
      const idx = organizations.findIndex((o: any) => o.id === PUBLIC_DEMO_ORGANIZATION_ID);
      if (idx >= 0 && organizations[idx].role === "member") {
        organizations[idx] = { ...organizations[idx], role: "owner" };
      }
    }

    return NextResponse.json({ organizations });
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

// POST - Create organization
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthenticatedClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, description } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: name.trim(),
        slug,
        description: description?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (orgError) {
      return NextResponse.json({ error: orgError.message }, { status: 400 });
    }

    // Add creator as admin (not owner)
    const { error: memberError } = await supabase
      .from("organization_members")
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: "admin",
      });

    if (memberError) {
      // Rollback organization creation
      await supabase.from("organizations").delete().eq("id", org.id);
      return NextResponse.json(
        { error: "Failed to add you as admin" },
        { status: 500 }
      );
    }

    // Don't create default invitation - users should create invitations with email addresses
    // This prevents invitations without email addresses

    return NextResponse.json({
      organization: { ...org, role: "admin" },
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
