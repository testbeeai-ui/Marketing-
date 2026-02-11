/**
 * Platform Watch – CMO-facing intelligence on platform updates, upcoming features,
 * and algorithm shifts. Update periodically to sustain long-term relevance.
 */

export interface PlatformUpdate {
  platform?: string;
  headline: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "analytics" | "creator-tools" | "algorithm" | "monetization" | "format";
  date?: string;
}

export interface PlatformWatchItem {
  platform: string;
  platformLabel: string;
  updates: PlatformUpdate[];
  algorithmDirection?: string;
}

export const PLATFORM_WATCH: PlatformWatchItem[] = [
  {
    platform: "linkedin",
    platformLabel: "LinkedIn",
    algorithmDirection: "Prioritizing authority, newsletter growth, and post-level follower attribution.",
    updates: [
      {
        headline: "Universal Newsletters",
        description: "Newsletters now available to all members; 59% more creators, 47% higher engagement.",
        impact: "high",
        category: "creator-tools",
      },
      {
        headline: "Rolling Post Analytics",
        description: "Track profile views, follower growth, and custom button clicks per post in real time.",
        impact: "high",
        category: "analytics",
      },
      {
        headline: "Combined Post Analytics",
        description: "Cross-format performance: short-form, images, videos, polls, articles over time.",
        impact: "medium",
        category: "analytics",
      },
      {
        headline: "SMB Premium Suite",
        description: "Page visitor invitations, product spotlighting for small businesses.",
        impact: "medium",
        category: "creator-tools",
      },
    ],
  },
  {
    platform: "instagram",
    platformLabel: "Instagram",
    algorithmDirection: "Authenticity over polish. Shares/DMs > likes. Profile-level trust matters. AI content must be labeled.",
    updates: [
      {
        headline: "Shares → Sends per Reach",
        description: "Metric rename for accurate engagement; shares remain strongest signal.",
        impact: "high",
        category: "analytics",
      },
      {
        headline: "90-Day Data Retention",
        description: "Analytics data now retained 90 days—export regularly for long-term analysis.",
        impact: "high",
        category: "analytics",
      },
      {
        headline: "Post-Level Follower Growth",
        description: "See which specific posts bring new followers.",
        impact: "medium",
        category: "analytics",
      },
      {
        headline: "Carousel Slide-Level Engagement",
        description: "Engagement by individual slide for carousel optimization.",
        impact: "medium",
        category: "analytics",
      },
      {
        headline: "Views as Universal Metric",
        description: "Views now used across Reels, Stories, and Posts for consistency.",
        impact: "medium",
        category: "analytics",
      },
    ],
  },
  {
    platform: "x",
    platformLabel: "X (Twitter)",
    algorithmDirection: "Reach driven by conversation signals. Replies, quote tweets, and thread completion boost distribution.",
    updates: [
      {
        headline: "Engagement-First Algorithm",
        description: "Posts that spark replies and quote tweets get more reach.",
        impact: "high",
        category: "algorithm",
      },
      {
        headline: "Long-Form & Notes",
        description: "Extended posts and Notes for deeper content without leaving the app.",
        impact: "medium",
        category: "format",
      },
      {
        headline: "Creator Subscriptions",
        description: "Monetization via Subscriptions and ad-revenue share for creators.",
        impact: "medium",
        category: "monetization",
      },
    ],
  },
  {
    platform: "facebook",
    platformLabel: "Facebook",
    algorithmDirection: "Reels and authentic content favored. Groups and community signals prioritized.",
    updates: [
      {
        headline: "Reels Distribution",
        description: "Short-form video gets significant boost; prioritize Reels for reach.",
        impact: "high",
        category: "format",
      },
      {
        headline: "Group & Community Signals",
        description: "Activity in Groups and meaningful comments improve post distribution.",
        impact: "medium",
        category: "algorithm",
      },
      {
        headline: "Creator Studio Consolidation",
        description: "Meta Business Suite centralizes cross-platform analytics.",
        impact: "low",
        category: "analytics",
      },
    ],
  },
];

export function getPlatformWatchByPlatform(platform: string): PlatformWatchItem | undefined {
  return PLATFORM_WATCH.find((p) => p.platform === platform);
}
