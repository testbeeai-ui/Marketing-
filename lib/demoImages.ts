/**
 * Demo mode: pre-generated Gemini/Imagen assets for demo users.
 * Images are generated once via POST /api/demo/seed-images and stored in Supabase (images/demo/).
 * All demo users see the same URLs so no Unsplash or external assets.
 */

export type DemoStyle = "professional" | "viral" | "storyteller";
export type DemoPlatform = "linkedin" | "twitter" | "instagram" | "facebook";

const DEMO_BUCKET = "images";
const DEMO_PREFIX = "demo";

/** Public URL for a demo image. Use after running seed-images once. */
export function getDemoImageUrl(style: DemoStyle, platform: DemoPlatform): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!base) return "";
  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${DEMO_BUCKET}/${DEMO_PREFIX}/${style}-${platform}.png`;
}

/** Style-specific placeholder when Supabase demo image is missing. Ensures Professional, Viral, and Storyteller each show a distinct image. */
const DEMO_FALLBACK_COLORS: Record<DemoStyle, { bg: string; fg: string; label: string }> = {
  professional: { bg: "0A66C2", fg: "ffffff", label: "Professional" },
  viral: { bg: "E1306C", fg: "ffffff", label: "Viral" },
  storyteller: { bg: "7C3AED", fg: "ffffff", label: "Storyteller" },
};

export function getDemoImageFallbackUrl(style: DemoStyle, platform?: DemoPlatform): string {
  const { bg, fg, label } = DEMO_FALLBACK_COLORS[style] ?? DEMO_FALLBACK_COLORS.professional;
  const plat = platform ?? "linkedin";
  return `https://placehold.co/1200x627/${bg}/${fg}?text=${encodeURIComponent(label + " – " + plat)}&font=inter`;
}

/** Relative path in bucket for upload (seed script). */
export function getDemoImagePath(style: DemoStyle, platform: DemoPlatform): string {
  return `${DEMO_PREFIX}/${style}-${platform}.png`;
}

/** Platform dimensions for image generation (match imageGenerator). */
export const DEMO_PLATFORM_DIMENSIONS: Record<DemoPlatform, { width: number; height: number }> = {
  linkedin: { width: 1200, height: 627 },
  twitter: { width: 1200, height: 675 },
  instagram: { width: 1080, height: 1080 },
  facebook: { width: 1200, height: 630 },
};

/**
 * Full Imagen-ready prompts for each (style, platform).
 * Designed to produce one consistent, high-quality image per slot: proportionate,
 * on-brand, emotionally compelling ("OMG I'm missing something"), no disturbing or hallucinated content.
 */
export const DEMO_IMAGE_PROMPTS: Record<DemoStyle, Record<DemoPlatform, string>> = {
  professional: {
    linkedin:
      "Professional corporate team in a modern glass office, diverse colleagues collaborating around a large whiteboard covered with strategy sticky notes and clear data points. Soft natural light from floor-to-ceiling windows, clean minimalist furniture, laptops and tablets. Confident body language, focused expressions. Corporate blue and warm neutral tones. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range, masterfully composed. No text or logos in the image.",
    twitter:
      "Sleek data analytics dashboard on a large monitor in a modern workspace: clear charts, growth metrics, and KPIs. Minimal desk with laptop and coffee. Soft studio lighting, cool blue and white color grading. Professional and aspirational. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range. No text or watermarks.",
    instagram:
      "Minimal professional workspace flat lay: open laptop showing a clean presentation slide, notebook with pen, smartphone, and a single plant. Neutral tones with one accent color. Soft diffused lighting from the side. Aspirational and calm. 8K resolution, ultra-detailed, professional photography, sharp focus. No text or logos.",
    facebook:
      "Diverse team of professionals in a bright modern office, sitting around a round table in a collaborative discussion. Warm natural light, casual-professional dress, smiling and engaged. Community and trust. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range, masterfully composed. No text in the image.",
  },
  viral: {
    linkedin:
      "Dynamic professional holding a smartphone with a glowing screen, mid-scroll, in a modern office. Expression of pleasant surprise and engagement. Clean background with soft bokeh. Represents scroll-stopping, share-worthy content. Bold but professional color grading. 8K resolution, ultra-detailed, professional photography, sharp focus. No text or logos on the phone.",
    twitter:
      "High-impact visual: hand holding a smartphone displaying a vibrant social feed with bold colors and clear engagement icons. Dark moody background, phone screen as the main light source. Scroll-stopping, eye-catching. 8K resolution, ultra-detailed, professional photography, sharp focus. No readable text or branding.",
    instagram:
      "Vibrant, scroll-stopping flat lay: smartphone with a bright social app interface, surrounded by soft gradients and aesthetic objects. Rich colors, clean composition, lifestyle appeal. 8K resolution, ultra-detailed, professional photography, sharp focus. No watermarks or text.",
    facebook:
      "Warm community moment: small group of people looking at a phone together, smiling and reacting. Cozy setting, natural lighting. Represents sharing and connection. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range. No text in the image.",
  },
  storyteller: {
    linkedin:
      "Authentic leader in a warm, modern office setting, speaking with genuine expression as if telling a story. Soft window light, wooden and soft-textured environment. Trust and authenticity. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range. No text or logos.",
    twitter:
      "Creative desk with an open notebook showing handwritten strategy notes, a pen, and a small plant. Warm natural light, shallow depth of field. Story and craft. 8K resolution, ultra-detailed, professional photography, sharp focus. No text or watermarks.",
    instagram:
      "Notebook and pen on a textured surface with soft bokeh background. One page with a few handwritten words suggesting a story or idea. Warm, aspirational, authentic. 8K resolution, ultra-detailed, professional photography, sharp focus. No logos.",
    facebook:
      "Diverse group of people in a circle in a warm, casual space, leaning in as if listening to a story. Natural expressions, community feeling. 8K resolution, ultra-detailed, professional photography, sharp focus, high dynamic range. No text in the image.",
  },
};

export const DEMO_STYLES: DemoStyle[] = ["professional", "viral", "storyteller"];
export const DEMO_PLATFORMS: DemoPlatform[] = ["linkedin", "twitter", "instagram", "facebook"];

/** Short labels for UI (Image tab). */
export const DEMO_IMAGE_LABELS: Record<DemoStyle, Record<DemoPlatform, string>> = {
  professional: {
    linkedin: "Professional team at whiteboard, strategy and clarity",
    twitter: "Data dashboard and analytics, professional workspace",
    instagram: "Minimal professional workspace flat lay",
    facebook: "Diverse team collaborating in modern office",
  },
  viral: {
    linkedin: "Scroll-stopping engagement, professional social",
    twitter: "Bold social feed, high-impact visual",
    instagram: "Vibrant scroll-stopping lifestyle aesthetic",
    facebook: "Community sharing and connection",
  },
  storyteller: {
    linkedin: "Authentic leader storytelling, warm and trusted",
    twitter: "Creative desk, notebook and story",
    instagram: "Notebook and pen, authentic story",
    facebook: "Group sharing stories, community circle",
  },
};
