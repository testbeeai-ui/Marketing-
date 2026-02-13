"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useQueryClient } from "@tanstack/react-query";
import { PUBLIC_DEMO_ORGANIZATION_ID } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  ChevronDown,
  Crown,
  Users,
  Plus,
  UserPlus,
  Check,
  Calendar,
  ArrowRight,
  ExternalLink,
  Link2,
} from "lucide-react";
import { CreateOrganizationModal } from "./CreateOrganizationModal";
import { JoinOrganizationModal } from "./JoinOrganizationModal";
import { DemoRestrictionDialog } from "@/components/DemoRestrictionDialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function OrganizationDropdown() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const {
    activeOrganization,
    organizations,
    setActiveOrganization,
    refreshOrganizations,
    loading,
    isDemoMode,
  } = useOrganization();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showMarketingForm, setShowMarketingForm] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const pathname = usePathname();

  // Close dropdown when we land on the organization page so it never blocks clicks
  useEffect(() => {
    if (pathname?.startsWith("/organizations/")) {
      setDropdownOpen(false);
    }
  }, [pathname]);

  const handleSwitchOrg = async (org: typeof organizations[0]) => {
    // Immediately update the active organization
    setActiveOrganization(org);
    
    // Invalidate all queries to force immediate data refresh
    await queryClient.invalidateQueries();
    
    toast.success(`Switched to ${org.name}`);
    
    // Refresh the page to update all data
    router.refresh();
  };

  const handleOpenOrg = (org: typeof organizations[0]) => {
    setDropdownOpen(false);
    // Defer navigation so the dropdown portal unmounts first; otherwise the dropdown
    // can block clicks on the new page until a hard refresh.
    setTimeout(() => {
      router.push(`/organizations/${org.id}`);
    }, 250);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: { label: "Owner", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
      admin: { label: "Admin", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
      member: { label: "Member", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
    };
    return badges[role as keyof typeof badges] || badges.member;
  };

  if (loading) {
    return (
      <Button variant="ghost" className="h-10 px-3 gap-2" disabled>
        <Building2 className="w-4 h-4 animate-pulse" />
        <span className="hidden lg:inline">Loading...</span>
      </Button>
    );
  }

  if (organizations.length === 0) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 px-3 gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden lg:inline">Organizations</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Organizations</DropdownMenuLabel>
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No organizations yet</p>
              <p className="text-xs mt-1">Create or join one to get started</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onSelect={() => {
                // Use setTimeout to open modal after dropdown closes
                setTimeout(() => {
                  setShowCreateModal(true);
                }, 150);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </DropdownMenuItem>
            <DropdownMenuItem 
              onSelect={() => {
                // Use setTimeout to open modal after dropdown closes
                setTimeout(() => {
                  setShowJoinModal(true);
                }, 150);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Join with Code
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Modals */}
        <CreateOrganizationModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        />
        <JoinOrganizationModal
          open={showJoinModal}
          onClose={() => setShowJoinModal(false)}
        />
      </>
    );
  }

  const activeOrg = activeOrganization || organizations[0];

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={cn(
              "h-10 px-3 gap-2 font-medium text-sm transition-all",
              "hover:bg-muted/50"
            )}
          >
            {activeOrg.logo_url ? (
              <img
                src={activeOrg.logo_url}
                alt={activeOrg.name}
                className="w-5 h-5 rounded"
              />
            ) : (
              <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {activeOrg.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="hidden lg:inline max-w-[120px] truncate">
              {activeOrg.name}
            </span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80" onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Organizations</span>
            <span className="text-xs font-normal text-muted-foreground">
              {organizations.length} {organizations.length === 1 ? "org" : "orgs"}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Organizations List */}
          <div className="max-h-[400px] overflow-y-auto">
            {organizations.map((org) => {
              const isActive = activeOrg?.id === org.id;
              const roleBadge = getRoleBadge(org.role);

              return (
                <ContextMenu key={org.id}>
                  <ContextMenuTrigger asChild>
                    <DropdownMenuItem
                      onSelect={async (e) => {
                        e.preventDefault();
                        // Only switch if it's not already active
                        if (!isActive) {
                          await handleSwitchOrg(org);
                        }
                      }}
                      className={cn(
                        "flex flex-col items-start gap-1.5 p-3 cursor-pointer transition-colors",
                        isActive && "bg-primary/10"
                      )}
                    >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {org.logo_url ? (
                        <img
                          src={org.logo_url}
                          alt={org.name}
                          className="w-6 h-6 rounded shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium truncate">{org.name}</span>
                      {(org.role === "owner" || org.role === "admin") && (
                        <Crown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      )}
                    </div>
                    {isActive && (
                      <Check className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>{org.member_count || 0} members</span>
                    </div>
                    <span>•</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", roleBadge.className)}>
                      {roleBadge.label}
                    </span>
                  </div>

                  {org.created_at && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      <span>Created {formatDate(org.created_at)}</span>
                    </div>
                  )}

                  {org.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {org.description}
                    </p>
                  )}
                    </DropdownMenuItem>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDropdownOpen(false);
                        if (!isActive) {
                          await handleSwitchOrg(org);
                        }
                      }}
                      disabled={isActive}
                    >
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Switch to {org.name}
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownOpen(false);
                        handleOpenOrg(org);
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Organization
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>

          <DropdownMenuSeparator />

          {/* Submit form for marketing access (when viewing as read-only) */}
          {isDemoMode && activeOrg?.id === PUBLIC_DEMO_ORGANIZATION_ID && (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setDropdownOpen(false);
                setTimeout(() => setShowMarketingForm(true), 150);
              }}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Submit form for marketing access
            </DropdownMenuItem>
          )}

          {/* Actions - members cannot create organization */}
          {activeOrg?.role !== "member" && (
            <DropdownMenuItem 
              onSelect={() => {
                setTimeout(() => setShowCreateModal(true), 150);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Organization
            </DropdownMenuItem>
          )}
          <DropdownMenuItem 
            onSelect={() => {
              setTimeout(() => setShowJoinModal(true), 150);
            }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Join with Code
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Modals */}
      <CreateOrganizationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      <JoinOrganizationModal
        open={showJoinModal}
        onClose={() => setShowJoinModal(false)}
      />
      <DemoRestrictionDialog
        open={showMarketingForm}
        onOpenChange={setShowMarketingForm}
        title="Submit form for marketing access"
        description="You're viewing in read-only mode. Submit your details to request marketing access. We'll review and get you set up."
      />
    </>
  );
}
