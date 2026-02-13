"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  format,
  isSameDay,
  isWithinInterval,
  getWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, CheckCircle2, AlertTriangle, X, Linkedin, Instagram, Facebook, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type Approval } from "@/lib/api";

const PLATFORMS = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "twitter", name: "Twitter/X", icon: X },
  { id: "x", name: "X", icon: X },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "facebook", name: "Facebook", icon: Facebook },
];

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; bg: string; text: string }> = {
  pending: { icon: Clock, label: "Pending", bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-400" },
  approved: { icon: CheckCircle2, label: "Approved", bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-400" },
  changes_requested: { icon: AlertTriangle, label: "Changes requested", bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-400" },
  rejected: { icon: X, label: "Rejected", bg: "bg-red-500/15", text: "text-red-700 dark:text-red-400" },
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getApprovalDate(approval: Approval): Date {
  return new Date(approval.created_at);
}

function approvalMatchesPlatform(approval: Approval, platformId: string): boolean {
  return approval.platforms?.includes(platformId) ?? false;
}

export interface ApprovalsCalendarProps {
  approvals: Approval[];
  statusFilter: string | undefined;
  onStatusFilterChange: (status: string | undefined) => void;
  /** Optional platform filter (client-side). Pass "all" or specific platform id. */
  platformFilter?: string;
  onPlatformFilterChange?: (platform: string) => void;
}

export function ApprovalsCalendar({
  approvals,
  statusFilter,
  onStatusFilterChange,
  platformFilter = "all",
  onPlatformFilterChange,
}: ApprovalsCalendarProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  });

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const weekNumber = getWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredByPlatform = useMemo(() => {
    if (!platformFilter || platformFilter === "all") return approvals;
    return approvals.filter((a) => approvalMatchesPlatform(a, platformFilter));
  }, [approvals, platformFilter]);

  const approvalsByDay = useMemo(() => {
    const map: Record<string, Approval[]> = {};
    days.forEach((d) => {
      map[d.toISOString()] = [];
    });
    filteredByPlatform.forEach((a) => {
      const d = getApprovalDate(a);
      if (!isWithinInterval(d, { start: weekStart, end: weekEnd })) return;
      const dayKey = days.find((day) => isSameDay(day, d))?.toISOString();
      if (dayKey && map[dayKey]) map[dayKey].push(a);
    });
    days.forEach((d) => {
      const key = d.toISOString();
      if (map[key]) map[key].sort((a, b) => getApprovalDate(a).getTime() - getApprovalDate(b).getTime());
    });
    return map;
  }, [filteredByPlatform, weekStart, weekEnd, days]);

  const goPrevWeek = () => setWeekStart((s) => subWeeks(s, 1));
  const goNextWeek = () => setWeekStart((s) => addWeeks(s, 1));
  const goThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-4">
      {/* Calendar controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrevWeek} aria-label="Previous week">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNextWeek} aria-label="Next week">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <span className="text-sm font-medium text-foreground">
          {format(weekStart, "MMM d")} – {format(weekEnd, "d, yyyy")} (Week {weekNumber})
        </span>
        <Button variant="outline" size="sm" onClick={goThisWeek} className="ml-1">
          This week
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Select
            value={statusFilter ?? "all"}
            onValueChange={(v) => onStatusFilterChange(v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="changes_requested">Changes requested</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          {onPlatformFilterChange && (
            <Select value={platformFilter} onValueChange={onPlatformFilterChange}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All platforms</SelectItem>
                {PLATFORMS.filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2 min-h-[420px]">
        {days.map((day) => {
          const dayKey = day.toISOString();
          const dayApprovals = approvalsByDay[dayKey] ?? [];
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dayKey}
              className={cn(
                "flex flex-col rounded-xl border bg-card overflow-hidden",
                isToday && "ring-2 ring-primary/30"
              )}
            >
              <div className={cn("p-2 text-center border-b bg-muted/40", isToday && "bg-primary/10")}>
                <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {WEEKDAY_LABELS[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                </div>
                <div className={cn("text-lg font-semibold", isToday && "text-primary")}>{format(day, "d")}</div>
              </div>
              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[320px]">
                {dayApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                    <span className="text-xs">No approvals</span>
                  </div>
                ) : (
                  dayApprovals.map((approval) => (
                    <ApprovalCalendarCard key={approval.id} approval={approval} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ApprovalCalendarCard({ approval }: { approval: Approval }) {
  const router = useRouter();
  const config = STATUS_CONFIG[approval.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const created = getApprovalDate(approval);
  const timeStr = format(created, "HH:mm");

  const firstPlatformId = approval.platforms?.[0];
  const content = firstPlatformId ? approval.platform_contents?.[firstPlatformId] : null;
  const textPreview = content?.text
    ? content.text.replace(/\*\*?/g, "").replace(/\n/g, " ").trim().slice(0, 80) + (content.text.length > 80 ? "…" : "")
    : "Content approval request";
  const hasImage = content?.imageUrl || approval.content_type === "image" || approval.content_type === "both";

  const openBlockUrl = approval.block_id
    ? `/workspace/${approval.block_id}?sub_block=${encodeURIComponent(approval.sub_block_id)}&approval=${encodeURIComponent(approval.id)}`
    : null;

  return (
    <div className="rounded-lg border bg-background p-2.5 shadow-sm transition-colors hover:bg-accent/50 hover:border-primary/30 flex flex-col">
      <Link href={`/approvals/${approval.id}`} className="flex flex-col flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1 mb-1.5">
          <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", config.bg, config.text)}>
            <StatusIcon className="h-3 w-3 shrink-0" />
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">{timeStr}</span>
        </div>
        <div className="flex items-center gap-1 mb-1.5">
          {approval.platforms?.slice(0, 4).map((platformId) => {
            const platform = PLATFORMS.find((p) => p.id === platformId);
            const Icon = platform?.icon;
            return Icon ? <Icon key={platformId} className="h-3.5 w-3.5 text-muted-foreground" /> : null;
          })}
        </div>
        <p className="text-xs text-foreground line-clamp-2 mb-1">{textPreview}</p>
        {hasImage && (
          <div className="text-[10px] text-muted-foreground mb-2">Image included</div>
        )}
      </Link>
      <div className="flex items-center justify-end gap-1 mt-auto pt-1 border-t border-border/50">
        {openBlockUrl && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              router.push(openBlockUrl);
            }}
          >
            <ExternalLink className="h-3 w-3 mr-0.5" />
            Workspace
          </Button>
        )}
        <Link
          href={`/approvals/${approval.id}`}
          className="inline-flex items-center text-xs text-primary hover:underline"
          aria-label="View approval"
        >
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
