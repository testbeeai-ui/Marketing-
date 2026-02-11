/**
 * Platform Intelligence - curated feature tracking for LinkedIn, X, Instagram, Facebook.
 * Uses platformWatch.ts as the single source of truth; supports CMO command center "What's Changing" widget.
 */

import { PLATFORM_WATCH } from "./platformWatch";

export type PlatformId = "linkedin" | "x" | "instagram" | "facebook";

export type FeatureStatus = "live" | "beta" | "upcoming";

export type FeatureImpact = "high" | "medium" | "low";

export interface PlatformFeature {
  name: string;
  description: string;
  status: FeatureStatus;
  impact: FeatureImpact;
  date_added: string;
  source: string;
  affects?: string;
}

export type PlatformFeaturesMap = Record<PlatformId, PlatformFeature[]>;

function buildFeaturesMap(): PlatformFeaturesMap {
  const map: PlatformFeaturesMap = {
    linkedin: [],
    x: [],
    instagram: [],
    facebook: [],
  };
  for (const item of PLATFORM_WATCH) {
    const platform = item.platform as PlatformId;
    if (!map[platform]) map[platform] = [];
    map[platform] = item.updates.map((u) => ({
      name: u.headline,
      description: u.description,
      status: "live" as const,
      impact: u.impact,
      date_added: "2025-02",
      source: item.platformLabel,
    }));
  }
  return map;
}

const cachedFeatures = buildFeaturesMap();

/**
 * Load platform features. Kept for API compatibility.
 */
export async function loadPlatformFeatures(): Promise<PlatformFeaturesMap> {
  return cachedFeatures;
}

/**
 * Sync load for client components.
 */
export function getPlatformFeaturesSync(): PlatformFeaturesMap {
  return cachedFeatures;
}

/**
 * Get high-impact features for a platform (for widget display).
 */
export function getHighImpactFeatures(
  platform: PlatformId,
  limit = 5
): PlatformFeature[] {
  const features = getPlatformFeaturesSync()[platform] ?? [];
  const highFirst = features.sort((a, b) => {
    const order: Record<FeatureImpact, number> = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });
  return highFirst.slice(0, limit);
}

/**
 * Get "How this affects you" one-liner for a feature, tied to strategy mode.
 */
export function getAffectLine(feature: PlatformFeature, strategyMode?: string): string {
  return feature.affects ?? `Align content and metrics with ${feature.name}.`;
}
