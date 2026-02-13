"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Mail,
  UserPlus,
  Crown,
  Shield,
  User,
  Trash2,
  Edit,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface OrganizationDetails {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  member_count: number;
  user_role: "owner" | "admin" | "member";
}

interface Member {
  user_id: string;
  email: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
}

interface Invitation {
  id: string;
  email: string;
  invitation_code: string;
  role: "admin" | "member";
  status: "pending" | "accepted" | "expired" | "revoked";
  created_at: string;
  expires_at: string | null;
  uses_count: number;
  max_uses: number;
  invite_url: string;
}

interface OrganizationManagementProps {
  organizationId: string;
}

export default function OrganizationManagement({ organizationId }: OrganizationManagementProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { organizations } = useOrganization();
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [showInvitationSuccess, setShowInvitationSuccess] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<{ code: string; url: string; email: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, []);

  // Fetch organization details
  const { data: orgDetails, isLoading: orgLoading, error: orgError } = useQuery({
    queryKey: ["organization", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch organization (${res.status})`);
      }
      const data = await res.json();
      // Ensure user_role is included in organization object
      const orgData = {
        ...data.organization,
        user_role: data.organization?.user_role || data.user_role || "member",
      };
      return orgData as OrganizationDetails;
    },
    retry: 1,
  });

  // Fetch members (all members can view, but API only returns for owners/admins)
  const { data: membersData, isLoading: membersLoading, error: membersError } = useQuery({
    queryKey: ["organization-members", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          // User is a member, not admin/owner - return empty array
          return [] as Member[];
        }
        throw new Error(errorData.error || "Failed to fetch members");
      }
      const data = await res.json();
      return (data.members || []) as Member[];
    },
    enabled: !!orgDetails,
    retry: false,
  });

  // Fetch invitations - only owners/admins; skip for members to avoid 403
  const { data: invitationsData, isLoading: invitationsLoading, error: invitationsError } = useQuery({
    queryKey: ["organization-invitations", organizationId],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/invitations`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch invitations");
      }
      const data = await res.json();
      return (data.invitations || []) as Invitation[];
    },
    enabled: !!orgDetails && (orgDetails.user_role === "owner" || orgDetails.user_role === "admin"),
    retry: false,
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "member" }) => {
      const res = await fetch(`/api/organizations/${organizationId}/invitations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send invitation");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setCreatedInvitation({
        code: data.invitation_code,
        url: data.invite_url,
        email: inviteEmail,
      });
      setShowInvitationSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
      
      if (data.email_sent) {
        toast.success(`Invitation email sent to ${inviteEmail}`);
      } else {
        toast.warning(`Invitation created but email not sent. ${data.email_error || "Email service not configured."} You can manually share the invitation link.`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  // Resend invitation email mutation
  const resendEmailMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to resend email");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.email_sent) {
        toast.success("Invitation email resent successfully");
      } else {
        toast.warning(`Email not sent. ${data.email_error || "Email service not configured."}`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resend email");
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to remove member");
      }
    },
    onSuccess: () => {
      toast.success("Member removed successfully");
      setShowDeleteDialog(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization", organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove member");
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "owner" | "admin" | "member" }) => {
      const res = await fetch(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update role");
      }
    },
    onSuccess: () => {
      toast.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["organization-members", organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update role");
    },
  });

  // Revoke invitation mutation
  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      const res = await fetch(`/api/organizations/${organizationId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to revoke invitation");
      }
    },
    onSuccess: () => {
      toast.success("Invitation revoked successfully");
      queryClient.invalidateQueries({ queryKey: ["organization-invitations", organizationId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to revoke invitation");
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast.error("Please enter an email address");
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success("Invitation code copied to clipboard");
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error("Failed to copy code");
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      toast.success("Invitation link copied to clipboard");
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      toast.error("Failed to copy link");
    }
  };

  const handleRevokeInvitation = (invitationId: string) => {
    if (confirm("Are you sure you want to revoke this invitation?")) {
      revokeInvitationMutation.mutate(invitationId);
    }
  };

  const getInvitationStatusBadge = (status: string) => {
    const badges = {
      pending: { label: "Pending", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      accepted: { label: "Accepted", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
      expired: { label: "Expired", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
      revoked: { label: "Revoked", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    };
    return badges[status as keyof typeof badges] || badges.pending;
  };

  const isInvitationExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleDeleteMember = () => {
    if (selectedMember) {
      deleteMemberMutation.mutate(selectedMember.user_id);
    }
  };

  const handleRoleChange = (member: Member, newRole: "owner" | "admin" | "member") => {
    if (member.role === newRole) return;
    updateRoleMutation.mutate({ userId: member.user_id, role: newRole });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-purple-600" />;
      case "admin":
        return <Shield className="w-4 h-4 text-blue-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: { label: "Owner", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
      admin: { label: "Admin", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      member: { label: "Member", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    };
    return badges[role as keyof typeof badges] || badges.member;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get user role - check both organization object and response root level for backward compatibility
  const userRole = orgDetails?.user_role || (orgDetails as any)?.role;
  const canManageMembers = orgDetails && (userRole === "owner" || userRole === "admin");
  const isOwner = userRole === "owner";
  
  // Debug logging
  useEffect(() => {
    if (orgDetails) {
      console.log("Organization Details:", {
        name: orgDetails.name,
        role: userRole,
        user_role_from_org: orgDetails.user_role,
        member_count: orgDetails.member_count,
        canManageMembers,
        isOwner,
      });
    }
  }, [orgDetails, userRole, canManageMembers, isOwner]);

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-background pt-12 pb-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (!orgLoading && (!orgDetails || orgError)) {
    return (
      <div className="min-h-screen bg-background pt-12 pb-16 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <p className="text-lg font-semibold text-foreground">
                  {orgError ? "Error loading organization" : "Organization not found"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {orgError?.message || "The organization you're looking for doesn't exist or you don't have access to it."}
                </p>
                <Button onClick={() => router.back()} variant="outline">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!orgDetails) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pt-12 pb-16 px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{orgDetails.name}</h1>
              <p className="text-muted-foreground mt-1">
                {canManageMembers 
                  ? "Manage members, roles, and invitations"
                  : "View organization details"}
              </p>
            </div>
          </div>
          {canManageMembers && (
            <div className="flex items-center gap-3">
              {invitationsData && invitationsData.length > 0 && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">
                    {invitationsData.filter((inv) => inv.status === "pending").length} pending invitation{invitationsData.filter((inv) => inv.status === "pending").length !== 1 ? "s" : ""}
                  </p>
                </div>
              )}
              <Button
                onClick={() => {
                  setShowInviteDialog(true);
                  setShowInvitationSuccess(false);
                  setCreatedInvitation(null);
                }}
                className="gradient-violet hover:opacity-90 text-white border-0 shadow-lg"
                size="lg"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Add Members
                {invitationsData && invitationsData.filter((inv) => inv.status === "pending").length > 0 && (
                  <Badge className="ml-2 bg-white/20 text-white border-0">
                    {invitationsData.filter((inv) => inv.status === "pending").length}
                  </Badge>
                )}
              </Button>
            </div>
          )}
        </motion.div>

        {/* Organization Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {orgDetails.logo_url ? (
                    <img
                      src={orgDetails.logo_url}
                      alt={orgDetails.name}
                      className="w-12 h-12 rounded-lg"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xl font-bold">
                      {orgDetails.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <CardTitle>{orgDetails.name}</CardTitle>
                    <CardDescription>
                      Created {formatDate(orgDetails.created_at)}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={cn("px-3 py-1", getRoleBadge(userRole || "member").className)}>
                  {getRoleIcon(userRole || "member")}
                  <span className="ml-2">{getRoleBadge(userRole || "member").label}</span>
                </Badge>
              </div>
            </CardHeader>
            {orgDetails.description && (
              <CardContent>
                <p className="text-sm text-muted-foreground">{orgDetails.description}</p>
              </CardContent>
            )}
          </Card>
        </motion.div>

        {/* Members Table - Always show if orgDetails exists */}
        {orgDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Members ({membersData?.length || orgDetails.member_count || 0})
                    </CardTitle>
                    <CardDescription>
                      {canManageMembers 
                        ? "Manage team members and their roles"
                        : "View team members"}
                    </CardDescription>
                  </div>
                  {canManageMembers && (
                    <Button
                      onClick={() => {
                        setShowInviteDialog(true);
                        setShowInvitationSuccess(false);
                        setCreatedInvitation(null);
                      }}
                      className="gradient-violet hover:opacity-90 text-white border-0"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Members
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {membersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : membersError ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-2">
                      {membersError.message || "Failed to load members"}
                    </p>
                    {!canManageMembers && (
                      <p className="text-xs text-muted-foreground">
                        Only owners and admins can view the member list
                      </p>
                    )}
                  </div>
                ) : !membersData || membersData.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">
                      {canManageMembers ? "No members yet" : "Member list not available"}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {canManageMembers 
                        ? "Start building your team by inviting members to this organization"
                        : "Only owners and admins can view the member list. Contact your organization admin for member information."}
                    </p>
                    {canManageMembers && (
                      <Button
                        onClick={() => {
                          setShowInviteDialog(true);
                          setShowInvitationSuccess(false);
                          setCreatedInvitation(null);
                        }}
                        className="gradient-violet hover:opacity-90 text-white border-0"
                        size="lg"
                      >
                        <UserPlus className="w-5 h-5 mr-2" />
                        Add Your First Member
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {membersData.map((member) => {
                        const roleBadge = getRoleBadge(member.role);
                        const isCurrentUser = member.user_id === currentUserId;
                        const canEdit = isOwner && member.role !== "owner" && !isCurrentUser;
                        const canDelete = isOwner && member.role !== "owner" && !isCurrentUser;

                        return (
                          <TableRow key={member.user_id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold">
                                  {member.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-medium">{member.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={member.role}
                                onValueChange={(value) =>
                                  handleRoleChange(member, value as "owner" | "admin" | "member")
                                }
                                disabled={!canEdit || updateRoleMutation.isPending}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue>
                                    <div className="flex items-center gap-2">
                                      {getRoleIcon(member.role)}
                                      <span>{roleBadge.label}</span>
                                    </div>
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {isOwner && (
                                    <SelectItem value="owner">
                                      <div className="flex items-center gap-2">
                                        <Crown className="w-4 h-4" />
                                        <span>Owner</span>
                                      </div>
                                    </SelectItem>
                                  )}
                                  <SelectItem value="admin">
                                    <div className="flex items-center gap-2">
                                      <Shield className="w-4 h-4" />
                                      <span>Admin</span>
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="member">
                                    <div className="flex items-center gap-2">
                                      <User className="w-4 h-4" />
                                      <span>Member</span>
                                    </div>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(member.joined_at)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setSelectedMember(member);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Invitations Section - Always show if orgDetails exists */}
        {orgDetails && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Invitations ({invitationsData?.length || 0})
                    </CardTitle>
                    <CardDescription>
                      {canManageMembers
                        ? "Track and manage invitation codes sent to team members"
                        : "View invitation codes sent to team members"}
                    </CardDescription>
                  </div>
                  {canManageMembers && (
                    <Button
                      onClick={() => {
                        setShowInviteDialog(true);
                        setShowInvitationSuccess(false);
                        setCreatedInvitation(null);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      New Invitation
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {invitationsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : invitationsError ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground mb-2">
                      {invitationsError.message || "Failed to load invitations"}
                    </p>
                    {!canManageMembers && (
                      <p className="text-xs text-muted-foreground">
                        Only owners and admins can view invitations
                      </p>
                    )}
                  </div>
                ) : !invitationsData || invitationsData.length === 0 ? (
                  <div className="text-center py-12">
                    <Mail className="w-16 h-16 mx-auto mb-4 opacity-50 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No invitations yet</h3>
                    <p className="text-sm text-muted-foreground mb-6">
                      {canManageMembers
                        ? "Send your first invitation to add members to this organization"
                        : "No invitations have been sent yet. Only owners and admins can view invitations."}
                    </p>
                    {canManageMembers && (
                      <Button
                        onClick={() => {
                          setShowInviteDialog(true);
                          setShowInvitationSuccess(false);
                          setCreatedInvitation(null);
                        }}
                        className="gradient-violet hover:opacity-90 text-white border-0"
                      >
                        <UserPlus className="w-5 h-5 mr-2" />
                        Create First Invitation
                      </Button>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Invitation Code</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invitationsData.map((invitation) => {
                        const statusBadge = getInvitationStatusBadge(invitation.status);
                        const expired = isInvitationExpired(invitation.expires_at);
                        const isPending = invitation.status === "pending" && !expired;

                        return (
                          <TableRow key={invitation.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">{invitation.email || "No email"}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                                  {invitation.invitation_code}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleCopyCode(invitation.invitation_code)}
                                >
                                  {copiedCode === invitation.invitation_code ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("px-2 py-0.5", getRoleBadge(invitation.role).className)}>
                                {invitation.role === "admin" ? (
                                  <Shield className="w-3 h-3 mr-1" />
                                ) : (
                                  <User className="w-3 h-3 mr-1" />
                                )}
                                {invitation.role === "admin" ? "Admin" : "Member"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("px-2 py-0.5", statusBadge.className)}>
                                {expired && invitation.status === "pending" ? (
                                  <>
                                    <Clock className="w-3 h-3 mr-1" />
                                    Expired
                                  </>
                                ) : invitation.status === "pending" ? (
                                  <>
                                    <Clock className="w-3 h-3 mr-1" />
                                    {statusBadge.label}
                                  </>
                                ) : invitation.status === "accepted" ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {statusBadge.label}
                                  </>
                                ) : (
                                  statusBadge.label
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(invitation.created_at)}
                              </span>
                            </TableCell>
                            <TableCell>
                              {invitation.expires_at ? (
                                <span className={cn(
                                  "text-sm",
                                  expired ? "text-red-600" : "text-muted-foreground"
                                )}>
                                  {formatDate(invitation.expires_at)}
                                </span>
                              ) : (
                                <span className="text-sm text-muted-foreground">Never</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {invitation.email && isPending && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => resendEmailMutation.mutate(invitation.id)}
                                    title="Resend invitation email"
                                    disabled={resendEmailMutation.isPending}
                                  >
                                    {resendEmailMutation.isPending ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Mail className="w-4 h-4" />
                                    )}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleCopyUrl(invitation.invite_url)}
                                  title="Copy invitation link"
                                >
                                  {copiedUrl === invitation.invite_url ? (
                                    <Check className="w-4 h-4 text-green-600" />
                                  ) : (
                                    <ExternalLink className="w-4 h-4" />
                                  )}
                                </Button>
                                {isPending && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRevokeInvitation(invitation.id)}
                                    disabled={revokeInvitationMutation.isPending}
                                    title="Revoke invitation"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Invite Dialog */}
        <Dialog 
          open={showInviteDialog} 
          onOpenChange={(open) => {
            setShowInviteDialog(open);
            if (!open) {
              setShowInvitationSuccess(false);
              setCreatedInvitation(null);
              setInviteEmail("");
              setInviteRole("member");
            }
          }}
        >
          <DialogContent className="sm:max-w-[550px]">
            {!showInvitationSuccess ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-primary" />
                    Add Member to {orgDetails.name}
                  </DialogTitle>
                  <DialogDescription>
                    Enter the email address of the person you want to invite. They'll receive an invitation email with a signup link.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      disabled={inviteMutation.isPending}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && inviteEmail.trim() && !inviteMutation.isPending) {
                          handleInvite();
                        }
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as "admin" | "member")}
                      disabled={inviteMutation.isPending}
                    >
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>Admin</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="member">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span>Member</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Admins can manage members and invitations. Members can view and collaborate.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowInviteDialog(false)}
                    disabled={inviteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={inviteMutation.isPending || !inviteEmail.trim()}
                    className="gradient-violet hover:opacity-90 text-white border-0"
                  >
                    {inviteMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    Invitation Sent Successfully!
                  </DialogTitle>
                  <DialogDescription>
                    Invitation has been sent to <strong>{createdInvitation?.email}</strong>. Share the code or link below with them.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted rounded-lg space-y-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Invitation Code</Label>
                      <div className="flex gap-2">
                        <Input
                          value={createdInvitation?.code || ""}
                          readOnly
                          className="font-mono text-sm bg-background"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => createdInvitation && handleCopyCode(createdInvitation.code)}
                          className="shrink-0"
                        >
                          {copiedCode === createdInvitation?.code ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Invitation Link</Label>
                      <div className="flex gap-2">
                        <Input
                          value={createdInvitation?.url || ""}
                          readOnly
                          className="text-xs bg-background"
                        />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => createdInvitation && handleCopyUrl(createdInvitation.url)}
                          className="shrink-0"
                        >
                          {copiedUrl === createdInvitation?.url ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowInvitationSuccess(false);
                      setCreatedInvitation(null);
                      setInviteEmail("");
                      setInviteRole("member");
                    }}
                  >
                    Send Another
                  </Button>
                  <Button
                    onClick={() => {
                      setShowInviteDialog(false);
                      setShowInvitationSuccess(false);
                      setCreatedInvitation(null);
                      setInviteEmail("");
                      setInviteRole("member");
                    }}
                    className="gradient-violet hover:opacity-90 text-white border-0"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Member</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {selectedMember?.email} from this organization?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleteMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteMember}
                disabled={deleteMemberMutation.isPending}
              >
                {deleteMemberMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove Member
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
