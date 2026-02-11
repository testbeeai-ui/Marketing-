"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AlertTriangle, BarChart3, ChevronDown, Info, Camera, Lightbulb, Bot, TrendingUp, Target, ArrowRight, ArrowUpRight, ArrowDownRight, FileText, LayoutGrid, ChevronRight } from "lucide-react";
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
  Cell,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useRouter } from "next/navigation";
import { Twitter } from "lucide-react";
import { useDemoMode } from "@/lib/contexts/DemoModeContext";
import { toast } from "sonner";
import { AnalyticsChatPanel } from "@/components/storyteller/AnalyticsChatPanel";
import { AnalyzingOverlay } from "@/components/storyteller/AnalyzingOverlay";
import { AnalyticsChatProvider } from "@/lib/contexts/AnalyticsChatContext";

// Demo data matching Twitter Analytics dashboard
const DEMO_IMPRESSIONS_DATA = [
  { period: "Jan 28", value: 45 },
  { period: "Jan 29", value: 62 },
  { period: "Jan 30", value: 38 },
  { period: "Jan 31", value: 55 },
  { period: "Feb 1", value: 28 },
  { period: "Feb 2", value: 195 },
  { period: "Feb 3", value: 198 },
  { period: "Feb 4", value: 120 },
  { period: "Feb 5", value: 85 },
  { period: "Feb 6", value: 42 },
  { period: "Feb 7", value: 35 },
  { period: "Feb 8", value: 22 },
  { period: "Feb 9", value: 30 },
  { period: "Feb 10", value: 18 },
];

const DEMO_FOLLOWS_DATA = [
  { period: "Jan 28", net: 1 },
  { period: "Jan 31", net: 0 },
  { period: "Feb 3", net: 2 },
  { period: "Feb 6", net: -6 },
  { period: "Feb 9", net: 1 },
];

const DEMO_POSTS_REPLIES_DATA = [
  { period: "Jan 28", posts: 1, replies: 0 },
  { period: "Jan 31", posts: 0, replies: 2 },
  { period: "Feb 3", posts: 2, replies: 8 },
  { period: "Feb 6", posts: 0, replies: 1 },
  { period: "Feb 9", posts: 1, replies: 0 },
];

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
}

interface PostData {
  views?: number | null;
  likes?: number | null;
  reposts?: number | null;
  replies?: number | null;
  post_date?: string | null;
  content_preview?: string | null;
  format?: string | null;
}

interface Snapshot {
  id: string;
  platform: string;
  image_url: string;
  extracted_data?: {
    snapshot_type?: "dashboard" | "post";
    metrics?: Record<string, number | null>;
    time_series?: { period: string; value: number }[];
    format_performance?: { format?: string | null; insight?: string | null };
    strategic_analysis?: {
      anomaly_detected?: string;
      actionable_advice?: string;
      resonance_label?: string;
    };
    post?: PostData | null;
  } | null;
  ai_insights?: {
    anomaly_detected?: string;
    actionable_advice?: string;
  } | null;
  created_at: string;
}

export function XDeepDiveContent() {
  const router = useRouter();
  const { demoMode } = useDemoMode();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [posts, setPosts] = useState<Snapshot[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [primaryMetric, setPrimaryMetric] = useState("Impressions");
  const [secondaryMetric, setSecondaryMetric] = useState("Select secondary metric");
  const [granularity, setGranularity] = useState("Daily");
  const [chatOpen, setChatOpen] = useState(false);
  const [pageGreetingLength, setPageGreetingLength] = useState(0);
  const [screenshotsUploadedTrigger, setScreenshotsUploadedTrigger] = useState(0);

  const useDemo = demoMode;

  const PAGE_GREETING_TEXT = "Hello I am Twitter bot for deep analysis and doubts.";

  // Typewriter greeting on the page (timeline format)
  useEffect(() => {
    setPageGreetingLength(0);
    const fullLen = PAGE_GREETING_TEXT.length;
    const interval = setInterval(() => {
      setPageGreetingLength((prev) => {
        if (prev >= fullLen) {
          clearInterval(interval);
          return fullLen;
        }
        return prev + 1;
      });
    }, 55);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, postsRes] = await Promise.all([
        fetch("/api/analytics-snapshots?limit=20&platform=x&type=dashboard"),
        fetch("/api/analytics-snapshots?limit=20&platform=x&type=post"),
      ]);
      if (dashRes.ok) {
        const data = (await dashRes.json()) as Snapshot[];
        if (data?.length > 0) {
          const xSnapshot = data.find((s) => s.platform.toLowerCase() === "x") || data[0];
          setSnapshot(xSnapshot);
        }
      }
      if (postsRes.ok) {
        const postData = (await postsRes.json()) as Snapshot[];
        setPosts(postData || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (useDemo) return;
    fetchData();
  }, [useDemo, fetchData]);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(
      (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024
    );
    if (valid.length === 0) {
      toast.error("Use JPEG, PNG, or WebP (max 10MB each).");
      return;
    }
    setUploading(true);
    setUploadOpen(false);
    setUploadProgress({ current: 1, total: valid.length });
    let successCount = 0;
    let lastSnapshot: Snapshot | null = null;
    try {
      for (let i = 0; i < valid.length; i++) {
        setUploadProgress({ current: i + 1, total: valid.length });
        const formData = new FormData();
        formData.append("file", valid[i]);
        formData.append("platform", "x");
        const res = await fetch("/api/analyze-screenshot", { method: "POST", body: formData });
        if (res.ok) {
          const { snapshot: s } = await res.json();
          lastSnapshot = s as Snapshot;
          successCount++;
        } else {
          const err = (await res.json()) as { error?: string; details?: string };
          toast.error(`${valid[i].name}: ${err.error || "Failed"}`, {
            description: err.details,
            duration: err.details ? 10000 : 5000,
          });
        }
      }
      setUploadProgress(null);
      if (successCount > 0) {
        toast.success(
          successCount === valid.length
            ? `${successCount} screenshot${successCount > 1 ? "s" : ""} analyzed`
            : `${successCount} of ${valid.length} analyzed`
        );
        fetchData();
        setUploadOpen(false);
        setScreenshotsUploadedTrigger((t) => t + 1);
      }
    } catch (err) {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [fetchData]);

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
      const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      if (files.length) processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const extracted = snapshot?.extracted_data || {};
  const metrics = extracted.metrics || {};
  const timeSeries = useDemo
    ? DEMO_IMPRESSIONS_DATA
    : extracted.time_series?.map((p) => ({ period: p.period, value: p.value })) || [];

  const impressions = useDemo ? 798 : (metrics.impressions ?? 0);
  const rawEngagement = useDemo ? 19.2 : (metrics.engagement_rate ?? 0);
  const engagementRate = rawEngagement > 0 && rawEngagement < 1 ? rawEngagement * 100 : rawEngagement;
  const engagements = useDemo ? 154 : (metrics.engagements ?? 0);
  const replies = useDemo ? 9 : (metrics.replies ?? 0);
  const likes = useDemo ? 21 : (metrics.likes ?? 0);
  const reposts = useDemo ? 2 : (metrics.reposts ?? 0);
  const profileVisits = useDemo ? 3 : (metrics.profile_visits ?? 0);
  const bookmarks = useDemo ? 0 : (metrics.bookmarks ?? 0);
  const shares = useDemo ? 1 : (metrics.shares ?? 0);
  const followers = useDemo ? 2300 : (metrics.followers ?? 0);
  const verifiedFollowers = useDemo ? 31 : null;

  // Demo mode: ONLY demo content. Real mode: ONLY uploaded snapshot data. Never mix.
  const anomalyText = useDemo
    ? "Reach crashed (-19%) immediately after switching to single images."
    : (snapshot?.ai_insights?.anomaly_detected || extracted.strategic_analysis?.anomaly_detected || null);

  const actionableAdvice = useDemo
    ? "Analyze the content posted on Feb 2–3 to understand the impression spike and replicate that success. Focus on distribution—high engagement rate suggests content resonates, but reach is declining."
    : (snapshot?.ai_insights?.actionable_advice || extracted.strategic_analysis?.actionable_advice || null);

  const formatInsight = useDemo ? null : (extracted.format_performance?.insight || null);

  const metricCards: MetricCard[] = useDemo
    ? [
        {
          label: "Verified followers",
          value: `${verifiedFollowers ?? 0} / ${followers >= 1000 ? `${(followers / 1000).toFixed(1)}K` : followers}`,
          icon: <span className="text-blue-500">✓</span>,
        },
        { label: "Impressions", value: impressions, change: -19 },
        { label: "Engagement rate", value: `${engagementRate}%`, change: 0.4 },
        { label: "Engagements", value: engagements, change: -19 },
        { label: "Replies", value: replies, change: 80 },
        { label: "Likes", value: likes, change: -47 },
        { label: "Reposts", value: reposts, change: -80 },
        { label: "Profile visits", value: profileVisits, change: -75 },
        { label: "Bookmarks", value: bookmarks, change: -100 },
        { label: "Shares", value: shares, change: 10000 },
      ]
    : [
        { label: "Verified followers", value: followers, icon: <span className="text-blue-500">✓</span> },
        { label: "Impressions", value: impressions },
        { label: "Engagement rate", value: `${engagementRate}%` },
        { label: "Engagements", value: engagements },
        { label: "Replies", value: replies },
        { label: "Likes", value: likes },
        { label: "Reposts", value: reposts },
        { label: "Profile visits", value: profileVisits },
        { label: "Bookmarks", value: bookmarks },
        { label: "Shares", value: shares },
      ];

  const followsData = useDemo ? DEMO_FOLLOWS_DATA : [];
  const postsRepliesData = useDemo ? DEMO_POSTS_REPLIES_DATA : [];

  return (
    <AnalyticsChatProvider platform="x" demoMode={useDemo} panelOpen={chatOpen} screenshotsUploadedTrigger={screenshotsUploadedTrigger}>
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <AnimatePresence mode="wait">
        {uploading && (
          <AnalyzingOverlay
            key="analyzing"
            currentIndex={uploadProgress?.current ?? 1}
            totalCount={uploadProgress?.total ?? 1}
          />
        )}
      </AnimatePresence>
      <Navbar />

      <main className="pt-24 pb-16 px-4 sm:px-6 storyteller bg-gradient-to-b from-muted/20 to-transparent min-h-screen">
        <div className="max-w-6xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
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
                    <Twitter className="w-8 h-8 text-[#1DA1F2]" />
                    X (Twitter) Deep Dive
                  </h1>
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      useDemo
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                    }`}
                  >
                    {useDemo ? "Sample data" : "Your data"}
                  </span>
                </div>
              </div>
              <Button
                onClick={() => setUploadOpen(true)}
                className="bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white shadow-sm shrink-0"
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload X Screenshot
              </Button>
            </div>
          </motion.div>

          {/* Top 2 boxes: Left (Anomaly) + Right (Quick Insights) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Left box - Anomaly Alert */}
            {anomalyText && (
              <div className="rounded-xl border-2 border-amber-400 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-5 shadow-sm flex flex-col">
                <div className="flex items-start gap-3 flex-1">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Anomaly Alert</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">{anomalyText}</p>
                    {actionableAdvice && (
                      <div className="mt-4 pt-4 border-t border-amber-200 dark:border-amber-800">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wider mb-1.5">
                          Recommended Action
                        </p>
                        <p className="text-sm text-amber-900 dark:text-amber-100">→ {actionableAdvice}</p>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => document.getElementById("analytics-chart")?.scrollIntoView({ behavior: "smooth" })}
                  className="mt-4 flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Access charts & full analytics
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Right box - Quick Insights */}
            {(useDemo || (snapshot && impressions > 0)) && (anomalyText || impressions > 0) && (
              <Card className="border-violet-200 dark:border-violet-900/50 bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/20 dark:to-transparent shadow-sm flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-violet-600" />
                    Quick Insights
                    {useDemo && (
                      <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(sample)</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {useDemo ? (
                      <>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Impressions:</strong> Down 19% vs prior period—investigate Feb 2–3 spike content to replicate.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Engagement rate:</strong> Strong signal—content resonates. Focus on distribution.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Funnel bottleneck:</strong> Profile visits (0.4% of impressions) are the weak link—strengthen bio and pinned post.
                          </span>
                        </li>
                      </>
                    ) : (
                      <>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Impressions:</strong> {impressions.toLocaleString()} total. {timeSeries.length ? "Review time-series to spot patterns." : "Upload more screenshots for trend analysis."}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Engagement rate:</strong> {engagementRate >= 10 ? "Strong signal—content resonates. Focus on distribution." : "Room to improve—test more conversational hooks and CTAs."}
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <span>
                            <strong>Funnel bottleneck:</strong>{" "}
                            {profileVisits != null && impressions ? (
                              <>Profile visits ({((profileVisits / impressions) * 100).toFixed(2)}% of impressions) are the weak link—strengthen bio and pinned post.</>
                            ) : (
                              "Profile visits convert low—optimize bio, pinned post, and profile completeness."
                            )}
                          </span>
                        </li>
                        {formatInsight && (
                          <li className="flex items-start gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                            <span>{formatInsight}</span>
                          </li>
                        )}
                      </>
                    )}
                  </ul>
                </CardContent>
                <div className="px-6 pb-4 pt-0">
                  <button
                    type="button"
                    onClick={() => document.getElementById("key-metrics")?.scrollIntoView({ behavior: "smooth" })}
                    className="flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200"
                  >
                    Access key metrics & post performance
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Card>
            )}
          </motion.div>

          {/* Analytics Chart - Box 3 */}
          <motion.div
            id="analytics-chart"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
          >
            <Card className="border-violet-200/80 dark:border-violet-800/50 bg-gradient-to-br from-white to-violet-50/30 dark:from-background dark:to-violet-950/10 shadow-sm overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  Analytics
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3 pt-2">
              <select
                value={primaryMetric}
                onChange={(e) => setPrimaryMetric(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                aria-label="Primary metric"
              >
                <option>Impressions</option>
                <option>Engagements</option>
                <option>Profile visits</option>
              </select>
              <select
                value={secondaryMetric}
                onChange={(e) => setSecondaryMetric(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground"
                aria-label="Secondary metric"
              >
                <option>Select secondary metric</option>
              </select>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                aria-label="Time granularity"
              >
                <option>Daily</option>
                <option>Weekly</option>
              </select>
              <Button variant="outline" size="sm" className="gap-1">
                <BarChart3 className="w-4 h-4" />
                Bar
                <ChevronDown className="w-3 h-3" />
              </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {timeSeries.length === 0 && !useDemo ? (
                  <div
                    className="h-[280px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-[#1DA1F2]/30 transition-colors cursor-pointer"
                    onClick={() => setUploadOpen(true)}
                  >
                    <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No impressions data yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Upload X analytics screenshots to see trends</p>
                    <Button variant="outline" size="sm" className="mt-4 border-[#1DA1F2]/50 text-[#1DA1F2] hover:bg-[#1DA1F2]/10">
                      <Camera className="w-3.5 h-3.5 mr-2" />
                      Upload
                    </Button>
                  </div>
                ) : (
                <div className="h-[280px]">
                  <ChartContainer
                    config={{ impressions: { label: "Impressions", color: "#7C3AED" } }}
                    className="h-full w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={[0, "auto"]} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="value" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Impressions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Follows over time + Posts | Replies - Box 4 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
          >
            <Card className="border-slate-200/80 dark:border-slate-700/50 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-950/30 dark:to-background shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Activity Over Time</CardTitle>
                <p className="text-sm text-muted-foreground">Follows and posting activity trends</p>
              </CardHeader>
              <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {useDemo && (
              <>
                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                  <p className="text-sm font-medium flex items-center gap-1 mb-3">
                    Follows over time
                    <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  </p>
                  <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={followsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 1", "dataMax + 1"]} />
                          <Tooltip />
                          <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net follows">
                          {followsData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.net >= 0 ? "#7C3AED" : "#EF4444"} />
                          ))}
                        </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 bg-background/50 p-4">
                    <p className="text-sm font-medium flex items-center gap-1 mb-3">
                      Posts | Replies
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </p>
                    <div className="h-[180px]">
                      <ChartContainer
                        config={{
                          posts: { label: "Posts", color: "#7C3AED" },
                          replies: { label: "Replies", color: "#10B981" },
                        }}
                        className="h-full w-full"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={postsRepliesData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="posts" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Posts" />
                            <Bar dataKey="replies" fill="#10B981" radius={[4, 4, 0, 0]} name="Replies" />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartContainer>
                    </div>
                </div>
              </>
            )}
            {!useDemo && (
              <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 py-10 text-center lg:col-span-2">
                  <p className="text-sm text-muted-foreground">No follows or posts data yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Use the Upload X Screenshot button above to add analytics that include follows over time and posts vs replies.
                  </p>
              </div>
            )}
            </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Key Metrics - Box 5 */}
          <motion.div
            id="key-metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/10 dark:to-background shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-600" />
                  Key Metrics
                </CardTitle>
                <p className="text-sm text-muted-foreground">Snapshot of your X performance</p>
              </CardHeader>
              <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {metricCards.map((card, i) => (
              <div key={i} className="rounded-lg border border-border/70 bg-background/80 dark:bg-background/50 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5 truncate">
                      {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                    </p>
                    {card.change !== undefined && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 ${
                          card.change >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {card.change >= 0 ? "↑" : ""}
                        {card.change < 0 ? card.change : `+${card.change}`}%
                      </span>
                    )}
                  </div>
                  {card.icon && <span className="shrink-0">{card.icon}</span>}
                </div>
              </div>
            ))}
            </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Virality Funnel - Box 6 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-950/10 dark:to-background shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#7C3AED]" />
                  Virality Funnel
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Impressions → Engagements → Profile Clicks · Conversion rates matter
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold text-[#7C3AED]">{impressions.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">—</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-[#F59E0B]">{engagements.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Engagements</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {impressions ? `${((engagements / impressions) * 100).toFixed(1)}% conversion` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{profileVisits.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Profile Visits</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {impressions ? `${((profileVisits / impressions) * 100).toFixed(2)}% of reach` : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div
                    className="h-3 rounded bg-[#7C3AED] flex-1"
                    style={{ minWidth: "40%" }}
                  />
                  <div
                    className="h-3 rounded bg-[#F59E0B]"
                    style={{
                      width: `${engagements && impressions ? Math.max(5, (engagements / impressions) * 100) : 20}%`,
                    }}
                  />
                  <div
                    className="h-3 rounded bg-muted-foreground/40"
                    style={{
                      width: `${profileVisits && impressions ? Math.max(2, (profileVisits / impressions) * 100) : 5}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Post Performance - Box 7 */}
          {!useDemo && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
            >
              <Card className="border-[#1DA1F2]/40 dark:border-[#1DA1F2]/30 bg-gradient-to-br from-[#1DA1F2]/5 to-white dark:from-[#1DA1F2]/10 dark:to-background shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1DA1F2]" />
                    Post Performance
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Compare individual posts over time. Upload post screenshots to build your performance history.
                  </p>
                </CardHeader>
                <CardContent>
                  {posts.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                      <p>No post screenshots yet.</p>
                      <p className="text-xs mt-1">Upload a screenshot of a single X post (with views, likes, reposts) to start tracking.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        {posts.slice(0, 6).map((p, idx) => {
                          const post = (p.extracted_data?.post || {}) as PostData;
                          const prev = idx < posts.length - 1 ? (posts[idx + 1]?.extracted_data?.post || {}) as PostData : null;
                          const views = post.views ?? 0;
                          const likes = post.likes ?? 0;
                          const reposts = post.reposts ?? 0;
                          const replies = post.replies ?? 0;
                          const engagement = views ? ((likes + reposts + replies) / views) * 100 : 0;
                          const prevViews = prev?.views ?? 0;
                          const prevEngagement = prevViews ? (((prev?.likes ?? 0) + (prev?.reposts ?? 0) + (prev?.replies ?? 0)) / prevViews) * 100 : 0;
                          const viewsDelta = prevViews ? ((views - prevViews) / prevViews) * 100 : null;
                          const engagementDelta = prevEngagement ? engagement - prevEngagement : null;

                          return (
                            <div
                              key={p.id}
                              className="rounded-xl border border-border bg-card p-4 space-y-3 min-w-0 flex flex-col"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {post.post_date || new Date(p.created_at).toLocaleDateString()} · {post.format || "Post"}
                                </span>
                                {idx === 0 && (
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">Latest</span>
                                )}
                              </div>
                              {post.content_preview && (
                                <p className="text-sm text-muted-foreground line-clamp-2 flex-shrink-0">{post.content_preview}</p>
                              )}
                              <div className="grid grid-cols-2 gap-x-3 gap-y-2 flex-1 min-w-0">
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Views</p>
                                  <p className="font-semibold tabular-nums truncate">{views.toLocaleString()}</p>
                                  {viewsDelta != null && (
                                    <span className={`text-xs ${viewsDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                      {viewsDelta >= 0 ? <ArrowUpRight className="inline w-3 h-3" /> : <ArrowDownRight className="inline w-3 h-3" />}
                                      {viewsDelta >= 0 ? "+" : ""}{viewsDelta.toFixed(0)}% vs prev
                                    </span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Likes</p>
                                  <p className="font-semibold tabular-nums">{likes}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Reposts</p>
                                  <p className="font-semibold tabular-nums">{reposts}</p>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs text-muted-foreground">Eng. rate</p>
                                  <p className="font-semibold tabular-nums">{engagement.toFixed(2)}%</p>
                                  {engagementDelta != null && prevEngagement > 0 && (
                                    <span className={`text-xs ${engagementDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                      {engagementDelta >= 0 ? "+" : ""}{engagementDelta.toFixed(2)}pp
                                    </span>
                                  )}
                                </div>
                              </div>
                              {idx === 0 && prev && (p.ai_insights?.actionable_advice || (p.extracted_data as { strategic_analysis?: { actionable_advice?: string } })?.strategic_analysis?.actionable_advice) && (
                                <div className="pt-3 border-t border-border flex-shrink-0">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Insight</p>
                                  <p className="text-sm line-clamp-2">
                                    {(p.ai_insights?.actionable_advice || (p.extracted_data as { strategic_analysis?: { actionable_advice?: string } })?.strategic_analysis?.actionable_advice)}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground pt-1">
                        Keep uploading post screenshots to build a long-term performance history and compare trends.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload X (Twitter) Screenshot</DialogTitle>
            <DialogDescription>
              Upload analytics dashboards (for trends & KPIs) or single posts (for post-level comparison). Our AI detects the type and extracts the right metrics. Build your history to compare posts over time.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="x-screenshot-upload"
            className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Camera className="w-10 h-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">
              Click or drag X analytics screenshots
            </span>
            <span className="text-xs text-muted-foreground/70 mt-1">JPEG, PNG, WebP · Max 10MB each</span>
            <input
              id="x-screenshot-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <p className="text-sm text-[#1DA1F2]">
              {uploadProgress
                ? `Analyzing screenshot ${uploadProgress.current} of ${uploadProgress.total}...`
                : "Analyzing..."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Floating bot with speech bubble (comment) above it */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-0">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative mb-2 max-w-[280px] sm:max-w-[320px] rounded-2xl rounded-br-md border border-[#1DA1F2]/30 bg-white dark:bg-gray-900 shadow-lg px-4 py-3"
        >
          <p className="text-[15px] leading-relaxed text-foreground">
            {PAGE_GREETING_TEXT.slice(0, pageGreetingLength)}
            {pageGreetingLength < PAGE_GREETING_TEXT.length && (
              <span className="inline-block w-0.5 h-4 ml-0.5 align-middle bg-[#1DA1F2] animate-pulse" aria-hidden />
            )}
          </p>
          {/* Bubble tail pointing down to the bot */}
          <div className="absolute -bottom-2 right-7 w-4 h-4 rotate-45 border-r border-b border-[#1DA1F2]/30 bg-white dark:bg-gray-900 rounded-br-sm" />
        </motion.div>
        <Button
          aria-label="Open Twitter Analytics AI"
          onClick={() => setChatOpen(true)}
          className="h-14 w-14 rounded-full bg-[#1DA1F2] shadow-lg hover:bg-[#1a8cd8] flex items-center justify-center"
        >
          <Bot className="h-7 w-7 text-white" strokeWidth={2} />
        </Button>
      </div>
      <AnalyticsChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </div>
    </AnalyticsChatProvider>
  );
}
