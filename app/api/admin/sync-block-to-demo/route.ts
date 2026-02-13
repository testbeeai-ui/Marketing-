import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth-server";
import { createAuthenticatedClient } from "@/lib/auth-server";
import { DEMO_ORGANIZATION_ID, APP_ADMIN_EMAILS } from "@/lib/constants";
import { blockStorage } from "@/lib/services/blockStorage";

const DEMO_BLOCK_ID = "demo-block-marketing";

/**
 * POST /api/admin/sync-block-to-demo
 *
 * Copies a block (and its sub-blocks) from the given organization into the Demo Organization
 * so new users see this content when they open the Demo Org. Only app admins can call this.
 * Body: { blockId: string, organizationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const isAppAdmin = user?.email && APP_ADMIN_EMAILS.includes(user.email.toLowerCase());
    if (!isAppAdmin) {
      return NextResponse.json({ error: "Only app admins can publish blocks to the demo" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const blockId = body.blockId ?? body.block_id;
    const organizationId = body.organizationId ?? body.organization_id;
    if (!blockId || !organizationId) {
      return NextResponse.json(
        { error: "blockId and organizationId are required" },
        { status: 400 }
      );
    }

    if (organizationId === DEMO_ORGANIZATION_ID) {
      return NextResponse.json(
        { error: "Source block must be from a non-demo organization" },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
      return NextResponse.json({ error: "You must be owner or admin of the source organization" }, { status: 403 });
    }

    await blockStorage.ensureLoaded();
    const sourceBlock = await blockStorage.getByOrganizationId(blockId, organizationId, supabase);
    if (!sourceBlock) {
      return NextResponse.json({ error: "Block not found in the given organization" }, { status: 404 });
    }

    const { data: sourceSubBlocks, error: subErr } = await supabase
      .from("sub_blocks")
      .select("*")
      .eq("block_id", blockId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    if (subErr) {
      console.error("[sync-block-to-demo] Error fetching sub-blocks:", subErr);
      return NextResponse.json({ error: subErr.message }, { status: 500 });
    }

    const now = new Date().toISOString();

    const { error: blockUpdateErr } = await supabase
      .from("blocks")
      .update({
        name: sourceBlock.name,
        description: sourceBlock.description,
        updated_at: now,
      })
      .eq("id", DEMO_BLOCK_ID)
      .eq("organization_id", DEMO_ORGANIZATION_ID);

    if (blockUpdateErr) {
      console.error("[sync-block-to-demo] Error updating demo block:", blockUpdateErr);
      return NextResponse.json({ error: blockUpdateErr.message }, { status: 500 });
    }

    const { error: deleteErr } = await supabase
      .from("sub_blocks")
      .delete()
      .eq("block_id", DEMO_BLOCK_ID)
      .eq("organization_id", DEMO_ORGANIZATION_ID);

    if (deleteErr) {
      console.error("[sync-block-to-demo] Error deleting existing demo sub-blocks:", deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    const rows = (sourceSubBlocks || []).map((row: any, index: number) => ({
      id: `demo-sub-${index + 1}`,
      user_id: null,
      block_id: DEMO_BLOCK_ID,
      organization_id: DEMO_ORGANIZATION_ID,
      name: row.name,
      prompt: row.prompt ?? "",
      story_variations: row.story_variations ?? {},
      selected_variation_id: row.selected_variation_id ?? null,
      platform_contents: row.platform_contents ?? {},
      created_at: now,
      updated_at: now,
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await supabase.from("sub_blocks").insert(rows);
      if (insertErr) {
        console.error("[sync-block-to-demo] Error inserting demo sub-blocks:", insertErr);
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      message: `"${sourceBlock.name}" is now the demo block. New users will see it when they open the Demo Organization.`,
      blockId: DEMO_BLOCK_ID,
      subBlockCount: rows.length,
    });
  } catch (e) {
    console.error("[sync-block-to-demo]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
