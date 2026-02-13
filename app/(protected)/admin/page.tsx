"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

interface AccessRequest {
  id: string;
  user_id: string;
  organization_id: string;
  status: string;
  message: string | null;
  details: Record<string, unknown> & { email?: string };
  requested_role: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export default function AdminAccessRequestsPage() {
  const router = useRouter();
  const { isAppAdmin, loading: orgLoading } = useOrganization();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (orgLoading) return;
    if (!isAppAdmin) {
      router.replace("/dashboard");
      return;
    }
  }, [isAppAdmin, orgLoading, router]);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/access-requests");
      if (res.status === 403 || res.status === 401) {
        router.replace("/dashboard");
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to load requests");
        return;
      }
      setRequests(data.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isAppAdmin || orgLoading) return;
    fetchRequests();
  }, [isAppAdmin, orgLoading, fetchRequests]);

  const handleApproveReject = async (id: string, status: "approved" | "rejected") => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || `Failed to ${status}`);
        return;
      }
      toast.success(status === "approved" ? "Access approved" : "Access rejected");
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleString();
    } catch {
      return s;
    }
  };

  const detailsHandles = (d: AccessRequest["details"]) => {
    if (!d || typeof d !== "object") return null;
    const parts: string[] = [];
    if (d.linkedin) parts.push(`LinkedIn: ${String(d.linkedin)}`);
    if (d.twitter) parts.push(`Twitter: ${String(d.twitter)}`);
    if (d.instagram) parts.push(`Instagram: ${String(d.instagram)}`);
    if (d.facebook) parts.push(`Facebook: ${String(d.facebook)}`);
    if (d.company_name) parts.push(`Company: ${String(d.company_name)}`);
    return parts.length ? parts.join(" · ") : null;
  };

  if (orgLoading || (!isAppAdmin && !loading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAppAdmin) {
    return null;
  }

  return (
    <div className="container max-w-5xl py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Access requests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review and approve or reject requests from users who want access to upload and modify content.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          <p className="font-medium">No access requests yet</p>
          <p className="text-sm mt-1">When users submit the request form, they will appear here.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Details / Handles</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {(req.details?.email as string) || req.user_id.slice(0, 8) + "…"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                    {formatDate(req.created_at)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate" title={detailsHandles(req.details) ?? undefined}>
                    {detailsHandles(req.details) || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs max-w-[180px] truncate" title={req.message ?? undefined}>
                    {req.message || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={req.status === "approved" ? "default" : req.status === "rejected" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {req.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {req.status === "pending" ? (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-600/50 hover:bg-green-50 dark:hover:bg-green-950/30"
                          onClick={() => handleApproveReject(req.id, "approved")}
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-600/50 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => handleApproveReject(req.id, "rejected")}
                          disabled={updatingId === req.id}
                        >
                          {updatingId === req.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {req.reviewed_at ? formatDate(req.reviewed_at) : "—"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
