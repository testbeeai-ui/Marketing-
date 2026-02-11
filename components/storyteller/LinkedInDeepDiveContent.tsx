"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Info,
  Camera,
  Lightbulb,
  Bot,
  TrendingUp,
  Target,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  LayoutGrid,
  ChevronRight,
  Linkedin,
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
  Cell,
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

const LINKEDIN_BLUE = "#0A66C2";

const DEMO_IMPRESSIONS_DATA = [
  { period: "Jan 28", value: 320 },
  { period: "Jan 31", value: 410 },
  { period: "Feb 3", value: 285 },
  { period: "Feb 6", value: 520 },
  { period: "Feb 9", value: 380 },
];

const DEMO_FOLLOWERS_DATA = [
  { period: "Jan 28", net: 12 },
  { period: "Jan 31", net: 8 },
  { period: "Feb 3", net: 15 },
  { period: "Feb 6", net: -2 },
  { period: "Feb 9", net: 18 },
];

interface MetricCard {
  label: string;
  value: string | number;
  change?: number;
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

export function LinkedInDeepDiveContent() {
  const router = useRouter();
  const { demoMode } = useDemoMode();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [posts, setPosts] = useState<Snapshot[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [screenshotsUploadedTrigger, setScreenshotsUploadedTrigger] = useState(0);

  const useDemo = demoMode;
  const platformWatch = getPlatformWatchByPlatform("linkedin");

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, postsRes] = await Promise.all([
        fetch("/api/analytics-snapshots?limit=20&platform=linkedin&type=dashboard"),
        fetch("/api/analytics-snapshots?limit=20&platform=linkedin&type=post"),
      ]);
      if (dashRes.ok) {
        const data = (await dashRes.json()) as Snapshot[];
        if (data?.length > 0) {
          const liSnapshot = data.find((s) => s.platform.toLowerCase() === "linkedin") || data[0];
          setSnapshot(liSnapshot);
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
          formData.append("platform", "linkedin");
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
    useDemo ? DEMO_IMPRESSIONS_DATA : extracted.time_series?.map((p) => ({ period: p.period, value: p.value })) || [];

  const impressions = useDemo ? 1915 : (metrics.impressions ?? 0);
  const rawEngagement = useDemo ? 8.2 : (metrics.engagement_rate ?? 0);
  const engagementRate = rawEngagement > 0 && rawEngagement < 1 ? rawEngagement * 100 : rawEngagement;
  const profileVisits = useDemo ? 89 : (metrics.profile_visits ?? 0);
  const followers = useDemo ? 5120 : (metrics.followers ?? 0);
  const reactions = useDemo ? 156 : (metrics.likes ?? metrics.reactions ?? 0);
  const comments = useDemo ? 24 : (metrics.replies ?? metrics.comments ?? 0);
  const reposts = useDemo ? 12 : (metrics.reposts ?? metrics.shares ?? 0);
  const engagements = reactions + comments + reposts;

  const anomalyText = useDemo
    ? "LinkedIn reach dropped 22% this week; post frequency and newsletter engagement are down."
    : snapshot?.ai_insights?.anomaly_detected || extracted.strategic_analysis?.anomaly_detected || null;

  const actionableAdvice = useDemo
    ? "Focus on thought leadership posts and newsletters. Rolling post analytics now show which content drives profile views—double down on those formats."
    : snapshot?.ai_insights?.actionable_advice || extracted.strategic_analysis?.actionable_advice || null;

  const formatInsight = extracted.format_performance?.insight || null;

  const metricCards: MetricCard[] = useDemo
    ? [
        { label: "Impressions", value: impressions, change: -22 },
        { label: "Engagement rate", value: `${engagementRate}%`, change: 0.8 },
        { label: "Profile views", value: profileVisits, change: -15 },
        { label: "Followers", value: followers.toLocaleString(), change: 0.6 },
        { label: "Reactions", value: reactions, change: -12 },
        { label: "Comments", value: comments, change: 20 },
        { label: "Reposts", value: reposts, change: -25 },
      ]
    : [
        { label: "Impressions", value: impressions },
        { label: "Engagement rate", value: `${engagementRate}%` },
        { label: "Profile views", value: profileVisits },
        { label: "Followers", value: followers },
        { label: "Reactions", value: reactions },
        { label: "Comments", value: comments },
        { label: "Reposts", value: reposts },
      ];

  const followsData = useDemo ? DEMO_FOLLOWERS_DATA : [];

  return (
    <AnalyticsChatProvider platform="linkedin" demoMode={useDemo} panelOpen={chatOpen} screenshotsUploadedTrigger={screenshotsUploadedTrigger}>
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
                    <Linkedin className="w-8 h-8" style={{ color: LINKEDIN_BLUE }} />
                    LinkedIn Deep Dive
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
                style={{ backgroundColor: LINKEDIN_BLUE }}
              >
                <Camera className="w-4 h-4 mr-2" />
                Upload LinkedIn Screenshot
              </Button>
            </div>
          </motion.div>

          {/* Platform Watch - LinkedIn updates */}
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

            {(useDemo || (snapshot && impressions > 0)) && (anomalyText || impressions > 0) && (
              <Card className="border-blue-200/60 dark:border-blue-900/50 bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/20 dark:to-transparent">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lightbulb className="w-4 h-4" style={{ color: LINKEDIN_BLUE }} />
                    Quick Insights
                    {useDemo && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">(sample)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: LINKEDIN_BLUE }} />
                      <span><strong>Impressions:</strong> {impressions ? `${impressions.toLocaleString()} total. Use rolling post analytics to see which content drives reach.` : "Upload screenshots for trend analysis."}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: LINKEDIN_BLUE }} />
                      <span><strong>Authority:</strong> Newsletter growth and thought leadership posts boost algorithm distribution. Track post-level follower attribution.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: LINKEDIN_BLUE }} />
                      <span><strong>Profile views:</strong> {profileVisits} ({impressions ? `${((profileVisits / impressions) * 100).toFixed(1)}%` : "—"} of reach)—optimize headline and featured section.</span>
                    </li>
                    {formatInsight && (
                      <li className="flex items-start gap-2">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: LINKEDIN_BLUE }} />
                        <span>{formatInsight}</span>
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </motion.div>

          {/* Analytics Chart */}
          <motion.div id="analytics-chart" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
            <Card className="border-blue-200/80 dark:border-blue-800/50 bg-gradient-to-br from-white to-blue-50/30 dark:from-background dark:to-blue-950/10 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: LINKEDIN_BLUE }} />
                  Impressions Over Time
                </CardTitle>
                <p className="text-sm text-muted-foreground">Post reach and profile visibility</p>
              </CardHeader>
              <CardContent className="pt-0">
                {timeSeries.length === 0 && !useDemo ? (
                  <div
                    className="h-[280px] flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-blue-500/30 transition-colors cursor-pointer"
                    onClick={() => setUploadOpen(true)}
                  >
                    <TrendingUp className="w-12 h-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No impressions data yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Upload LinkedIn analytics screenshots to see trends</p>
                    <Button variant="outline" size="sm" className="mt-4" style={{ borderColor: `${LINKEDIN_BLUE}80`, color: LINKEDIN_BLUE }}>
                      <Camera className="w-3.5 h-3.5 mr-2" /> Upload
                    </Button>
                  </div>
                ) : (
                  <div className="h-[280px]">
                    <ChartContainer config={{ impressions: { label: "Impressions", color: LINKEDIN_BLUE } }} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timeSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                          <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} domain={[0, "auto"]} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill={LINKEDIN_BLUE} radius={[4, 4, 0, 0]} name="Impressions" />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Follower Growth + Key Metrics */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card className="border-slate-200/80 dark:border-slate-700/50 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-950/30 dark:to-background">
              <CardHeader>
                <CardTitle className="text-base">Follower Growth</CardTitle>
                <p className="text-sm text-muted-foreground">Net new followers over time</p>
              </CardHeader>
              <CardContent>
                {useDemo && followsData.length > 0 ? (
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={followsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} domain={["dataMin - 2", "dataMax + 2"]} />
                        <Tooltip />
                        <Bar dataKey="net" radius={[4, 4, 0, 0]} name="Net followers">
                          {followsData.map((_, idx) => (
                            <Cell key={idx} fill={followsData[idx].net >= 0 ? LINKEDIN_BLUE : "#EF4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground text-sm">
                    Upload LinkedIn Creator Analytics screenshots for follower growth trends.
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Key Metrics */}
          <motion.div id="key-metrics" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-emerald-200/60 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-white dark:from-emerald-950/10 dark:to-background">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-600" />
                  Key Metrics
                </CardTitle>
                <p className="text-sm text-muted-foreground">Snapshot of your LinkedIn performance</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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

          {/* Reach Funnel */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
            <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/30 to-white dark:from-amber-950/10 dark:to-background">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-4 h-4" style={{ color: LINKEDIN_BLUE }} />
                  Reach Funnel
                </CardTitle>
                <p className="text-sm text-muted-foreground">Impressions → Engagements → Profile Clicks</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-3xl font-bold" style={{ color: LINKEDIN_BLUE }}>{impressions.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Impressions</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-600">{engagements.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Engagements</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {impressions ? `${((engagements / impressions) * 100).toFixed(1)}% conversion` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-foreground">{profileVisits.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Profile Views</p>
                    <p className="text-xs text-emerald-600 font-medium mt-1">
                      {impressions ? `${((profileVisits / impressions) * 100).toFixed(2)}% of reach` : "—"}
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
            <DialogTitle>Upload LinkedIn Screenshot</DialogTitle>
            <DialogDescription>
              Upload Creator Analytics dashboards or post screenshots. Our AI extracts impressions, engagement, profile views, and follower data.
            </DialogDescription>
          </DialogHeader>
          <label
            htmlFor="linkedin-screenshot-upload"
            className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-muted-foreground/30 rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <Camera className="w-10 h-10 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Click or drag LinkedIn analytics screenshots</span>
            <span className="text-xs text-muted-foreground/70 mt-1">JPEG, PNG, WebP · Max 10MB each</span>
            <input
              id="linkedin-screenshot-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          {uploading && (
            <p className="text-sm" style={{ color: LINKEDIN_BLUE }}>
              {uploadProgress ? `Analyzing ${uploadProgress.current} of ${uploadProgress.total}...` : "Analyzing..."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <Button
        aria-label="Open LinkedIn Analytics Assistant"
        onClick={() => setChatOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg"
        style={{ backgroundColor: LINKEDIN_BLUE }}
      >
        <Bot className="h-7 w-7 text-white" strokeWidth={2} />
      </Button>
      <AnalyticsChatPanel open={chatOpen} onOpenChange={setChatOpen} />
    </div>
    </AnalyticsChatProvider>
  );
}
