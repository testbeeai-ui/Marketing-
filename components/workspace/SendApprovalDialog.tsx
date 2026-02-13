"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Linkedin, Twitter, Instagram, Facebook, Users, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { approvalsApi, type ApprovalRequest } from "@/lib/api";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

interface SendApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  subBlockId: string;
  storyId?: string;
  platformContents: Record<string, { text?: string; imageUrl?: string; imagePrompt?: string }>;
}

const platforms = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin },
  { id: "twitter", name: "Twitter/X", icon: Twitter },
  { id: "instagram", name: "Instagram", icon: Instagram },
  { id: "facebook", name: "Facebook", icon: Facebook },
];

export function SendApprovalDialog({
  open,
  onClose,
  subBlockId,
  storyId,
  platformContents,
}: SendApprovalDialogProps) {
  const { activeOrganization } = useOrganization();
  const queryClient = useQueryClient();
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [contentType, setContentType] = useState<"text" | "image" | "both">("both");
  const [assignTo, setAssignTo] = useState<"all_members" | string>("all_members");
  const [members, setMembers] = useState<Array<{ user_id: string; email: string; role: string }>>([]);

  // Fetch organization members
  useEffect(() => {
    if (!activeOrganization?.id || !open) return;

    const fetchMembers = async () => {
      try {
        const res = await fetch(`/api/organizations/${activeOrganization.id}`);
        if (res.ok) {
          const data = await res.json();
          // Filter to only members (not admins/owners)
          const memberList = (data.members || []).filter(
            (m: any) => m.role === "member"
          );
          setMembers(memberList);
        }
      } catch (error) {
        console.error("Failed to fetch members:", error);
      }
    };

    fetchMembers();
  }, [activeOrganization?.id, open]);

  // Initialize selected platforms with platforms that have content
  useEffect(() => {
    if (open) {
      const availablePlatforms = platforms.filter(
        (p) => platformContents[p.id] && (
          platformContents[p.id].text || platformContents[p.id].imageUrl
        )
      );
      setSelectedPlatforms(availablePlatforms.map((p) => p.id));
    }
  }, [open, platformContents]);

  const togglePlatform = (platformId: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platformId)
        ? prev.filter((id) => id !== platformId)
        : [...prev, platformId]
    );
  };

  const createApprovalMutation = useMutation({
    mutationFn: async (data: ApprovalRequest) => {
      if (!activeOrganization?.id) {
        throw new Error("No active organization");
      }
      return approvalsApi.create(activeOrganization.id, data);
    },
    onSuccess: (data) => {
      toast.success(
        `Approval sent to ${data.count} ${data.count === 1 ? "member" : "members"}`
      );
      queryClient.invalidateQueries({ queryKey: ["approvals", activeOrganization?.id] });
      queryClient.invalidateQueries({ queryKey: ["approvals", activeOrganization?.id, subBlockId] });
      onClose();
      // Reset form
      setSelectedPlatforms([]);
      setContentType("both");
      setAssignTo("all_members");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send approval");
    },
  });

  const handleSubmit = () => {
    if (selectedPlatforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    // Build platform_contents object with only selected platforms
    const filteredPlatformContents: Record<string, any> = {};
    selectedPlatforms.forEach((platformId) => {
      const content = platformContents[platformId];
      if (content) {
        filteredPlatformContents[platformId] = {};
        if (contentType === "text" || contentType === "both") {
          filteredPlatformContents[platformId].text = content.text || "";
        }
        if (contentType === "image" || contentType === "both") {
          if (content.imageUrl) {
            filteredPlatformContents[platformId].imageUrl = content.imageUrl;
          }
          if (content.imagePrompt) {
            filteredPlatformContents[platformId].imagePrompt = content.imagePrompt;
          }
        }
      }
    });

    const approvalData: ApprovalRequest = {
      sub_block_id: subBlockId,
      story_id: storyId,
      platform_contents: filteredPlatformContents,
      content_type: contentType,
      platforms: selectedPlatforms,
      assigned_to: assignTo,
    };

    createApprovalMutation.mutate(approvalData);
  };

  const hasContentForPlatform = (platformId: string) => {
    const content = platformContents[platformId];
    return !!(content?.text || content?.imageUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send for Approval</DialogTitle>
          <DialogDescription>
            Select platforms and members to send content for approval
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Platform Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Select Platforms</Label>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                const hasContent = hasContentForPlatform(platform.id);
                const isSelected = selectedPlatforms.includes(platform.id);

                return (
                  <div
                    key={platform.id}
                    className={cn(
                      "flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected
                        ? "bg-primary/10 border-primary"
                        : "bg-secondary/50 border-border hover:bg-secondary",
                      !hasContent && "opacity-50 cursor-not-allowed"
                    )}
                    onClick={() => hasContent && togglePlatform(platform.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => hasContent && togglePlatform(platform.id)}
                      disabled={!hasContent}
                    />
                    <Icon className="w-5 h-5" />
                    <span className="flex-1 font-medium">{platform.name}</span>
                    {!hasContent && (
                      <span className="text-xs text-muted-foreground">No content</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Content Type Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Content Type</Label>
            <div className="flex gap-3">
              {(["text", "image", "both"] as const).map((type) => (
                <Button
                  key={type}
                  variant={contentType === type ? "default" : "outline"}
                  onClick={() => setContentType(type)}
                  className="flex-1 capitalize"
                >
                  {type === "both" ? "Text & Image" : type}
                </Button>
              ))}
            </div>
          </div>

          {/* Assign To Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Assign To</Label>
            <Select value={assignTo} onValueChange={(value) => setAssignTo(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_members">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>All Members ({members.length})</span>
                  </div>
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {members.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No members found in this organization
              </p>
            )}
          </div>

          {/* Preview */}
          {selectedPlatforms.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Preview</Label>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">Platforms:</span>
                  <div className="flex gap-1">
                    {selectedPlatforms.map((platformId) => {
                      const platform = platforms.find((p) => p.id === platformId);
                      const Icon = platform?.icon;
                      return Icon ? (
                        <Icon key={platformId} className="w-4 h-4" />
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Content:</span>{" "}
                  <span className="capitalize">{contentType}</span>
                </div>
                <div className="text-sm">
                  <span className="font-medium">Assigned to:</span>{" "}
                  {assignTo === "all_members"
                    ? `All Members (${members.length})`
                    : members.find((m) => m.user_id === assignTo)?.email || "Unknown"}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={createApprovalMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              selectedPlatforms.length === 0 ||
              createApprovalMutation.isPending ||
              members.length === 0
            }
          >
            {createApprovalMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Send Approval
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
