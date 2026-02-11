# Analytics Storage Schema

Long-term, analysis-ready storage for StoryTeller analytics. Designed for reliable queries over 1 month, 1 year, and beyond—without re-analyzing images.

## Stored Fields (in `extracted_data`)

### Common (all snapshots)
- `snapshot_type`: `"dashboard"` | `"post"`
- `platform`: `"x"` | `"linkedin"` | `"instagram"` | `"facebook"`
- `extracted_at`: ISO timestamp when AI analysis ran

### Dashboard
- `period_start`, `period_end`: ISO dates (YYYY-MM-DD) for the chart's date range
- `metrics`: impressions, engagement_rate, followers, etc.
- `time_series`: `[{ period, value, period_date? }]` — `period_date` is normalized ISO for range queries
- `strategic_analysis`: anomaly_detected, actionable_advice, mood
- `format_performance`, `semantic_intent`

### Post
- `post_date`: ISO date (YYYY-MM-DD) when post was published
- `post_date_display`: Original format e.g. "Jan 21"
- `post`: `{ views, likes, reposts, replies, content_preview, format }`

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
