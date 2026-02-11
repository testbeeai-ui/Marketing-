"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, User, Users, Lightbulb } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

interface ExtractedData {
  platform?: string;
  metrics?: {
    impressions?: number;
    engagement_rate?: number;
    followers?: number;
    top_post_topic?: string;
  };
  strategic_analysis?: {
    mood?: string;
    anomaly_detected?: string;
    actionable_advice?: string;
  };
}

interface CompareResult {
  yourData: ExtractedData;
  competitorData: ExtractedData;
  gapAnalysis: string;
}

function MetricCard({ label, value }: { label: string; value: string | number | null | undefined }) {
  const v = value ?? "-";
  return (
    <div className="text-sm">
      <span className="text-gray-500">{label}:</span>{" "}
      <span className="font-medium">{String(v)}</span>
    </div>
  );
}

export default function CompetitorGapAnalysis() {
  const [yourFile, setYourFile] = useState<File | null>(null);
  const [competitorFile, setCompetitorFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);

  const handleCompare = useCallback(async () => {
    if (!yourFile || !competitorFile) {
      toast.error("Please upload both screenshots");
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("yourFile", yourFile);
      formData.append("competitorFile", competitorFile);

      const res = await fetch("/api/analyze-compare", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Comparison failed");
      }

      const data = await res.json();
      setResult({
        yourData: data.yourData,
        competitorData: data.competitorData,
        gapAnalysis: data.gapAnalysis,
      });
      toast.success("Comparison complete");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compare profiles");
    } finally {
      setLoading(false);
    }
  }, [yourFile, competitorFile]);

  const renderProfileCard = (
    data: ExtractedData,
    title: string,
    icon: React.ReactNode,
    borderColor: string,
    bgColor: string
  ) => (
    <Card className={`border-2 ${borderColor} ${bgColor}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <MetricCard label="Platform" value={data.platform} />
        <MetricCard label="Impressions" value={data.metrics?.impressions} />
        <MetricCard label="Engagement" value={data.metrics?.engagement_rate != null ? `${data.metrics.engagement_rate}%` : undefined} />
        <MetricCard label="Followers" value={data.metrics?.followers} />
        <MetricCard label="Top Post Topic" value={data.metrics?.top_post_topic} />
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-24 pb-12 px-6 storyteller">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Button variant="ghost" size="sm" className="mb-4 text-gray-600 hover:text-gray-900" asChild>
              <Link href="/storyteller">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Competitor Gap Analysis</h1>
            <p className="text-gray-600 mt-1">
              Compare your profile analytics with a competitor to find opportunities.
            </p>
          </motion.div>

          {/* Upload Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            <Card className="border-2 border-green-500/50 bg-green-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-green-800">
                  <User className="w-4 h-4" />
                  Your Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-green-300 rounded-lg cursor-pointer hover:bg-green-50/50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setYourFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-sm text-green-700">
                    {yourFile ? yourFile.name : "Upload screenshot"}
                  </span>
                </label>
              </CardContent>
            </Card>

            <Card className="border-2 border-yellow-500/50 bg-yellow-50/30 flex flex-col items-center justify-center">
              <CardContent className="pt-6">
                <Lightbulb className="w-10 h-10 text-yellow-600 mb-2" />
                <p className="text-sm text-center text-yellow-800 font-medium">The Gap</p>
                <Button
                  onClick={handleCompare}
                  disabled={loading || !yourFile || !competitorFile}
                  className="mt-4 bg-storyteller-primary hover:bg-storyteller-primary/90"
                >
                  {loading ? "Comparing..." : "Compare"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-2 border-red-500/50 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-red-800">
                  <Users className="w-4 h-4" />
                  Competitor
                </CardTitle>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50/50">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => setCompetitorFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="text-sm text-red-700">
                    {competitorFile ? competitorFile.name : "Upload screenshot"}
                  </span>
                </label>
              </CardContent>
            </Card>
          </motion.div>

          {/* Results */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {renderProfileCard(
                result.yourData,
                "You",
                <User className="w-4 h-4 text-green-600" />,
                "border-green-500",
                "bg-green-50/30"
              )}
              <Card className="border-2 border-yellow-500 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-yellow-900">
                    <Lightbulb className="w-4 h-4" />
                    The Gap
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-yellow-900 whitespace-pre-wrap">
                    {result.gapAnalysis}
                  </p>
                </CardContent>
              </Card>
              {renderProfileCard(
                result.competitorData,
                "Competitor",
                <Users className="w-4 h-4 text-red-600" />,
                "border-red-500",
                "bg-red-50/30"
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
