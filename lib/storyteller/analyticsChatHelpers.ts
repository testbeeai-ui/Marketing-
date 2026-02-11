/**
 * Shared helpers for analytics chat context and prompt building.
 */

export function buildDataSummaryForPrompt(
  snapshots: { extracted_data?: unknown; ai_insights?: unknown }[]
): object {
  const dashboards = snapshots.filter((s) => {
    const ed = s.extracted_data as Record<string, unknown> | null;
    return ed && ed.snapshot_type === 'dashboard';
  });
  const posts = snapshots.filter((s) => {
    const ed = s.extracted_data as Record<string, unknown> | null;
    return ed && (ed.snapshot_type === 'post' || ed.post);
  });

  const latest = dashboards[0]?.extracted_data as Record<string, unknown> | null;
  const metrics = (latest?.metrics as Record<string, unknown>) ?? {};
  const timeSeries = (latest?.time_series as Array<{ period: string; value: number }>) ?? [];
  const strategic =
    (latest?.strategic_analysis ||
      (dashboards[0] as { ai_insights?: Record<string, unknown> })?.ai_insights) as
      | Record<string, unknown>
      | undefined;

  const postPreviews = (
    posts as {
      extracted_data?: {
        post?: { content_preview?: string; post_date?: string; views?: number };
      };
    }[]
  )
    .slice(0, 5)
    .map((p) => {
      const post = p.extracted_data?.post;
      if (!post) return null;
      return {
        date: post.post_date,
        preview: (post.content_preview ?? '').slice(0, 80),
        views: post.views,
      };
    })
    .filter(Boolean);

  const peaks =
    timeSeries.length > 0
      ? timeSeries
          .sort((a, b) => b.value - a.value)
          .slice(0, 3)
          .map((p) => `${p.period}: ${p.value}`)
      : [];

  return {
    metrics,
    period_start: latest?.period_start,
    period_end: latest?.period_end,
    anomaly_detected: strategic?.anomaly_detected,
    actionable_advice: strategic?.actionable_advice,
    time_series_peaks: peaks,
    post_previews: postPreviews,
  };
}

export function buildPreferenceSummaryText(liked: string[], disliked: string[]): string {
  if (liked.length === 0 && disliked.length === 0) return 'No preference history yet.';
  const parts: string[] = [];
  if (liked.length > 0) {
    parts.push(`User liked responses that were: specific, actionable, and concise. Examples of liked content: ${liked.slice(0, 2).join('; ')}`);
  }
  if (disliked.length > 0) {
    parts.push(`User disliked responses that were: too long, vague, or lacking actionable steps.`);
  }
  return parts.join(' ');
}
