# Analytics Storage Schema

Long-term, analysis-ready storage for StoryTeller analytics. Designed for reliable queries over 1 month, 1 year, and beyond—without re-analyzing images.

## Stored Fields (in `extracted_data`)

### Common (all snapshots)
- `snapshot_type`: `"dashboard"` | `"post"`
- `platform`: `"x"` | `"linkedin"` | `"instagram"` | `"facebook"`
- `extracted_at`: ISO timestamp when AI analysis ran

### Dashboard
- `period_start`, `period_end`: ISO dates (YYYY-MM-DD) for the chart's date range
- `metrics`: flat object of metric keys (see **Metric keys** below). Section metrics are also flattened into `metrics` with a `section_key` prefix (e.g. `benchmarking_published_content`).
- `time_series`: `[{ period, value, period_date? }]` — `period_date` is normalized ISO for range queries
- `strategic_analysis`: anomaly_detected, actionable_advice, mood
- `format_performance`, `semantic_intent`
- `sections` (optional): `{ [sectionName]: { [metricKey]: number | null } }` e.g. `benchmarking`, `audience`, `messaging`, `content_overview`, `earnings`, `results`. When present, these are also merged into `metrics` with a prefixed key for backward compatibility.
- `recent_content`, `top_content_by_views`, `top_content_by_interactions` (optional): arrays of `{ content_preview?, post_date?, views?, likes?, shares?, interactions? }` for recent/top content items.

### Post
- `post_date`: ISO date (YYYY-MM-DD) when post was published
- `post_date_display`: Original format e.g. "Jan 21"
- `post`: `{ views, likes, reposts, replies, content_preview, format, shares? }`

### Metric keys (dashboard)

All keys are snake_case. Only values clearly visible in the screenshot are set; others are null.

**Core (all platforms):** impressions, engagement_rate, followers, profile_visits, engagements, saves, shares, replies, likes, reposts, bookmarks, reach, page_likes, reactions, comments, post_clicks.

**Facebook / Meta Business Suite:** published_content, facebook_followers, follows, content_interactions, typically_followers, typically_follows, typically_interactions, views, viewers, link_clicks, reach_goal_current, reach_goal_target, returning_viewers, engaged_followers, messaging_contacts, unfollows, net_follows, followers_lifetime, daily_response_rate, daily_response_time, conversations_started, total_messaging_contacts, new_messaging_contacts, returning_messaging_contacts, messaging_conversations_started, total_contacts, new_contacts_organic, new_contacts_paid, returning_contacts_organic, returning_contacts_paid, views_3s, views_1m, watch_time_s, views_organic, views_ads, approximate_earnings, earnings_change_pct, tasks_completed, tasks_total, instagram_posts_published, instagram_views, facebook_posts_progress, first_ad_progress, instagram_posts_progress.

**Instagram:** views, viewers, views_followers_pct, views_non_followers_pct, posts_pct, reels_pct, total_interactions, interactions_followers_pct, interactions_non_followers_pct, accounts_engaged, posts_interactions_pct, reels_interactions_pct, profile_activity.

**LinkedIn:** post_impressions, post_impressions_change_7d, followers_change_7d, profile_viewers_90d, search_appearances_week, weekly_actions_done, weekly_actions_goal, posts_this_week, comments_this_week.

**Referral-related (map from UI labels when present):** shares, link_clicks, new_messaging_contacts, messaging_conversations_started, search_appearances_week.

## Querying

**Date range** (for historical analysis):
```
GET /api/analytics-snapshots?platform=x&type=post&from=2025-01-01&to=2025-02-28
```

- `from`, `to`: ISO dates. For posts, filters by `post_date`. For dashboards, by `period_end` or `created_at`.

**Type filter**:
- `type=post` — single post screenshots only
- `type=dashboard` — analytics dashboard screenshots only

## Future Analysis Use Cases

1. **Month-over-month**: `from=2025-01-01&to=2025-01-31` vs `from=2025-02-01&to=2025-02-28`
2. **Year-over-year**: Compare same month across years
3. **Content performance**: `content_preview` + `format` for topic/format analysis
4. **Trend aggregation**: `time_series` with `period_date` for reliable date grouping
5. **Best performing period**: Query by metric, sort by period

## Normalization

`normalizeExtractedData()` runs before insert:
- Adds `extracted_at`
- Normalizes all dates to ISO
- Infers `period_start`/`period_end` from `time_series` if not extracted
- Adds `period_date` to time_series points for querying
- If `sections` is present, flattens each section's metrics into the top-level `metrics` object with prefixed keys (e.g. `benchmarking_published_content`) via `flattenSectionsIntoMetrics()`, so UI can read everything from `metrics` without duplicating logic