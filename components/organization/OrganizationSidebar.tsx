"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  UserPlus,
  Crown,
  Building2,
  ChevronRight,
  Settings,
  Users,
} from "lucide-react";
import { CreateOrganizationModal } from "./CreateOrganizationModal";
import { JoinOrganizationModal } from "./JoinOrganizationModal";
import { CreateInvitationDialog } from "./CreateInvitationDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function OrganizationSidebar() {
  const router = useRouter();
  const {
    activeOrganization,
    organizations,
    setActiveOrganization,
    loading,
  } = useOrganization();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleSwitchOrg = (org: typeof organizations[0]) => {
    setActiveOrganization(org);
    toast.success(`Switched to ${org.name}`);
    // Refresh page data for new org
    router.refresh();
  };

  if (loading) {
    return (
      <div className="w-64 border-r bg-muted/30 h-screen fixed left-0 top-16 p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 border-r bg-muted/30 h-screen fixed left-0 top-16 overflow-y-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Organizations
            </h2>
            {activeOrganization && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => router.push(`/organizations/${activeOrganization.id}/settings`)}>
                    <Settings className="w-4 h-4 mr-2" />
                    Organization Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowInviteModal(true)}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/organizations/${activeOrganization.id}/members`)}>
                    <Users className="w-4 h-4 mr-2" />
                    View Members
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Organizations List */}
          <div className="space-y-1 mb-4">
            {organizations.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No organizations yet</p>
                <p className="text-xs mt-1">Create or join one to get started</p>
              </div>
            ) : (
              organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all group",
                    activeOrganization?.id === org.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {org.logo_url ? (
                    <img
                      src={org.logo_url}
                      alt={org.name}
                      className="w-7 h-7 rounded-md object-cover"
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0",
                        activeOrganization?.id === org.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"
                      )}
                    >
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="flex-1 text-left truncate font-medium">
                    {org.name}
                  </span>
                  {org.role === "owner" && (
                    <Crown className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  )}
                  {activeOrganization?.id === org.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Action Buttons - members cannot create organization */}
          <div className="space-y-2 border-t pt-4">
            {activeOrganization?.role !== "member" && (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4" />
                Create Organization
              </Button>
            )}

            <Button
              variant="ghost"
              className="w-full gap-2"
              onClick={() => setShowJoinModal(true)}
            >
              <UserPlus className="w-4 h-4" />
              Join with Code
            </Button>
          </div>

          {/* Active Org Info */}
          {activeOrganization && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-1">Active Organization</div>
              <div className="text-sm font-medium">{activeOrganization.name}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {activeOrganization.role}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateOrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <JoinOrganizationModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
      {activeOrganization && (
        <CreateInvitationDialog
          open={showInviteModal}
          onClose={() => setShowInviteModal(false)}
          organizationId={activeOrganization.id}
          organizationName={activeOrganization.name}
        />
      )}
    </>
  );
}
