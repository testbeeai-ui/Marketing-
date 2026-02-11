/**
 * Analytics Storage Schema
 * Designed for long-term analysis: 1 month, 1 year, and beyond.
 * All dates in ISO 8601 (YYYY-MM-DD) for reliable range queries.
 */

export type SnapshotType = 'dashboard' | 'post';

/** Parses various date formats to ISO YYYY-MM-DD. Returns null if unparseable. */
export function normalizeDate(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // "Jan 21", "Jan 21, 2025", "21 Jan 2025"
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  // "Jan 21" without year - assume current year
  const shortMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (shortMatch) {
    const [, month, day] = shortMatch;
    const y = new Date().getFullYear();
    const parsed = new Date(`${month} ${day}, ${y}`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

/** Infer period from time_series when not explicitly extracted */
function inferPeriodFromTimeSeries(series: Array<{ period?: string; value?: number }> | null): { start: string | null; end: string | null } {
  if (!series || series.length === 0) return { start: null, end: null };
  const dates = series.map((p) => normalizeDate(p.period)).filter((d): d is string => d != null);
  if (dates.length === 0) return { start: null, end: null };
  return { start: dates.sort()[0], end: dates.sort().pop() ?? null };
}

export interface NormalizedExtractedData {
  snapshot_type: SnapshotType;
  platform: string;
  /** When this extraction ran (ISO timestamp) */
  extracted_at: string;
  /** For dashboards: period the data covers (ISO dates) */
  period_start: string | null;
  period_end: string | null;
  /** For posts: when the post was published (ISO date) */
  post_date: string | null;
  /** For posts: display format e.g. "Jan 21" */
  post_date_display: string | null;
  metrics: Record<string, number | null> | null;
  time_series: Array<{ period: string; value: number; period_date?: string }> | null;
  format_performance: { format: string | null; insight: string | null } | null;
  semantic_intent: Array<{ label: string; percent: number }> | null;
  strategic_analysis: {
    mood: string | null;
    anomaly_detected: string | null;
    actionable_advice: string | null;
    resonance_label: string | null;
  } | null;
  /** For posts: full extracted post data */
  post: {
    views: number | null;
    likes: number | null;
    reposts: number | null;
    replies: number | null;
    post_date: string | null;
    content_preview: string | null;
    format: string | null;
  } | null;
}

/**
 * Normalizes raw AI output into analysis-ready format.
 * Adds extracted_at, normalizes dates, ensures schema consistency.
 */
export function normalizeExtractedData(raw: Record<string, unknown>): Record<string, unknown> {
  const extractedAt = new Date().toISOString();
  const snapshotType = (raw.snapshot_type === 'post' ? 'post' : 'dashboard') as SnapshotType;
  const post = raw.post as Record<string, unknown> | null | undefined;

  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  let postDate: string | null = null;
  let postDateDisplay: string | null = null;

  if (snapshotType === 'post' && post) {
    const pd = post.post_date as string | null | undefined;
    postDateDisplay = pd && typeof pd === 'string' ? pd : null;
    postDate = normalizeDate(pd) ?? postDateDisplay;
  } else {
    periodStart = normalizeDate(raw.period_start as string) ?? null;
    periodEnd = normalizeDate(raw.period_end as string) ?? null;
    if (!periodStart || !periodEnd) {
      const inferred = inferPeriodFromTimeSeries(raw.time_series as Array<{ period?: string }> | null);
      periodStart = periodStart ?? inferred.start;
      periodEnd = periodEnd ?? inferred.end;
    }
  }

  const timeSeries = (raw.time_series as Array<{ period?: string; value?: number }> | null)?.map((p) => ({
    period: p.period ?? '',
    value: typeof p.value === 'number' ? p.value : 0,
    period_date: normalizeDate(p.period) ?? undefined,
  })) ?? null;

  return {
    ...raw,
    snapshot_type: snapshotType,
    extracted_at: extractedAt,
    period_start: periodStart,
    period_end: periodEnd,
    post_date: postDate,
    post_date_display: postDateDisplay,
    time_series: timeSeries,
  };
}

/** Get queryable date for filtering (post_date for posts, period_end or created_at for dashboards) */
export function getAnalyticsDate(row: { created_at: string; extracted_data?: Record<string, unknown> | null }): string {
  const ed = row.extracted_data as Record<string, unknown> | null | undefined;
  if (!ed) return row.created_at.slice(0, 10);
  if (ed.snapshot_type === 'post' && ed.post_date) return ed.post_date as string;
  if (ed.period_end) return ed.period_end as string;
  return row.created_at.slice(0, 10);
}
