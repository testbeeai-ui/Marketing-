"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
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
  Facebook,
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

const FB_BLUE = "#1877F2";

const DEMO_REACH_DATA = [
  { period: "Jan 28", value: 4200 },
  { period: "Jan 31", value: 3800 },
  { period: "Feb 3", value: 5100 },
  { period: "Feb 6", value: 4600 },
  { period: "Feb 9", value: 3900 },
];

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
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
  } | null;
  ai_insights?: {
    anomaly_detected?: string;
    actionable_advice?: string;
  } | null;
  created_at: string;
}

export function FacebookDeepDiveContent() {
  const router = useRouter();
  const { demoMode } = useDemoMode();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [screenshotsUploadedTrigger, setScreenshotsUploadedTrigger] = useState(0);

  const useDemo = demoMode;
  const platformWatch = getPlatformWatchByPlatform("facebook");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics-snapshots?limit=20&platform=facebook&type=dashboard");
      if (res.ok) {
        const data = (await res.json()) as Snapshot[];
        if (data?.length > 0) {
          const fbSnapshot = data.find((s) => s.platform.toLowerCase() === "facebook") || data[0];
          setSnapshot(fbSnapshot);
        }
      }
    } catch {
      // ignore
    }
  }, []);

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
          const formData = new FormData();
          formData.append("file", valid[i]);
          formData.append("platform", "facebook");
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

  const reach = useDemo ? 21600 : (metrics.reach ?? metrics.impressions ?? 0);
  const engagements = useDemo ? 892 : (metrics.engagements ?? 0);
  const rawEngagement = useDemo ? 4.1 : (metrics.engagement_rate ?? 0);
  const engagementRate = rawEngagement > 0 && rawEngagement < 1 ? rawEngagement * 100 : rawEngagement;
  const pageLikes = useDemo ? 12450 : (metrics.followers ?? metrics.page_likes ?? 0);
  const pageViews = useDemo ? 2340 : (metrics.profile_visits ?? 0);
  const postClicks = useDemo ? 456 : (metrics.post_clicks ?? 0);
  const reactions = useDemo ? 312 : (metrics.likes ?? metrics.reactions ?? 0);
  const comments = useDemo ? 89 : (metrics.replies ?? metrics.comments ?? 0);
  const shares = useDemo ? 42 : (metrics.shares ?? 0);

  const anomalyText = useDemo
    ? "Reels reach up 28% vs feed posts. Group activity and meaningful comments boost distribution—community signals matter."
    : snapshot?.ai_insights?.anomaly_detected || extracted.strategic_analysis?.anomaly_detected || null;

  const actionableAdvice = useDemo
    ? "Prioritize Reels for reach. Use Groups and authentic content. Meta Business Suite centralizes cross-platform analytics."
    : snapshot?.ai_insights?.actionable_advice || extracted.strategic_analysis?.actionable_advice || null;

  const formatInsight = extracted.format_performance?.insight || null;

  const metricCards: MetricCard[] = useDemo
    ? [
        { label: "Reach", value: reach.toLocaleString(), change: 12 },
        { label: "Engagement", value: engagements, change: -5 },
        { label: "Engagement rate", value: `${engagementRate}%`, change: 0.3 },
        { label: "Page likes", value: pageLikes.toLocaleString(), change: 1.2 },
        { label: "Page views", value: pageViews, change: 8 },
        { label: "Post clicks", value: postClicks, change: -12 },
        { label: "Reactions", value: reactions, change: -8 },
        { label: "Comments", value: comments, change: 15 },
        { label: "Shares", value: shares, change: -3 },
      ]
    : [
        { label: "Reach", value: reach },
        { label: "Engagement", value: engagements },
        { label: "Engagement rate", value: `${engagementRate}%` },
        { label: "Page likes", value: pageLikes },
        { label: "Page views", value: pageViews },
        { label: "Post clicks", value: postClicks },
        { label: "Reactions", value: reactions },
        { label: "Comments", value: comments },
        { label: "Shares", value: shares },
      ];

  return (
    <AnalyticsChatProvider platform="facebook" demoMode={useDemo} panelOpen={chatOpen} screenshotsUploadedTrigger={screenshotsUploadedTrigger}>
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
                    <Facebook className="w-8 h-8" style={{ color: FB_BLUE }} />
                    Facebook Deep Dive
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
                onClick={() => setUploadOpen(true)}
                className="text-white shadow-sm shrink-0"
                style={{ backgroundColor: FB_BLUE }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload Facebook Screenshot
              </Button>
            </div>
          </motion.div>

          {/* Platform Watch */}
          {platformWatch && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.02 }}>
              <Card className="border-blue-200/60 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Algorithm Direction</CardTitle>
                  <p className="text-sm text-muted-foreground italic">{platformWatch.algorithmDirection}</p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-sm">
                    {platformWatch.updates.slice(0, 3).map((u, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className={`shrink-0 mt-1 w-2 h-2 rounded-full ${u.impact === "high" ? "bg-amber-500" : "bg-blue-500/60"}`} />
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
              <Card className="border-blue-200/60 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/20 dark:to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" style={{ color: FB_BLUE }} />
                    Quick Insights
                    {useDemo && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(sample)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FB_BLUE }} />
                      <span><strong>Reels:</strong> Short-form video gets significant boost—prioritize Reels for reach.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FB_BLUE }} />
                      <span><strong>Groups & community:</strong> Activity in Groups and meaningful comments improve post distribution.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FB_BLUE }} />
                      <span><strong>Meta Business Suite:</strong> Use for cross-platform analytics across Facebook and Instagram.</span>
                    </li>
                    {formatInsight && (
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: FB_BLUE }} />
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
            <Card className="border-blue-200/80 dark:border-blue-800/50 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/10 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: FB_BLUE }} />
                  Reach Over Time
                </CardTitle>
                <p className="text-sm text-muted-foreground">Page reach and post visibility</p>
              </CardHeader>
              <CardContent className="pt-0">
                {timeSeries.length === 0 && !useDemo ? (
                  <div
                    className="h-[280px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-blue-500/30 transition-colors cursor-pointer"
                    onClick={() => setUploadOpen(true)}
                  >
                    <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No reach data yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Upload Facebook Page Insights screenshots to see trends</p>
                    <Button variant="outline" size="sm" className="mt-4" style={{ borderColor: `${FB_BLUE}80`, color: FB_BLUE }}>
                      <Camera className="w-3.5 h-3.5 mr-2" /> Upload
                    </Button>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ChartContainer config={{ reach: { label: "Reach", color: FB_BLUE } }} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={[0, "auto"]} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill={FB_BLUE} radius={[4, 4, 0, 0]} name="Reach" />
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
                <p className="text-sm text-muted-foreground">Snapshot of your Facebook Page performance</p>
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

          {/* Page Funnel */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-950/10 dark:to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: FB_BLUE }} />
                  Page Funnel
                </CardTitle>
                <p className="text-sm text-muted-foreground">Reach → Engagement → Page Views</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: FB_BLUE }}>{reach.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Reach</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{engagements.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Engagement</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {reach ? `${((engagements / reach) * 100).toFixed(2)}% conversion` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{pageViews.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Page Views</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {reach ? `${((pageViews / reach) * 100).toFixed(2)}% of reach` : "—"}
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
            <DialogTitle>Upload Facebook Screenshot</DialogTitle>
            <DialogDescription>
              Upload Page Insights or Meta Business Suite screenshots. Our AI extracts reach, engagement, page likes, and post performance.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="facebook-screenshot-upload"
            className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Camera className="w-10 h-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click or drag Facebook Page Insights screenshots</span>
            <span className="text-xs text-muted-foreground/70 mt-1">JPEG, PNG, WebP · Max 10MB each</span>
            <input
              id="facebook-screenshot-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <p className="text-sm" style={{ color: FB_BLUE }}>
              {uploadProgress ? `Analyzing ${uploadProgress.current} of ${uploadProgress.total}...` : "Analyzing..."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Button
        aria-label="Open Facebook Analytics Assistant"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        style={{ backgroundColor: FB_BLUE }}
      >
        <Bot className="h-7 w-7 text-white" strokeWidth={2} />
      </Button>
      <AnalyticsChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </div>
    </AnalyticsChatProvider>
  );
}
