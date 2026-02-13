"use client";

import { useState, useCallback, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { authService } from "@/lib/auth";
import {
  Camera,
  TrendingUp,
  Target,
  Lightbulb,
  Link2,
  Bookmark,
  Share2,
  Zap,
  AlertTriangle,
  HelpCircle,
  ArrowUpRight,
  ArrowDownRight,
  Telescope,
  ExternalLink,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
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
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useDemoMode } from "@/lib/contexts/DemoModeContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PLATFORM_WATCH } from "@/lib/storyteller/platformWatch";
import { DemoRestrictionDialog } from "@/components/DemoRestrictionDialog";

const SEMANTIC_BAR_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-storyteller-secondary",
  "bg-red-400",
];

const MOCK_IMPRESSIONS_DATA = [
  { period: "Week 1", impressions: 985 },
  { period: "Week 2", impressions: 912 },
  { period: "Week 3", impressions: 847 },
  { period: "Week 4", impressions: 798 },
];

const MOCK_COMPETITOR_GAPS = [
  "Keyword gap: Automation vs. Sustainability",
  "Posting frequency: 3x vs. 1x weekly",
  "Content format: Video underperforming",
];

const MOCK_SEMANTIC_INTENT = [
  { label: "General Praise", percent: 40 },
  { label: "Viral Tags", percent: 35 },
  { label: "Pricing", percent: 15 },
  { label: "Product Confusion", percent: 10 },
];

interface StrategicAnalysis {
  mood?: string;
  anomaly_detected?: string;
  actionable_advice?: string;
  resonance_label?: string;
}

interface Metrics {
  impressions?: number | null;
  engagement_rate?: number | null;
  followers?: number | null;
  top_post_topic?: string | null;
  profile_visits?: number | null;
  engagements?: number | null;
  saves?: number | null;
  shares?: number | null;
  replies?: number | null;
  likes?: number | null;
  reposts?: number | null;
  bookmarks?: number | null;
}

interface TimeSeriesPoint {
  period: string;
  value: number;
}

interface SemanticIntentItem {
  label: string;
  percent: number;
}

interface ExtractedData {
  platform?: string | null;
  metrics?: Metrics;
  time_series?: TimeSeriesPoint[] | null;
  format_performance?: {
    format?: string | null;
    insight?: string | null;
  } | null;
  semantic_intent?: SemanticIntentItem[] | null;
  strategic_analysis?: StrategicAnalysis;
}

interface Snapshot {
  id: string;
  platform: string;
  image_url: string;
  extracted_data?: ExtractedData | null;
  ai_insights?: StrategicAnalysis | null;
  created_at: string;
}

const MOCK_STRATEGIC_ANALYSIS: StrategicAnalysis = {
  mood: "neutral",
  anomaly_detected: "High engagement but low reach",
  actionable_advice: "High Resonance, Low Distribution.",
};

export default function StoryTellerDashboard() {
  const router = useRouter();
  const { demoMode } = useDemoMode();
  const { activeOrganization, isDemoMode } = useOrganization();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [showDemoRestriction, setShowDemoRestriction] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [strategicAnalysis, setStrategicAnalysis] = useState<StrategicAnalysis | null>(null);

  const [latestSnapshot, setLatestSnapshot] = useState<Snapshot | null>(null);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // Load recent analytics snapshots for the dashboard
  useEffect(() => {
    if (!activeOrganization?.id) return;
    
    const fetchSnapshots = async () => {
      try {
        setLoadingSnapshots(true);
        const token = await authService.getSessionToken();
        const res = await fetch(`/api/analytics-snapshots?limit=5&organizationId=${activeOrganization.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as Snapshot[];
        if (data && data.length > 0) {
          const latest = data[0];
          setLatestSnapshot(latest);
          const insights =
            latest.ai_insights ||
            (latest.extracted_data && latest.extracted_data.strategic_analysis);
          if (insights) {
            setStrategicAnalysis(insights);
          }
        }
      } catch {
        // fail silently and keep mock data
      } finally {
        setLoadingSnapshots(false);
      }
    };

    fetchSnapshots();
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    const valid = files.filter(
      (f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024
    );
    if (valid.length === 0) {
      toast.error("No valid images. Use JPEG, PNG, or WebP (max 10MB each).");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let lastSnapshot: Snapshot | null = null;

    try {
      for (let i = 0; i < valid.length; i++) {
        setUploadProgress({ current: i + 1, total: valid.length });
        if (!activeOrganization?.id) {
          toast.error("No active organization selected");
          continue;
        }

        const formData = new FormData();
        formData.append("file", valid[i]);
        formData.append("platform", "x");
        formData.append("organizationId", activeOrganization.id);

        const res = await fetch("/api/analyze-screenshot", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const { snapshot } = await res.json();
          lastSnapshot = snapshot as Snapshot;
          successCount++;
          if (lastSnapshot?.extracted_data?.strategic_analysis) {
            setStrategicAnalysis(lastSnapshot.extracted_data.strategic_analysis);
          }
          setLatestSnapshot(lastSnapshot);
        } else {
          const err = (await res.json()) as { error?: string; details?: string; fix?: string };
          const desc = err.details ? `${err.details}${err.fix ? `\n\n${err.fix}` : ''}` : err.fix;
          toast.error(`${valid[i].name}: ${err.error || "Failed"}`, {
            description: desc,
            duration: desc ? 15000 : 5000,
          });
        }
      }

      setUploadProgress(null);
      if (successCount > 0) {
        toast.success(
          successCount === valid.length
            ? `${successCount} screenshot${successCount > 1 ? "s" : ""} analyzed successfully`
            : `${successCount} of ${valid.length} screenshots analyzed`
        );
        setUploadOpen(false);
      }
    } catch (err) {
      setUploadProgress(null);
      toast.error(err instanceof Error ? err.message : "Failed to analyze screenshots");
    } finally {
      setUploading(false);
    }
  }, [activeOrganization?.id]);

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const extracted = (latestSnapshot?.extracted_data || {}) as ExtractedData;
  const metrics: Metrics = extracted.metrics || {};

  const useDemoData = demoMode || isDemoMode;
  const hasRealData = !useDemoData && latestSnapshot?.extracted_data;

  const impressions = useDemoData
    ? 798
    : hasRealData
      ? (metrics.impressions ?? 0)
      : 0;
  const engagementRate = useDemoData
    ? 19.2
    : hasRealData
      ? (metrics.engagement_rate ?? 0)
      : 0;
  const followers = useDemoData ? null : (hasRealData ? metrics.followers ?? null : null);
  const profileVisits = useDemoData ? 3 : (hasRealData ? (metrics.profile_visits ?? 0) : 0);
  const saves = useDemoData ? 1400 : (hasRealData ? (metrics.saves ?? 0) : 0);
  const shares = useDemoData ? 892 : (hasRealData ? (metrics.shares ?? 0) : 0);

  const timeSeries = useDemoData
    ? MOCK_IMPRESSIONS_DATA
    : extracted.time_series && extracted.time_series.length > 0
      ? extracted.time_series.map((p) => ({ period: p.period, impressions: p.value }))
      : [];

  const semanticIntent = useDemoData
    ? MOCK_SEMANTIC_INTENT
    : extracted.semantic_intent && extracted.semantic_intent.length > 0
      ? extracted.semantic_intent
      : [];

  const displayStrategicAnalysis = useDemoData
    ? MOCK_STRATEGIC_ANALYSIS
    : strategicAnalysis;

  const resonanceLabel =
    displayStrategicAnalysis?.resonance_label ||
    (engagementRate >= 20 ? "Excellent" : engagementRate >= 10 ? "Strong" : "Weak");

  const now = new Date();
  const hours = now.getHours();
  const greeting =
    hours < 12 ? "Good morning" : hours < 18 ? "Good afternoon" : "Good evening";

  const weekTrend = useDemoData ? -19 : null;
  const weekTrendPositive = weekTrend !== null && weekTrend > 0;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-white">
        <Navbar />

        <main className="pt-24 pb-12 px-6 storyteller">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6"
            >
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {greeting},{" "}
                  <span className="text-storyteller-primary">StoryTeller</span>
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Command Center
                  {" · "}
                  Strategy Mode:{" "}
                  <span className="font-semibold text-storyteller-primary">
                    Professional but Witty
                  </span>{" "}
                  <span className="text-gray-400">(Brand DNA Active)</span>
                </p>
              </div>
              <Button
                onClick={() => (useDemoData ? setShowDemoRestriction(true) : setUploadOpen(true))}
                className="bg-storyteller-primary hover:bg-storyteller-primary/90 text-white shadow-sm"
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload Weekly Batch
              </Button>
            </motion.div>

            {/* Global Pulse - Hero metrics */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="mb-8 rounded-xl bg-gray-50/80 border border-gray-200 px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="font-semibold tracking-widest text-gray-500 text-[11px] uppercase">
                    Global Pulse
                  </span>
                  {weekTrend !== null && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        weekTrendPositive ? "bg-emerald-100 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {weekTrendPositive ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      This week: {weekTrend > 0 ? "+" : ""}
                      {weekTrend}% vs last 4 weeks
                    </span>
                  )}
                  {!useDemoData && !hasRealData && (
                    <span className="text-xs text-gray-500">Upload a screenshot to see trends</span>
                  )}
                  <span className="text-[11px] text-gray-400">
                    Last updated: {latestSnapshot?.created_at
                      ? new Date(latestSnapshot.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-storyteller-primary" />
                    <span className="tabular-nums font-medium text-gray-800">
                      {typeof saves === "number" ? saves.toLocaleString() : "—"}
                    </span>
                    <span className="text-gray-500">Saves</span>
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>People bookmarking your content—strong signal of value.</TooltipContent>
                    </UiTooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-storyteller-primary" />
                    <span className="tabular-nums font-medium text-gray-800">
                      {typeof shares === "number" ? shares.toLocaleString() : "—"}
                    </span>
                    <span className="text-gray-500">Shares</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="tabular-nums font-medium text-gray-800">
                      {useDemoData ? "12" : "—"}
                    </span>
                    <span className="text-gray-500">mins Lead Velocity</span>
                    <UiTooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>Average time to first response on inbound leads.</TooltipContent>
                    </UiTooltip>
                  </div>
                  {followers != null && (
                    <span className="text-gray-500 hidden md:inline">
                      <span className="tabular-nums font-medium text-gray-800">{followers}</span> followers
                    </span>
                  )}
                </div>
              </div>
            </motion.div>

            {/* This Week's Diagnosis - Strategist's Note */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mb-10 rounded-xl border-2 border-storyteller-secondary bg-[#FFF7ED] p-6"
            >
              <h2 className="text-sm font-semibold tracking-widest text-storyteller-secondary uppercase mb-2 flex items-center gap-2">
                <Lightbulb className="w-4 h-4" />
                This Week&apos;s Diagnosis
              </h2>
              {displayStrategicAnalysis ? (
                <>
                  <button
                    type="button"
                    onClick={() => router.push("/storyteller/x")}
                    className="inline-flex items-center gap-1 rounded-md bg-storyteller-secondary/10 px-2 py-0.5 text-xs font-semibold text-storyteller-secondary mb-3 hover:bg-storyteller-secondary/20 transition-colors"
                  >
                    Pattern: {displayStrategicAnalysis.anomaly_detected?.split(".")[0] || "High Resonance, Low Distribution"}
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <p className="text-gray-800 mb-2">
                    {displayStrategicAnalysis.anomaly_detected ||
                      "Divergent performance—your X strategy is efficient (19%), but LinkedIn reach is dropping."}
                  </p>
                  <p className="text-sm font-medium text-gray-700">
                    → {displayStrategicAnalysis.actionable_advice ||
                      "Double down on how-to carousels; A/B test distribution on X vs LinkedIn this week."}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {["x", "linkedin"].map((p) => (
                      <Button
                        key={p}
                        variant="outline"
                        size="sm"
                        className="text-xs border-storyteller-secondary/50 text-storyteller-secondary hover:bg-storyteller-secondary/10"
                        onClick={() => router.push(`/storyteller/${p}`)}
                      >
                        Deep dive {p === "x" ? "X" : "LinkedIn"}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-600">
                  Upload a screenshot to see your strategy diagnosis and actionable advice.
                </p>
              )}
            </motion.div>

          {/* Platform Quick Links */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex gap-3 mb-6"
          >
            {["x", "linkedin", "instagram", "facebook"].map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="capitalize border-storyteller-primary/50 text-storyteller-primary hover:bg-storyteller-primary/10"
                onClick={() => router.push(`/storyteller/${p}`)}
              >
                {p === "x" ? "X (Twitter)" : p.charAt(0).toUpperCase() + p.slice(1)}
              </Button>
            ))}
          </motion.div>

          {/* Platform Watch - CMO Intelligence */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mb-8"
          >
            <Card className="border-storyteller-primary/20 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Telescope className="w-4 h-4 text-storyteller-primary" />
                  Platform Watch
                </CardTitle>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mt-0.5">
                  LinkedIn, Instagram, X &amp; Facebook — algorithm shifts &amp; upcoming features
                </p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="linkedin" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 bg-gray-100/80">
                    {PLATFORM_WATCH.map((p) => (
                      <TabsTrigger
                        key={p.platform}
                        value={p.platform}
                        className="text-xs data-[state=active]:bg-white data-[state=active]:text-storyteller-primary"
                      >
                        {p.platformLabel}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {PLATFORM_WATCH.map((item) => (
                    <TabsContent key={item.platform} value={item.platform} className="mt-4 space-y-3">
                      {item.algorithmDirection && (
                        <p className="text-xs text-gray-600 italic border-l-2 border-storyteller-primary/40 pl-3">
                          {item.algorithmDirection}
                        </p>
                      )}
                      <ul className="space-y-2">
                        {item.updates.map((u, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span
                              className={`shrink-0 mt-0.5 w-2 h-2 rounded-full ${
                                u.impact === "high"
                                  ? "bg-amber-500"
                                  : u.impact === "medium"
                                  ? "bg-storyteller-primary/60"
                                  : "bg-gray-300"
                              }`}
                            />
                            <div>
                              <span className="font-medium text-gray-800">{u.headline}.</span>{" "}
                              <span className="text-gray-600">{u.description}</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-storyteller-primary/50 text-storyteller-primary hover:bg-storyteller-primary/10"
                        onClick={() => router.push(`/storyteller/${item.platform}`)}
                      >
                        Deep dive {item.platformLabel}
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </Button>
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Four-engine Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6"
          >
            {/* Momentum - The Growth Engine */}
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-storyteller-primary" />
                      Momentum
                    </CardTitle>
                    <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                      The Growth Engine
                    </p>
                  </div>
                  {useDemoData && (
                    <span className="tabular-nums text-xs font-medium text-emerald-600">
                      +12% vs prior 7 days
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {timeSeries.length > 0 ? (
                  <ChartContainer
                    config={{
                      impressions: { label: "Impressions", color: "#7C3AED" },
                    }}
                    className="h-[200px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="period" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <Tooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="impressions"
                          stroke="#7C3AED"
                          strokeWidth={2}
                          dot={{ fill: "#7C3AED" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
                    Upload a screenshot to see impressions over time
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resonance - The Loyalty Engine */}
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-storyteller-primary" />
                  Resonance
                </CardTitle>
                <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                  The Loyalty Engine
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-[200px] gap-3">
                  <p className="text-sm font-medium text-storyteller-primary">{resonanceLabel}</p>
                  <p className="text-4xl font-bold tabular-nums text-storyteller-primary">
                    {engagementRate.toFixed(1)}%
                  </p>
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <p className="text-xs text-gray-400 cursor-help">Engagement Rate</p>
                    </TooltipTrigger>
                    <TooltipContent>How much people care when they see you—likes, saves, shares, replies.</TooltipContent>
                  </UiTooltip>
                  <div className="w-full max-w-[140px]">
                    <Progress value={Math.min(engagementRate, 100)} className="h-2 [&>div]:bg-storyteller-primary" />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    0–10% Low · 10–20% Strong · 20%+ Excellent
                  </p>
                  {useDemoData && (
                    <p className="text-xs text-gray-500 text-center max-w-[200px]">
                      Top driver: &quot;Sustainability&quot; posts; weakest: &quot;Announcements&quot;.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Efficiency - The Time Engine */}
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-storyteller-primary" />
                  Efficiency
                </CardTitle>
                <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                  The Time Engine
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-1 text-[10px] text-gray-500 mb-2">
                  <span />
                  <span className="text-center">9AM</span>
                  <span className="text-center">12PM</span>
                  <span className="text-center">2PM</span>
                  <span className="text-center">6PM</span>
                </div>
                <div className="grid grid-cols-5 gap-1 text-[10px] items-center">
                  {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, rowIdx) => (
                    <Fragment key={day}>
                      <span className="text-gray-500">{day}</span>
                      {[0, 1, 2, 3].map((colIdx) => {
                        const isHotSpot = day === "Tue" && colIdx === 2; // 2PM Tuesday
                        return (
                          <div
                            key={`${day}-${colIdx}`}
                            className={`h-6 rounded-sm ${
                              isHotSpot
                                ? "bg-storyteller-primary/80"
                                : rowIdx === 1 || rowIdx === 3
                                ? "bg-storyteller-primary/20"
                                : "bg-gray-100"
                            }`}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-600">
                  Your{" "}
                  <span className="font-semibold text-storyteller-primary">2 PM Tuesday</span>{" "}
                  posts get{" "}
                  <span className="font-semibold text-storyteller-primary">3x more clicks</span>.
                  We&apos;ll automatically nudge drafts into this peak window.
                </p>
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50/80 rounded px-2 py-1">
                  Worst slot: Fri 9 AM (−43% vs avg). Avoid scheduling here.
                </p>
              </CardContent>
            </Card>

            {/* Opportunity - The Strategy Engine */}
            <Card className="border-gray-200 bg-white shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-storyteller-primary" />
                  Opportunity
                </CardTitle>
                <p className="text-[11px] text-gray-400 uppercase tracking-widest mt-0.5">
                  The Strategy Engine
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-semibold text-gray-800 mb-3">
                  Trending format detected
                </p>
                <p className="text-sm text-gray-700 mb-4">
                  {useDemoData
                    ? "How-to carousels are up 47% this week. Your sustainability posts are driving above-average saves."
                    : extracted.format_performance?.insight || "Upload a screenshot to see format performance insights."}
                </p>
                {useDemoData && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Format: Carousels +47% vs static
                    </span>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      Keyword: Automation vs. Sustainability
                    </span>
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      Cadence: 3x vs 1x weekly
                    </span>
                  </div>
                )}
                <ul className="space-y-2 text-sm text-gray-600">
                  {(useDemoData ? MOCK_COMPETITOR_GAPS : []).map((gap, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-storyteller-secondary mt-0.5">•</span>
                      {gap}
                    </li>
                  ))}
                  {!useDemoData && (
                    <li className="text-gray-500">Upload screenshots to analyze competitor gaps.</li>
                  )}
                </ul>
                <Button
                  size="sm"
                  className="mt-4 w-full border-storyteller-primary text-white bg-storyteller-primary hover:bg-storyteller-primary/90 shadow-sm"
                  onClick={() => router.push("/storyteller/gaps")}
                >
                  Launch Counter-Move
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Semantic Intent + Lead Velocity */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8"
          >
            <Card className="border-gray-200 bg-white shadow-sm lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                  Semantic Intent Mapping
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>What your audience feels when they engage—praise, curiosity, confusion, etc.</TooltipContent>
                  </UiTooltip>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {semanticIntent.length > 0 ? (
                  <>
                    <style
                      dangerouslySetInnerHTML={{
                        __html: semanticIntent
                          .map(
                            (_, i) =>
                              `.semantic-intent-fill-${i}{width:${Math.min(semanticIntent[i].percent, 100)}%;}`,
                          )
                          .join(""),
                      }}
                    />
                    <div className="space-y-3">
                      {semanticIntent.map((item, index) => (
                        <div key={item.label}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{item.label}</span>
                            <span className="tabular-nums font-medium">{item.percent}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-2.5 rounded-full transition-all ${SEMANTIC_BAR_COLORS[index % SEMANTIC_BAR_COLORS.length]} semantic-intent-fill-${index}`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 py-4">
                    Upload a screenshot to see semantic intent mapping.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 bg-amber-50/30 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-gray-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Lead Velocity Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                {useDemoData ? (
                  <>
                    <div className="flex items-start gap-3 mb-3">
                      <p className="text-sm text-gray-800">
                        <span className="font-semibold tabular-nums text-amber-700">3 leads</span>{" "}
                        lost this week due to{" "}
                        <span className="font-semibold">&gt; 4hr response time</span> on inbound DMs.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full bg-amber-500 hover:bg-amber-600 text-white border-0"
                    >
                      <Zap className="w-3.5 h-3.5 mr-2" />
                      Activate AI-AutoReply
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Upload data to track lead velocity and response times.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Next Move Content Pack - Demo only */}
          {useDemoData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-12"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-4 h-4 text-storyteller-primary" />
                Next Move Content Pack
              </h2>
              <button
                type="button"
                className="text-sm text-storyteller-primary hover:underline font-medium"
              >
                View all in Content Lab →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  platform: "LinkedIn",
                  badge: 9,
                  badgeColor: "bg-emerald-100 text-emerald-700",
                  title: "5 Eco-Packaging Myths Debunked – Carousel Edition",
                  description: "Based on your top-performing sustainability format.",
                },
                {
                  platform: "X",
                  badge: 8,
                  badgeColor: "bg-blue-100 text-blue-700",
                  title: "Thread: The Real Cost of Sustainable Choices",
                  description: "Trending topic in your audience's replies.",
                },
                {
                  platform: "Meta",
                  badge: 7,
                  badgeColor: "bg-amber-100 text-amber-700",
                  title: "Behind the Scenes: Our Zero-Waste Factory Tour",
                  description: "Authenticity content performs well on Meta.",
                },
              ].map((item) => (
                <Card key={item.platform} className="border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="pt-5 pb-5 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-3 text-xs">
                      <span className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                        {item.platform}
                      </span>
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mb-2 leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-600 flex-1">{item.description}</p>
                    <Button className="mt-4 w-full bg-storyteller-primary hover:bg-storyteller-primary/90 text-white text-sm shadow-sm">
                      Schedule Now
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
          )}
        </div>
      </main>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Analytics Screenshot</DialogTitle>
            <DialogDescription>
              Upload one or more screenshots of your X, LinkedIn, or Instagram analytics. Our AI will
              extract metrics and generate strategic insights for each.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <label
              htmlFor="screenshot-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Camera className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">
                Click to select or drag screenshots
              </span>
              <span className="text-xs text-gray-400 mt-1">JPEG, PNG, or WebP · Max 10MB each</span>
              <input
                id="screenshot-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <p className="text-sm text-storyteller-secondary">
                {uploadProgress
                  ? `Analyzing screenshot ${uploadProgress.current} of ${uploadProgress.total}...`
                  : "Analyzing screenshot..."}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <DemoRestrictionDialog
        open={showDemoRestriction}
        onOpenChange={setShowDemoRestriction}
        title="Request access to upload analytics"
        description="You're in demo mode. To upload screenshots and get AI-powered insights, request access. Share your details and we'll get you set up."
      />
    </div>
    </TooltipProvider>
  );
}
