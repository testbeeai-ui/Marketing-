"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { authService } from "@/lib/auth";
import {
  ArrowLeft,
  AlertTriangle,
  Camera,
  Lightbulb,
  Bot,
  TrendingUp,
  Target,
  ArrowRight,
  LayoutGrid,
  ChevronRight,
  Instagram,
  BarChart2,
  Users,
  Eye,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useRouter } from "next/navigation";
import { useDemoMode } from "@/lib/contexts/DemoModeContext";
import { toast } from "sonner";
import { AnalyticsChatPanel } from "@/components/storyteller/AnalyticsChatPanel";
import { AnalyticsChatProvider } from "@/lib/contexts/AnalyticsChatContext";
import { getPlatformWatchByPlatform } from "@/lib/storyteller/platformWatch";
import { DemoRestrictionDialog } from "@/components/DemoRestrictionDialog";

// Instagram gradient colors
const IG_PINK = "#E4405F";
const IG_PURPLE = "#C13584";

const DEMO_REACH_DATA = [
  { period: "Jan 28", value: 1250 },
  { period: "Jan 31", value: 980 },
  { period: "Feb 3", value: 2100 },
  { period: "Feb 6", value: 1650 },
  { period: "Feb 9", value: 1420 },
];

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
}

interface ContentItem {
  content_preview?: string;
  post_date?: string;
  views?: number;
  likes?: number;
  shares?: number;
  interactions?: number;
}

function MetricBlock({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  const display = typeof value === "number" && (value > 999 || value < -999) ? value.toLocaleString() : String(value);
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 dark:bg-background/50 p-4">
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p className="text-xl font-bold tabular-nums mt-0.5">{display}{suffix}</p>
    </div>
  );
}

interface Snapshot {
  id: string;
  platform: string;
  image_url: string;
  extracted_data?: {
    metrics?: Record<string, number | null>;
    time_series?: { period: string; value: number }[];
    format_performance?: { format?: string | null; insight?: string | null };
    strategic_analysis?: {
      anomaly_detected?: string;
      actionable_advice?: string;
    };
    sections?: Record<string, Record<string, number | null>>;
    recent_content?: ContentItem[] | null;
    top_content_by_views?: ContentItem[] | null;
    top_content_by_interactions?: ContentItem[] | null;
  } | null;
  ai_insights?: {
    anomaly_detected?: string;
    actionable_advice?: string;
  } | null;
  created_at: string;
}

export function InstagramDeepDiveContent() {
  const router = useRouter();
  const { demoMode } = useDemoMode();
  const { activeOrganization, isDemoMode } = useOrganization();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [showRequestAccess, setShowRequestAccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [screenshotsUploadedTrigger, setScreenshotsUploadedTrigger] = useState(0);

  const useDemo = demoMode || isDemoMode;
  const platformWatch = getPlatformWatchByPlatform("instagram");
  const isMember = activeOrganization?.role === "member";

  const fetchData = useCallback(async () => {
    if (!activeOrganization?.id) return;
    try {
      const token = await authService.getSessionToken();
      const res = await fetch(
        `/api/analytics-snapshots?limit=20&platform=instagram&type=dashboard&organizationId=${activeOrganization.id}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      if (res.ok) {
        const data = (await res.json()) as Snapshot[];
        if (data?.length > 0) {
          const igSnapshot = data.find((s) => s.platform.toLowerCase() === "instagram") || data[0];
          setSnapshot(igSnapshot);
        }
      }
    } catch {
      // ignore
    }
  }, [activeOrganization?.id]);

  useEffect(() => {
    if (useDemo) return;
    fetchData();
  }, [useDemo, fetchData]);

  const processFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter(
        (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024
      );
      if (valid.length === 0) {
        toast.error("Use JPEG, PNG, or WebP (max 10MB each).");
        return;
      }
      setUploading(true);
      let successCount = 0;
      try {
        for (let i = 0; i < valid.length; i++) {
          setUploadProgress({ current: i + 1, total: valid.length });
          if (!activeOrganization?.id) {
            toast.error("No active organization selected");
            continue;
          }
          const formData = new FormData();
          formData.append("file", valid[i]);
          formData.append("platform", "instagram");
          formData.append("organizationId", activeOrganization.id);
          const res = await fetch("/api/analyze-screenshot", { method: "POST", body: formData });
          if (res.ok) successCount++;
          else {
            const err = (await res.json()) as { error?: string; details?: string };
            toast.error(`${valid[i].name}: ${err.error || "Failed"}`, {
              description: err.details,
              duration: err.details ? 10000 : 5000,
            });
          }
        }
        if (successCount > 0) {
          toast.success(`${successCount} screenshot${successCount > 1 ? "s" : ""} analyzed`);
          fetchData();
          setUploadOpen(false);
          setScreenshotsUploadedTrigger((t) => t + 1);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploadProgress(null);
        setUploading(false);
      }
    },
    [fetchData]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      if (files.length) processFiles(files);
    },
    [processFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length) processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const extracted = snapshot?.extracted_data || {};
  const metrics = extracted.metrics || {};
  const timeSeries =
    useDemo ? DEMO_REACH_DATA : extracted.time_series?.map((p) => ({ period: p.period, value: p.value })) || [];

  const reach = useDemo ? 7400 : (metrics.reach ?? metrics.impressions ?? 0);
  const impressions = useDemo ? 11200 : (metrics.impressions ?? metrics.reach ?? 0);
  const rawEngagement = useDemo ? 4.8 : (metrics.engagement_rate ?? 0);
  const engagementRate = rawEngagement > 0 && rawEngagement < 1 ? rawEngagement * 100 : rawEngagement;
  const profileVisits = useDemo ? 340 : (metrics.profile_visits ?? 0);
  const followers = useDemo ? 8450 : (metrics.followers ?? 0);
  const likes = useDemo ? 356 : (metrics.likes ?? 0);
  const comments = useDemo ? 42 : (metrics.replies ?? metrics.comments ?? 0);
  const saves = useDemo ? 89 : (metrics.saves ?? metrics.bookmarks ?? 0);
  const shares = useDemo ? 28 : (metrics.shares ?? 0);

  const views = metrics.views ?? null;
  const viewers = metrics.viewers ?? null;
  const viewsFollowersPct = metrics.views_followers_pct ?? null;
  const viewsNonFollowersPct = metrics.views_non_followers_pct ?? null;
  const postsPct = metrics.posts_pct ?? null;
  const reelsPct = metrics.reels_pct ?? null;
  const totalInteractions = metrics.total_interactions ?? null;
  const interactionsFollowersPct = metrics.interactions_followers_pct ?? null;
  const interactionsNonFollowersPct = metrics.interactions_non_followers_pct ?? null;
  const accountsEngaged = metrics.accounts_engaged ?? null;
  const postsInteractionsPct = metrics.posts_interactions_pct ?? null;
  const reelsInteractionsPct = metrics.reels_interactions_pct ?? null;
  const profileActivity = metrics.profile_activity ?? null;

  const hasAccountInsights = [views, viewers, viewsFollowersPct, viewsNonFollowersPct].some((v) => v != null);
  const hasByContentType = [postsPct, reelsPct].some((v) => v != null);
  const hasInteractions = [totalInteractions, interactionsFollowersPct, interactionsNonFollowersPct, accountsEngaged].some((v) => v != null);
  const hasByContentInteractions = [postsInteractionsPct, reelsInteractionsPct].some((v) => v != null);
  const hasProfile = [profileActivity, profileVisits].some((v) => v != null);
  const topContentByViews = (extracted.top_content_by_views ?? []) as ContentItem[];
  const topContentByInteractions = (extracted.top_content_by_interactions ?? []) as ContentItem[];
  const hasTopContent = (topContentByViews.length > 0 || topContentByInteractions.length > 0) && !useDemo;

  const anomalyText = useDemo
    ? "Shares (sends) per reach dropped—authenticity and DMs matter more than likes. Reels underperforming vs carousels this week."
    : snapshot?.ai_insights?.anomaly_detected || extracted.strategic_analysis?.anomaly_detected || null;

  const actionableAdvice = useDemo
    ? "Prioritize shares and saves. Use 90-day retention—export data regularly. Optimize carousels with slide-level engagement insights."
    : snapshot?.ai_insights?.actionable_advice || extracted.strategic_analysis?.actionable_advice || null;

  const formatInsight = extracted.format_performance?.insight || null;

  const metricCards: MetricCard[] = useDemo
    ? [
        { label: "Reach", value: reach.toLocaleString(), change: 12 },
        { label: "Impressions", value: impressions.toLocaleString(), change: 8 },
        { label: "Engagement rate", value: `${engagementRate}%`, change: -0.5 },
        { label: "Profile visits", value: profileVisits, change: 15 },
        { label: "Followers", value: followers.toLocaleString(), change: 2.1 },
        { label: "Likes", value: likes, change: -8 },
        { label: "Comments", value: comments, change: 12 },
        { label: "Saves", value: saves, change: 22 },
        { label: "Shares (sends)", value: shares, change: -15 },
      ]
    : [
        { label: "Reach", value: reach },
        { label: "Impressions", value: impressions },
        { label: "Engagement rate", value: `${engagementRate}%` },
        { label: "Profile visits", value: profileVisits },
        { label: "Followers", value: followers },
        { label: "Likes", value: likes },
        { label: "Comments", value: comments },
        { label: "Saves", value: saves },
        { label: "Shares (sends)", value: shares },
      ];

  return (
    <AnalyticsChatProvider platform="instagram" demoMode={useDemo} panelOpen={chatOpen} screenshotsUploadedTrigger={screenshotsUploadedTrigger}>
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6 storyteller bg-gradient-to-b from-muted/20 to-transparent min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mb-4 text-muted-foreground hover:text-foreground"
                  onClick={() => router.push("/storyteller")}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-[#E4405F] via-[#C13584] to-[#833AB4]">
                      <Instagram className="w-5 h-5 text-white" />
                    </div>
                    Instagram Deep Dive
                  </h1>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      useDemo ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                    }`}
                  >
                    {useDemo ? "Sample data" : "Your data"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => (useDemo ? setShowRequestAccess(true) : setUploadOpen(true))}
                className="bg-gradient-to-r from-[#E4405F] to-[#C13584] hover:opacity-90 text-white shadow-sm shrink-0"
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload Instagram Screenshot
              </Button>
            </div>
          </motion.div>

          {/* Platform Watch */}
          {platformWatch && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40 bg-gradient-to-br from-pink-50/60 to-purple-50/40 dark:from-pink-950/20 dark:to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Algorithm Direction</CardTitle>
                  <p className="text-sm text-muted-foreground italic">{platformWatch.algorithmDirection}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {platformWatch.updates.slice(0, 3).map((u, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${u.impact === "high" ? "bg-amber-500" : "bg-pink-500/60"}`} />
                        <span><strong>{u.headline}.</strong> {u.description}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Anomaly + Quick Insights */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {anomalyText && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Anomaly Alert</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{anomalyText}</p>
                    {actionableAdvice && (
                      <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-1.5">Recommended Action</p>
                        <p className="text-sm text-amber-900 dark:text-amber-100">→ {actionableAdvice}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById("analytics-chart")?.scrollIntoView({ behavior: "smooth" })}
                  className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300"
                >
                  Access charts & full analytics <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {(useDemo || (snapshot && reach > 0)) && (anomalyText || reach > 0) && (
              <Card className="border-pink-200/60 dark:border-pink-900/50 bg-gradient-to-br from-pink-50/80 to-purple-50/40 dark:from-pink-950/20 dark:to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-pink-600" />
                    Quick Insights
                    {useDemo && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(sample)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                      <span><strong>Sends per reach:</strong> Shares/DMs drive distribution more than likes. Optimize for saves and sends.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                      <span><strong>90-day retention:</strong> Export analytics monthly. Views are now universal across Reels, Stories, Posts.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                      <span><strong>Carousel optimization:</strong> Use slide-level engagement to improve weak slides. Post-level follower growth shows which content converts.</span>
                    </li>
                    {formatInsight && (
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 text-pink-500 shrink-0 mt-0.5" />
                        <span>{formatInsight}</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Reach Chart */}
          <motion.div id="analytics-chart" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <Card className="border-pink-200/80 dark:border-pink-800/50 bg-gradient-to-br from-white to-pink-50/30 dark:from-background dark:to-pink-950/10 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-600" />
                  Reach Over Time
                </CardTitle>
                <p className="text-sm text-muted-foreground">Account reach across Reels, Stories, Posts</p>
              </CardHeader>
              <CardContent className="pt-0">
                {timeSeries.length === 0 && !useDemo ? (
                  <div
                    className="h-[280px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-pink-500/30 transition-colors cursor-pointer"
                    onClick={() => (useDemo ? setShowRequestAccess(true) : setUploadOpen(true))}
                  >
                    <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No reach data yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Upload Instagram Insights screenshots to see trends</p>
                    <Button variant="outline" size="sm" className="mt-4 border-pink-500/50 text-pink-600 hover:bg-pink-50">
                      <Camera className="w-3.5 h-3.5 mr-2" /> Upload
                    </Button>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ChartContainer config={{ reach: { label: "Reach", color: IG_PINK } }} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={[0, "auto"]} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill={IG_PINK} radius={[4, 4, 0, 0]} name="Reach" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Key Metrics */}
          <motion.div id="key-metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/10 dark:to-background">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-600" />
                  Key Metrics
                </CardTitle>
                <p className="text-sm text-muted-foreground">Snapshot of your Instagram performance</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {metricCards.map((card, i) => (
                    <div key={i} className="rounded-lg border border-border/70 bg-background/80 dark:bg-background/50 p-4 shadow-sm">
                      <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                      <p className="text-xl font-bold tabular-nums mt-0.5 truncate">
                        {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                      </p>
                      {card.change !== undefined && (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${card.change >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {card.change >= 0 ? "↑" : ""}{card.change < 0 ? card.change : `+${card.change}`}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Account insights */}
          {hasAccountInsights && !useDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="w-4 h-4 text-pink-600" />
                    Account insights
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Views, viewers, followers vs non-followers</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {views != null && <MetricBlock label="Views" value={views} />}
                    {viewers != null && <MetricBlock label="Viewers" value={viewers} />}
                    {viewsFollowersPct != null && <MetricBlock label="Views from followers" value={viewsFollowersPct} suffix="%" />}
                    {viewsNonFollowersPct != null && <MetricBlock label="Views from non-followers" value={viewsNonFollowersPct} suffix="%" />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* By content type */}
          {hasByContentType && !useDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-pink-600" />
                    By content type
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Posts vs Reels distribution</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {postsPct != null && <MetricBlock label="Posts" value={postsPct} suffix="%" />}
                    {reelsPct != null && <MetricBlock label="Reels" value={reelsPct} suffix="%" />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Interactions */}
          {hasInteractions && !useDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-600" />
                    Interactions
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Total interactions, followers vs non-followers, accounts engaged</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {totalInteractions != null && <MetricBlock label="Total interactions" value={totalInteractions} />}
                    {interactionsFollowersPct != null && <MetricBlock label="From followers" value={interactionsFollowersPct} suffix="%" />}
                    {interactionsNonFollowersPct != null && <MetricBlock label="From non-followers" value={interactionsNonFollowersPct} suffix="%" />}
                    {accountsEngaged != null && <MetricBlock label="Accounts engaged" value={accountsEngaged} />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* By content interactions */}
          {hasByContentInteractions && !useDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-pink-600" />
                    By content interactions
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Posts vs Reels interaction share</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {postsInteractionsPct != null && <MetricBlock label="Posts" value={postsInteractionsPct} suffix="%" />}
                    {reelsInteractionsPct != null && <MetricBlock label="Reels" value={reelsInteractionsPct} suffix="%" />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Profile */}
          {hasProfile && !useDemo && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-pink-600" />
                    Profile
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">Profile activity and visits</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {profileActivity != null && <MetricBlock label="Profile activity" value={profileActivity} />}
                    {profileVisits != null && <MetricBlock label="Profile visits" value={profileVisits} />}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Top content by views / by interactions */}
          {hasTopContent && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.09 }}>
              <Card className="border-pink-200/60 dark:border-pink-900/40">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-pink-600" />
                    Top content
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">By views and by interactions</p>
                </CardHeader>
                <CardContent>
                  {topContentByViews.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">By views</p>
                      <ul className="space-y-2">
                        {topContentByViews.slice(0, 5).map((item, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3 text-sm">
                            {item.content_preview && <span className="flex-1 min-w-0 truncate">{item.content_preview}</span>}
                            {item.post_date && <span className="text-muted-foreground">{item.post_date}</span>}
                            {item.views != null && <span>Views: {item.views}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {topContentByInteractions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">By interactions</p>
                      <ul className="space-y-2">
                        {topContentByInteractions.slice(0, 5).map((item, i) => (
                          <li key={i} className="flex flex-wrap items-center gap-3 rounded-lg border border-border/70 p-3 text-sm">
                            {item.content_preview && <span className="flex-1 min-w-0 truncate">{item.content_preview}</span>}
                            {item.post_date && <span className="text-muted-foreground">{item.post_date}</span>}
                            {item.interactions != null && <span>Interactions: {item.interactions}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Engagement Funnel */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-950/10 dark:to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-pink-600" />
                  Engagement Funnel
                </CardTitle>
                <p className="text-sm text-muted-foreground">Reach → Likes/Comments/Saves → Profile Visits · Saves & shares matter most</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-pink-600">{reach.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Reach</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{(likes + comments + saves).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Likes + Comments + Saves</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {reach ? `${(((likes + comments + saves) / reach) * 100).toFixed(1)}% conversion` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{profileVisits.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Profile Visits</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {reach ? `${((profileVisits / reach) * 100).toFixed(2)}% of reach` : "—"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Instagram Screenshot</DialogTitle>
            <DialogDescription>
              Upload Insights screenshots (Overview, Content, Audience). Our AI extracts reach, impressions, engagement, saves, and shares.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="instagram-screenshot-upload"
            className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Camera className="w-10 h-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click or drag Instagram Insights screenshots</span>
            <span className="text-xs text-muted-foreground/70 mt-1">JPEG, PNG, WebP · Max 10MB each</span>
            <input
              id="instagram-screenshot-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <p className="text-sm text-pink-600">
              {uploadProgress ? `Analyzing ${uploadProgress.current} of ${uploadProgress.total}...` : "Analyzing..."}
            </p>
          )}
        </DialogContent>
      </Dialog>
      <DemoRestrictionDialog
        open={showRequestAccess}
        onOpenChange={setShowRequestAccess}
        title="Request access to upload analytics"
        description="You're in demo mode. To upload Instagram screenshots and get AI-powered insights, request access. Share your details and we'll get you set up."
      />

      {!isMember && (
        <>
          <Button
            aria-label="Open Instagram Analytics Assistant"
            onClick={() => setChatOpen(true)}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-r from-[#E4405F] to-[#C13584] shadow-lg hover:opacity-90"
          >
            <Bot className="h-7 w-7 text-white" strokeWidth={2} />
          </Button>
          <AnalyticsChatPanel open={chatOpen} onOpenChange={setChatOpen} />
        </>
      )}
    </div>
    </AnalyticsChatProvider>
  );
}
