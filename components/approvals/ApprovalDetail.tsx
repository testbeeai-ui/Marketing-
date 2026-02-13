"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Linkedin, Twitter, Instagram, Facebook, CheckCircle2, AlertTriangle, X, ArrowLeft, Loader2, ExternalLink, MessageSquare, Repeat2, Heart, Share, Bookmark, ThumbsUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { approvalsApi, type Approval, type ChangesRequestedPerAsset } from "@/lib/api";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { DEMO_APPROVAL_ID, getDummyApproval } from "./ApprovalsList";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { renderMarkdown } from "@/lib/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

const platforms = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "twitter", name: "Twitter/X", icon: Twitter },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "facebook", name: "Facebook", icon: Facebook },
];

const statusConfig = {
  pending: { icon: CheckCircle2, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", label: "Approved" },
  changes_requested: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Changes Requested" },
  rejected: { icon: X, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Rejected" },
};

/** Full-frame platform preview: image first, then text, with platform-specific styling */
function PlatformPreviewFrame({
  platformId,
  content,
  approval,
  hasText,
  hasImage,
}: {
  platformId: string;
  content: { text?: string; imageUrl?: string; imagePrompt?: string };
  approval: Approval;
  hasText: boolean;
  hasImage: boolean;
}) {
  const platform = platforms.find((p) => p.id === platformId);
  const perAsset = approval.changes_requested_per_asset?.[platformId];
  const textFeedback = perAsset?.text?.trim();
  const imageFeedback = perAsset?.image?.trim();

  const showImageFirst = hasImage && content.imageUrl;
  const showText = hasText && content.text;

  const contentBlock = (
    <>
      {/* Image first (how it appears on feed) */}
      {showImageFirst && (
        <div className="relative w-full">
          <img
            src={content.imageUrl}
            alt=""
            className="w-full object-cover max-h-[360px] object-top bg-muted"
          />
          {imageFeedback && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full bg-orange-500 text-white hover:bg-orange-600 shadow-md"
                  aria-label="View feedback for this image"
                >
                  <AlertTriangle className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-sm" align="end">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Feedback – Image</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{imageFeedback}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}
      {/* Text/caption below */}
      {showText && (
        <div className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div
              className="prose prose-sm dark:prose-invert max-w-none flex-1 min-w-0"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content.text ?? "") }}
            />
            {textFeedback && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-orange-500 hover:text-orange-600" aria-label="View feedback for this text">
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="max-w-sm" align="end">
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">Feedback – Text</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{textFeedback}</p>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (platformId === "linkedin") {
    return (
      <div className="rounded-lg border-2 border-[#0A66C2]/30 bg-background overflow-hidden shadow-lg max-w-lg mx-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-[#0A66C2]/5">
          <div className="w-12 h-12 rounded-full bg-[#0A66C2]/20 flex items-center justify-center text-[#0A66C2] font-bold text-sm">You</div>
          <div>
            <div className="font-semibold text-sm">Your Name</div>
            <div className="text-xs text-muted-foreground">Headline · 1st · Just now · 🌐</div>
          </div>
        </div>
        {contentBlock}
        <div className="flex items-center justify-around py-2 border-t border-border/50 text-muted-foreground text-sm">
          <span className="flex items-center gap-1"><ThumbsUp className="w-4 h-4" /> Like</span>
          <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" /> Comment</span>
          <span className="flex items-center gap-1"><Repeat2 className="w-4 h-4" /> Repost</span>
          <span className="flex items-center gap-1"><Share className="w-4 h-4" /> Send</span>
        </div>
      </div>
    );
  }
  if (platformId === "twitter" || platformId === "x") {
    return (
      <div className="rounded-xl border-2 border-[#1DA1F2]/30 bg-background overflow-hidden shadow-lg max-w-lg mx-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-[#1DA1F2]/5">
          <div className="w-12 h-12 rounded-full bg-[#1DA1F2]/20 flex items-center justify-center text-[#1DA1F2] font-bold text-sm">You</div>
          <div className="flex-1">
            <div className="font-bold text-sm">Your Name</div>
            <div className="text-xs text-muted-foreground">@your_handle</div>
          </div>
        </div>
        {contentBlock}
        <div className="flex items-center justify-around py-2 px-4 border-t border-border/50 text-muted-foreground text-sm">
          <span className="flex items-center gap-1.5"><MessageSquare className="w-4 h-4" /> Reply</span>
          <span className="flex items-center gap-1.5"><Repeat2 className="w-4 h-4" /> Repost</span>
          <span className="flex items-center gap-1.5"><Heart className="w-4 h-4" /> Like</span>
          <span className="flex items-center gap-1.5"><Share className="w-4 h-4" /> Share</span>
        </div>
      </div>
    );
  }
  if (platformId === "instagram") {
    return (
      <div className="rounded-xl border-2 border-transparent bg-gradient-to-br from-[#833AB4]/15 via-[#FD1D1D]/15 to-[#F77737]/15 overflow-hidden shadow-lg max-w-md mx-auto">
        <div className="flex items-center gap-3 p-3 border-b border-border/30">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#833AB4] via-[#FD1D1D] to-[#F77737] p-0.5">
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center text-xs font-bold">You</div>
          </div>
          <div className="flex-1 font-semibold text-sm">your_handle</div>
          <span className="text-muted-foreground">•••</span>
        </div>
        {contentBlock}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 text-muted-foreground">
          <div className="flex items-center gap-4">
            <Heart className="w-6 h-6" />
            <MessageSquare className="w-6 h-6" />
            <Share className="w-6 h-6" />
          </div>
          <Bookmark className="w-6 h-6" />
        </div>
      </div>
    );
  }
  if (platformId === "facebook") {
    return (
      <div className="rounded-lg border-2 border-[#1877F2]/30 bg-background overflow-hidden shadow-lg max-w-lg mx-auto">
        <div className="flex items-center gap-3 p-4 border-b border-border/50 bg-[#1877F2]/5">
          <div className="w-10 h-10 rounded-full bg-[#1877F2]/20 flex items-center justify-center text-[#1877F2] font-bold text-sm">You</div>
          <div className="flex-1">
            <div className="font-semibold text-sm">Your Name</div>
            <div className="text-xs text-muted-foreground">Just now · 🌐</div>
          </div>
          <span className="text-muted-foreground">•••</span>
        </div>
        {contentBlock}
        <div className="flex items-center justify-around py-2 border-t border-border/50 text-muted-foreground text-sm">
          <span className="flex items-center gap-2"><ThumbsUp className="w-5 h-5" /> Like</span>
          <span className="flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Comment</span>
          <span className="flex items-center gap-2"><Share className="w-5 h-5" /> Share</span>
        </div>
      </div>
    );
  }

  const Icon = platform?.icon;
  return (
    <div className="rounded-lg border-2 border-border bg-background overflow-hidden shadow-lg max-w-lg mx-auto">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b">
        {Icon && <Icon className="w-5 h-5" />}
        <span className="font-semibold">{platform?.name ?? platformId}</span>
      </div>
      {contentBlock}
    </div>
  );
}

interface ApprovalDetailProps {
  approvalId: string;
}

export function ApprovalDetail({ approvalId }: ApprovalDetailProps) {
  const router = useRouter();
  const { activeOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [changesFeedback, setChangesFeedback] = useState("");
  const [perAssetFeedback, setPerAssetFeedback] = useState<ChangesRequestedPerAsset>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activePlatformTab, setActivePlatformTab] = useState<string>("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectPlatforms, setRejectPlatforms] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  const isDemoApproval = approvalId === DEMO_APPROVAL_ID;
  const { data, isLoading, error } = useQuery({
    queryKey: ["approval", activeOrganization?.id, approvalId],
    queryFn: async () => {
      if (!activeOrganization?.id) throw new Error("No active organization");
      const result = await approvalsApi.getById(activeOrganization.id, approvalId);
      return result.approval;
    },
    enabled: !!activeOrganization?.id && !!approvalId && !isDemoApproval,
  });

  const approval = isDemoApproval && activeOrganization?.id
    ? getDummyApproval(activeOrganization.id)
    : (data as Approval | undefined);

  useEffect(() => {
    if (approval?.platforms?.length && !activePlatformTab) setActivePlatformTab(approval.platforms[0]);
  }, [approval?.platforms, activePlatformTab]);

  // Assigned member can take action when pending or when changes_requested (add more feedback or approve). Hide for demo sample.
  const canApprove = approval?.assigned_to === currentUserId;
  const showActions = !isDemoApproval && canApprove && (approval?.status === "pending" || approval?.status === "changes_requested");

  type UpdateStatusVars = {
    status: "approved" | "changes_requested" | "rejected";
    feedback?: string;
    perAsset?: ChangesRequestedPerAsset;
    _submittedPlatformId?: string;
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, feedback, perAsset }: UpdateStatusVars) => {
      if (!activeOrganization?.id) throw new Error("No active organization");
      return approvalsApi.updateStatus(activeOrganization.id, approvalId, status, feedback, perAsset);
    },
    onSuccess: (data: { success?: boolean; approval?: Approval }, variables: UpdateStatusVars) => {
      queryClient.invalidateQueries({ queryKey: ["approval", activeOrganization?.id, approvalId] });
      queryClient.invalidateQueries({ queryKey: ["approvals", activeOrganization?.id] });
      setShowChangesDialog(false);
      setChangesFeedback("");
      setPerAssetFeedback({});
      setShowApproveConfirm(false);

      if (variables._submittedPlatformId != null && variables.status === "changes_requested") {
        const updatedApproval = data?.approval;
        const allPlatformsHaveFeedback =
          updatedApproval?.platforms?.every((p) =>
            hasAnyPerAssetFeedback({ [p]: updatedApproval?.changes_requested_per_asset?.[p] ?? {} })
          ) ?? false;
        if (allPlatformsHaveFeedback) {
          toast.success("Successfully all modify changes are done.");
        } else {
          const platformName = platforms.find((p) => p.id === variables._submittedPlatformId)?.name ?? variables._submittedPlatformId;
          toast.success(`Submitted for ${platformName}. Add feedback for other platforms or approve.`);
        }
      } else if (variables.status === "approved") {
        toast.success("Approval approved.");
      } else if (variables.status === "rejected") {
        toast.success("Approval rejected.");
      } else {
        toast.success("Approval status updated");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update approval");
    },
  });

  const handleApprove = () => {
    setShowApproveConfirm(true);
  };

  const confirmApprove = () => {
    updateStatusMutation.mutate({ status: "approved" });
  };

  const hasAnyPerAssetFeedback = (pa: ChangesRequestedPerAsset) =>
    Object.values(pa).some((v) => (v?.text?.trim() || v?.image?.trim()) ?? false);

  const handleRequestChanges = () => {
    const currentPlatformFeedback = perAssetFeedback[activePlatformTab];
    const hasGeneral = changesFeedback.trim().length > 0;
    const hasPerAsset = currentPlatformFeedback && hasAnyPerAssetFeedback({ [activePlatformTab]: currentPlatformFeedback });
    if (!hasGeneral && !hasPerAsset) {
      toast.error("Please add feedback for this platform (text and/or image) or a summary.");
      return;
    }
    const mergedPerAsset: ChangesRequestedPerAsset = {
      ...(approval?.changes_requested_per_asset ?? {}),
      [activePlatformTab]: { ...(approval?.changes_requested_per_asset?.[activePlatformTab] ?? {}), ...(perAssetFeedback[activePlatformTab] ?? {}) },
    };
    updateStatusMutation.mutate({
      status: "changes_requested",
      feedback: changesFeedback.trim() || undefined,
      perAsset: mergedPerAsset,
      _submittedPlatformId: activePlatformTab,
    });
  };

  const handleReject = () => {
    const platformNames = rejectPlatforms
      .map((id) => platforms.find((p) => p.id === id)?.name ?? id)
      .filter(Boolean);
    const forText = platformNames.length > 0 ? `Rejected for: ${platformNames.join(", ")}.` : "Rejected.";
    const feedback = [forText, rejectReason.trim()].filter(Boolean).join("\n\n");
    updateStatusMutation.mutate({
      status: "rejected",
      feedback: feedback || "Rejected",
      perAsset: undefined,
    });
    setShowRejectDialog(false);
    setRejectPlatforms([]);
    setRejectReason("");
  };

  const openRejectDialog = () => {
    setRejectPlatforms(approval?.platforms ?? []);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  // Build "Go to block" URL with optional highlight for first asset with feedback
  const goToBlockUrl = (() => {
    if (!approval?.block_id) return null;
    const params = new URLSearchParams();
    params.set("sub_block", approval.sub_block_id);
    params.set("approval", approval.id);
    const per = approval.changes_requested_per_asset;
    if (per) {
      for (const platformId of approval.platforms) {
        const p = per[platformId];
        if (p?.text?.trim()) {
          params.set("highlight", `${platformId}_text`);
          break;
        }
        if (p?.image?.trim()) {
          params.set("highlight", `${platformId}_image`);
          break;
        }
      }
    }
    return `/workspace/${approval.block_id}?${params.toString()}`;
  })();

  if ((!isDemoApproval && isLoading) || (isDemoApproval && !activeOrganization?.id)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!approval || (!isDemoApproval && error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <p className="text-destructive mb-4">Failed to load approval</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const config = statusConfig[approval.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const currentTabId = activePlatformTab || approval.platforms[0];
  const currentPlatformName = platforms.find((p) => p.id === currentTabId)?.name ?? currentTabId;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-32">
      {isDemoApproval && (
        <div className="mb-4 p-4 rounded-xl bg-muted/60 border border-border">
          <p className="text-sm font-medium text-muted-foreground">
            Sample approval (demo) – This is for demonstration. Request access to create and manage real approvals.
          </p>
        </div>
      )}

      {/* Top bar: Back, title, status, Go to block */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="shrink-0 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            {isDemoApproval ? "Sample Approval" : "Approval Details"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isDemoApproval ? "Apply changes to see how the workflow works" : "Review content and provide feedback"}
          </p>
        </div>
        <Badge variant="outline" className={cn("shrink-0 gap-1.5 text-xs font-semibold", config.bg, config.color, config.border)}>
          <StatusIcon className="w-3.5 h-3.5" />
          {config.label}
        </Badge>
        {!isDemoApproval && goToBlockUrl && (
          <Button variant="outline" size="sm" asChild className="shrink-0">
            <Link href={goToBlockUrl}>
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Go to block
            </Link>
          </Button>
        )}
      </div>

      {/* Sticky action bar – always visible: Approve | Request changes | Reject */}
      <div className="sticky top-0 z-10 mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
        {showActions ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mr-2">Actions</span>
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={updateStatusMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPerAssetFeedback({ ...(approval.changes_requested_per_asset ?? {}), [activePlatformTab]: approval.changes_requested_per_asset?.[activePlatformTab] ?? {} });
                setChangesFeedback("");
                setShowChangesDialog(true);
              }}
              disabled={updateStatusMutation.isPending}
              className="border-orange-500/50 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700 dark:text-orange-400"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Request changes
              {currentPlatformName && <span className="hidden sm:inline"> ({currentPlatformName})</span>}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={openRejectDialog}
              disabled={updateStatusMutation.isPending}
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
            {approval.status === "changes_requested" && (
              <p className="text-xs text-orange-600 dark:text-orange-400 w-full sm:w-auto mt-1 sm:mt-0">
                Switch tab above to add feedback for another platform, or Approve when ready.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Assigned to <span className="font-medium text-foreground">{approval.assignee_email || "Unknown"}</span>. Only the assigned reviewer can approve or request changes.
          </p>
        )}
      </div>

      {/* Main content card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/30">
          <CardTitle className="text-lg">Content Approval Request</CardTitle>
          <div className="text-sm text-muted-foreground mt-2 space-y-1">
            <div>
              Created by <span className="font-medium text-foreground">{approval.creator_email || "Unknown"}</span>
              {" · "}
              {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
            </div>
            <div>
              Assigned to <span className="font-medium text-foreground">{approval.assignee_email || "Unknown"}</span>
            </div>
            {approval.approved_by && approval.approved_at && (
              <div>
                Approved by <span className="font-medium text-foreground">{approval.approver_email || "Unknown"}</span>
                {" · "}
                {formatDistanceToNow(new Date(approval.approved_at), { addSuffix: true })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Switch tabs to preview how the post looks on each platform. Use <strong>Request changes</strong> to send feedback for the current tab only.
          </p>
          <Tabs value={activePlatformTab || approval.platforms[0]} onValueChange={setActivePlatformTab} className="w-full">
            <TabsList className="w-full flex overflow-x-auto rounded-lg bg-muted/50 p-1 gap-1 min-h-11 no-scrollbar">
              {approval.platforms.map((platformId) => {
                const platform = platforms.find((p) => p.id === platformId);
                const Icon = platform?.icon;
                const perAsset = approval.changes_requested_per_asset?.[platformId];
                const hasSubmitted = perAsset && (perAsset.text?.trim() || perAsset.image?.trim());
                return (
                  <TabsTrigger
                    key={platformId}
                    value={platformId}
                    className="flex items-center gap-2 capitalize shrink-0 min-w-[120px] sm:min-w-[140px] justify-center data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{platform?.name ?? platformId}</span>
                    {hasSubmitted && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal shrink-0">Done</Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

                {approval.platforms.map((platformId) => {
                  const content = approval.platform_contents[platformId];
                  if (!content) return null;
                  const hasText = (approval.content_type === "text" || approval.content_type === "both") && content.text;
                  const hasImage = (approval.content_type === "image" || approval.content_type === "both") && content.imageUrl;
                  if (!hasText && !hasImage) return null;
                  const platformName = platforms.find((p) => p.id === platformId)?.name ?? platformId;
                  const perAsset = approval.changes_requested_per_asset?.[platformId];
                  const hasFeedbackForThisPlatform = perAsset && (perAsset.text?.trim() || perAsset.image?.trim());
                  return (
                    <TabsContent key={platformId} value={platformId} className="mt-4 focus-visible:outline-none space-y-4">
                      <PlatformPreviewFrame
                        platformId={platformId}
                        content={content}
                        approval={approval}
                        hasText={!!hasText}
                        hasImage={!!hasImage}
                      />
                      {hasFeedbackForThisPlatform && (
                        <Card className="bg-orange-500/10 border-2 border-orange-500/30 shrink-0">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-base">
                              <AlertTriangle className="w-4 h-4" />
                              Changes requested for {platformName}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {perAsset?.text?.trim() && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-orange-600 dark:text-orange-400 mb-1">Text</p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{perAsset.text}</p>
                              </div>
                            )}
                            {perAsset?.image?.trim() && (
                              <div>
                                <p className="text-xs font-semibold uppercase text-orange-600 dark:text-orange-400 mb-1">Image</p>
                                <p className="text-sm text-foreground whitespace-pre-wrap">{perAsset.image}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>

              {approval.changes_requested && (
                <Card className="bg-orange-500/10 border-orange-500/20 shrink-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400 text-base">
                      <AlertTriangle className="w-4 h-4" />
                      Changes Requested
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-orange-600 dark:text-orange-300 whitespace-pre-wrap">
                      {approval.changes_requested}
                    </p>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

      {/* Request changes (Modify) dialog */}
      <Dialog open={showChangesDialog} onOpenChange={(open) => {
        setShowChangesDialog(open);
        if (!open) setChangesFeedback("");
        else if (approval?.changes_requested_per_asset) setPerAssetFeedback({ ...approval.changes_requested_per_asset });
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Request changes (Modify)
            </DialogTitle>
            <DialogDescription>
              Add feedback for <strong>{platforms.find((p) => p.id === activePlatformTab)?.name ?? activePlatformTab}</strong> only. The marketer will see your comments for this platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activePlatformTab && approval && (() => {
              const platformId = activePlatformTab;
              const platform = platforms.find((p) => p.id === platformId);
              const PlatformIcon = platform?.icon;
              const hasText = approval.content_type === "text" || approval.content_type === "both";
              const hasImage = approval.content_type === "image" || approval.content_type === "both";
              const pa = perAssetFeedback[platformId] ?? { text: "", image: "" };
              return (
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {PlatformIcon && <PlatformIcon className="w-4 h-4" />}
                      {platform?.name ?? platformId}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {hasText && (
                      <div>
                        <Label className="text-sm">Text feedback</Label>
                        <Textarea
                          placeholder="Feedback for this platform’s text..."
                          value={pa.text ?? ""}
                          onChange={(e) =>
                            setPerAssetFeedback((prev) => ({
                              ...prev,
                              [platformId]: { ...prev[platformId], text: e.target.value },
                            }))
                          }
                          rows={2}
                          className="mt-1"
                        />
                      </div>
                    )}
                    {hasImage && (
                      <div>
                        <Label className="text-sm">Image feedback</Label>
                        <Textarea
                          placeholder="Feedback for this platform’s image..."
                          value={pa.image ?? ""}
                          onChange={(e) =>
                            setPerAssetFeedback((prev) => ({
                              ...prev,
                              [platformId]: { ...prev[platformId], image: e.target.value },
                            }))
                          }
                          rows={3}
                          className="mt-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}
            <div>
              <Label htmlFor="feedback">Summary (optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Brief summary..."
                value={changesFeedback}
                onChange={(e) => setChangesFeedback(e.target.value)}
                rows={2}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowChangesDialog(false); setChangesFeedback(""); }}>
                Cancel
              </Button>
              <Button onClick={handleRequestChanges} disabled={updateStatusMutation.isPending}>
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit feedback for this platform"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Approve confirmation – all platforms */}
      <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve for all platforms?</DialogTitle>
            <DialogDescription>
              This will approve the <strong>entire</strong> content for <strong>all platforms</strong> (e.g. LinkedIn, Instagram, …), not just the current tab. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowApproveConfirm(false)}>Cancel</Button>
            <Button
              onClick={() => {
                confirmApprove();
              }}
              disabled={updateStatusMutation.isPending}
            >
              {updateStatusMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject dialog – specify which platforms are rejected */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject approval</DialogTitle>
            <DialogDescription>
              Choose which platforms this rejection applies to. The marketer will see exactly what was rejected. This action applies to the <strong>entire</strong> approval for the selected platforms, not a single piece of content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Reject for these platforms</Label>
              <div className="mt-2 flex flex-wrap gap-4">
                {approval?.platforms.map((platformId) => {
                  const platform = platforms.find((p) => p.id === platformId);
                  const checked = rejectPlatforms.includes(platformId);
                  return (
                    <label key={platformId} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          setRejectPlatforms((prev) =>
                            c ? [...prev, platformId] : prev.filter((p) => p !== platformId)
                          );
                        }}
                      />
                      <span className="text-sm">{platform?.name ?? platformId}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="reject-reason" className="text-sm">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                placeholder="e.g. Tone doesn't fit brand..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectPlatforms.length === 0 || updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  `Reject ${rejectPlatforms.length === (approval?.platforms?.length ?? 0) ? "all" : rejectPlatforms.length + " platform(s)"}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
