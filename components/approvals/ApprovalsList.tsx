"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Linkedin, Instagram, Facebook, Clock, CheckCircle2, AlertTriangle, X, Loader2, ExternalLink, Calendar, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { approvalsApi, type Approval } from "@/lib/api";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { PUBLIC_DEMO_ORGANIZATION_ID } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";
import { ApprovalsCalendar } from "./ApprovalsCalendar";

export const DEMO_APPROVAL_ID = "demo-approval-sample";

export function getDummyApproval(organizationId: string): Approval {
  const now = new Date().toISOString();
  return {
    id: DEMO_APPROVAL_ID,
    organization_id: organizationId,
    sub_block_id: "demo-sub-block",
    created_by: "00000000-0000-0000-0000-000000000001",
    assigned_to: "00000000-0000-0000-0000-000000000002",
    platform_contents: { linkedin: { text: "Sample content for review. Apply changes to see how approvals work." } },
    content_type: "both",
    platforms: ["linkedin"],
    status: "changes_requested",
    changes_requested: "Sample: Apply changes to see the full workflow.",
    created_at: now,
    updated_at: now,
    creator_email: "Demo user",
    assignee_email: "Demo user",
  };
}

const platforms = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "twitter", name: "Twitter/X", icon: X },
  { id: "x", name: "X", icon: X },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "facebook", name: "Facebook", icon: Facebook },
];

const statusConfig = {
  pending: { icon: Clock, color: "text-yellow-500", bg: "bg-yellow-500/10", border: "border-yellow-500/20", label: "Pending" },
  approved: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", border: "border-green-500/20", label: "Approved" },
  changes_requested: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "Changes Requested" },
  rejected: { icon: X, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20", label: "Rejected" },
};

type ViewMode = "calendar" | "list";

export function ApprovalsList() {
  const { activeOrganization, isDemoMode } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [platformFilter, setPlatformFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["approvals", activeOrganization?.id, statusFilter],
    queryFn: async () => {
      if (!activeOrganization?.id) return { approvals: [] };
      return approvalsApi.list(activeOrganization.id, statusFilter ? { status: statusFilter } : undefined);
    },
    enabled: !!activeOrganization?.id,
  });

  const rawApprovals = data?.approvals || [];
  const isDemoOrg = activeOrganization?.id === PUBLIC_DEMO_ORGANIZATION_ID;
  const approvals =
    isDemoMode && isDemoOrg
      ? [...rawApprovals, getDummyApproval(activeOrganization.id)]
      : rawApprovals;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-destructive">Failed to load approvals</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Approvals</h1>
          <p className="text-muted-foreground mt-1">
            Review and manage content approval requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Calendar / List view toggle */}
          <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode("calendar")}
            >
              <Calendar className="h-4 w-4" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
              List
            </Button>
          </div>
          {viewMode === "list" && (
            <div className="flex gap-2">
              <Button
                variant={statusFilter === undefined ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(undefined)}
              >
                All
              </Button>
              <Button
                variant={statusFilter === "pending" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("pending")}
              >
                Pending
              </Button>
              <Button
                variant={statusFilter === "approved" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("approved")}
              >
                Approved
              </Button>
              <Button
                variant={statusFilter === "changes_requested" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("changes_requested")}
              >
                Changes Requested
              </Button>
            </div>
          )}
        </div>
      </div>

      {viewMode === "calendar" && (
        <ApprovalsCalendar
          approvals={approvals}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          platformFilter={platformFilter}
          onPlatformFilterChange={setPlatformFilter}
        />
      )}

      {viewMode === "list" && approvals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-muted-foreground">
              No approvals found
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter
                ? `No ${statusFilter.replace("_", " ")} approvals`
                : "No approval requests yet"}
            </p>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="grid gap-4">
          {approvals.map((approval: Approval) => {
            const config = statusConfig[approval.status as keyof typeof statusConfig] || statusConfig.pending;
            const StatusIcon = config?.icon ?? Clock;

            const openBlockUrl =
              approval.block_id
                ? `/workspace/${approval.block_id}?sub_block=${encodeURIComponent(approval.sub_block_id)}&approval=${encodeURIComponent(approval.id)}`
                : null;

            return (
              <Card key={approval.id} className="hover:bg-accent/50 transition-colors">
                <Link href={`/approvals/${approval.id}`} className="block">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant="outline"
                            className={cn("gap-1.5", config.bg, config.color, config.border)}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </Badge>
                          <div className="flex items-center gap-1">
                            {approval.platforms.map((platformId) => {
                              const platform = platforms.find((p) => p.id === platformId);
                              const Icon = platform?.icon;
                              return Icon ? (
                                <Icon key={platformId} className="w-4 h-4 text-muted-foreground" />
                              ) : null;
                            })}
                          </div>
                        </div>
                        <CardTitle className="text-lg">
                          Content Approval Request
                        </CardTitle>
                        <CardDescription className="mt-1">
                          Created by {approval.creator_email || "Unknown"} •{" "}
                          {formatDistanceToNow(new Date(approval.created_at), {
                            addSuffix: true,
                          })}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Assigned to:</span>{" "}
                          <span className="font-medium">
                            {approval.assignee_email || "Unknown"}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Content:</span>{" "}
                          <span className="font-medium capitalize">
                            {approval.content_type}
                          </span>
                        </div>
                      </div>

                      {/* Preview of content */}
                      <div className="mt-4 p-3 bg-secondary/50 rounded-lg border border-border">
                        <div className="text-sm text-muted-foreground mb-2">Preview:</div>
                        {approval.platforms.slice(0, 2).map((platformId) => {
                          const content = approval.platform_contents[platformId];
                          if (!content) return null;

                          const platform = platforms.find((p) => p.id === platformId);
                          const PlatformIcon = platform?.icon;

                          return (
                            <div key={platformId} className="mb-2 last:mb-0">
                              <div className="flex items-center gap-2 mb-1">
                                {PlatformIcon && (
                                  <PlatformIcon className="w-4 h-4 text-muted-foreground" />
                                )}
                                <span className="text-xs font-medium capitalize">
                                  {platformId}
                                </span>
                              </div>
                              {content.text && (
                                <p className="text-sm line-clamp-2 text-foreground">
                                  {content.text}
                                </p>
                              )}
                              {content.imageUrl && (
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Image included
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {approval.platforms.length > 2 && (
                          <div className="text-xs text-muted-foreground mt-2">
                            +{approval.platforms.length - 2} more platform
                            {approval.platforms.length - 2 > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>

                      {approval.changes_requested && (
                        <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1">
                                Changes Requested
                              </div>
                              <p className="text-sm text-orange-600 dark:text-orange-300">
                                {approval.changes_requested}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Link>
                {openBlockUrl && (
                  <div className="px-6 pb-4 pt-0">
                    <Link
                      href={openBlockUrl}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in workspace
                    </Link>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
