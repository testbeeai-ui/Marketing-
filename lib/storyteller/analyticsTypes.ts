/**
 * Shared types for analytics extracted_data.
 * Keeps API (analyze-screenshot), normalization (analyticsSchema), and platform deep-dive components aligned.
 */

export type SnapshotType = 'dashboard' | 'post';
export type AnalyticsPlatform = 'x' | 'linkedin' | 'instagram' | 'facebook';

/** Extended metrics keys extracted from dashboard screenshots (Facebook, Instagram, LinkedIn). */
export interface AnalyticsMetrics {
  impressions?: number | null;
  engagement_rate?: number | null;
  followers?: number | null;
  profile_visits?: number | null;
  engagements?: number | null;
  saves?: number | null;
  shares?: number | null;
  replies?: number | null;
  likes?: number | null;
  reposts?: number | null;
  bookmarks?: number | null;
  reach?: number | null;
  page_likes?: number | null;
  reactions?: number | null;
  comments?: number | null;
  post_clicks?: number | null;
  published_content?: number | null;
  facebook_followers?: number | null;
  follows?: number | null;
  content_interactions?: number | null;
  typically_followers?: number | null;
  typically_follows?: number | null;
  typically_interactions?: number | null;
  views?: number | null;
  viewers?: number | null;
  link_clicks?: number | null;
  reach_goal_current?: number | null;
  reach_goal_target?: number | null;
  returning_viewers?: number | null;
  engaged_followers?: number | null;
  messaging_contacts?: number | null;
  unfollows?: number | null;
  net_follows?: number | null;
  followers_lifetime?: number | null;
  daily_response_rate?: number | null;
  daily_response_time?: number | null;
  conversations_started?: number | null;
  total_messaging_contacts?: number | null;
  new_messaging_contacts?: number | null;
  returning_messaging_contacts?: number | null;
  messaging_conversations_started?: number | null;
  total_contacts?: number | null;
  new_contacts_organic?: number | null;
  new_contacts_paid?: number | null;
  returning_contacts_organic?: number | null;
  returning_contacts_paid?: number | null;
  views_3s?: number | null;
  views_1m?: number | null;
  watch_time_s?: number | null;
  views_organic?: number | null;
  views_ads?: number | null;
  approximate_earnings?: number | null;
  earnings_change_pct?: number | null;
  tasks_completed?: number | null;
  tasks_total?: number | null;
  instagram_posts_published?: number | null;
  instagram_views?: number | null;
  facebook_posts_progress?: number | null;
  first_ad_progress?: number | null;
  instagram_posts_progress?: number | null;
  views_followers_pct?: number | null;
  views_non_followers_pct?: number | null;
  posts_pct?: number | null;
  reels_pct?: number | null;
  total_interactions?: number | null;
  interactions_followers_pct?: number | null;
  interactions_non_followers_pct?: number | null;
  accounts_engaged?: number | null;
  posts_interactions_pct?: number | null;
  reels_interactions_pct?: number | null;
  profile_activity?: number | null;
  post_impressions?: number | null;
  post_impressions_change_7d?: number | null;
  followers_change_7d?: number | null;
  profile_viewers_90d?: number | null;
  search_appearances_week?: number | null;
  weekly_actions_done?: number | null;
  weekly_actions_goal?: number | null;
  posts_this_week?: number | null;
  comments_this_week?: number | null;
  [key: string]: number | null | undefined;
}

/** Optional dashboard sections (e.g. benchmarking, audience, messaging). Flattened into metrics with section_ prefix by normalizeExtractedData. */
export type AnalyticsSections = Partial<Record<string, Record<string, number | null>>>;

export interface TopContentItem {
  content_preview?: string;
  post_date?: string;
  views?: number;
  likes?: number;
  shares?: number;
  interactions?: number;
}

/** Extracted data shape returned by AI and stored in analytics_snapshots.extracted_data. */
export interface ExtractedData {
  snapshot_type: SnapshotType;
  platform: AnalyticsPlatform | null;
  extracted_at?: string;
  period_start?: string | null;
  period_end?: string | null;
  post_date?: string | null;
  post_date_display?: string | null;
  metrics?: AnalyticsMetrics | null;
  time_series?: Array<{ period: string; value: number; period_date?: string }> | null;
  format_performance?: { format: string | null; insight: string | null } | null;
  semantic_intent?: Array<{ label: string; percent: number }> | null;
  strategic_analysis?: {
    mood?: string | null;
    anomaly_detected?: string | null;
    actionable_advice?: string | null;
    resonance_label?: string | null;
  } | null;
  post?: {
    views?: number | null;
    likes?: number | null;
    reposts?: number | null;
    replies?: number | null;
    post_date?: string | null;
    content_preview?: string | null;
    format?: string | null;
    shares?: number | null;
  } | null;
  sections?: AnalyticsSections | null;
  recent_content?: TopContentItem[] | null;
  top_content_by_views?: TopContentItem[] | null;
  top_content_by_interactions?: TopContentItem[] | null;
}
