import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { PUBLIC_DEMO_ORGANIZATION_ID } from "@/lib/constants";

/**
 * POST /api/admin/link-demo-org
 *
 * Adds the current user as a member of the public demo organization (1305bb82-...)
 * so they can create and edit content instead of read-only.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const { data: existing } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", PUBLIC_DEMO_ORGANIZATION_ID)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "You already have access to this organization",
        role: existing.role,
      });
    }

    const { error } = await supabase.from("organization_members").insert({
      organization_id: PUBLIC_DEMO_ORGANIZATION_ID,
      user_id: user.id,
      role: "member",
    });

    if (error) {
      console.error("[link-demo-org] Insert failed:", error);
      return NextResponse.json(
        { error: error.message || "Failed to request access" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "You now have access to this organization. Refresh the app to create and edit content.",
    });
  } catch (e) {
    console.error("[link-demo-org]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
