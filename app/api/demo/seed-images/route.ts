import { NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/services/aiService";
import { supabase } from "@/lib/db/client";
import { getAuthenticatedUser } from "@/lib/auth-server";
import {
  DEMO_STYLES,
  DEMO_PLATFORMS,
  DEMO_IMAGE_PROMPTS,
  DEMO_PLATFORM_DIMENSIONS,
  getDemoImagePath,
  getDemoImageUrl,
  type DemoStyle,
  type DemoPlatform,
} from "@/lib/demoImages";

/**
 * POST /api/demo/seed-images
 *
 * One-time (or occasional) seed: generates 12 demo images via Gemini/Imagen,
 * uploads them to Supabase storage at images/demo/{style}-{platform}.png.
 * All demo users then see the same pre-generated images (no Unsplash).
 *
 * Auth: (1) header x-seed-secret matching DEMO_SEED_SECRET, or
 *       (2) logged-in user who is admin/owner of any organization.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.DEMO_SEED_SECRET;
  const headerSecret = request.headers.get("x-seed-secret");
  const hasValidSecret = secret && headerSecret === secret;

  if (!hasValidSecret) {
    const auth = await getAuthenticatedUser(request);
    if (!auth) {
      return NextResponse.json(
        { error: "Unauthorized: use x-seed-secret header or log in as org admin/owner" },
        { status: 401 }
      );
    }
    const { user, supabase: supabaseAuth } = auth;
    const { data: membership } = await supabaseAuth
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "owner"])
      .limit(1)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: only org admins and owners can seed demo images" },
        { status: 403 }
      );
    }
  }

  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const results: { style: string; platform: string; url: string; error?: string }[] = [];

  for (const style of DEMO_STYLES) {
    for (const platform of DEMO_PLATFORMS) {
      const prompt = DEMO_IMAGE_PROMPTS[style as DemoStyle][platform as DemoPlatform];
      const { width, height } = DEMO_PLATFORM_DIMENSIONS[platform as DemoPlatform];

      try {
        const buffer = await aiService.generateImage(prompt, width, height);
        const path = getDemoImagePath(style as DemoStyle, platform as DemoPlatform);

        const { error: uploadError } = await supabase.storage
          .from("images")
          .upload(path, buffer, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          results.push({
            style,
            platform,
            url: "",
            error: uploadError.message,
          });
          continue;
        }

        const url = getDemoImageUrl(style as DemoStyle, platform as DemoPlatform);
        results.push({ style, platform, url });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        results.push({ style, platform, url: "", error: message });
      }
    }
  }

  const failed = results.filter((r) => r.error);
  return NextResponse.json({
    ok: failed.length === 0,
    results,
    failed: failed.length,
  });
}
