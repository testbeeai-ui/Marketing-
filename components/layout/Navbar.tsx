"use client";

import { motion } from "framer-motion";
import {
  Sparkles, 
  Sun, 
  Moon, 
  LogOut, 
  UserCog, 
  BarChart3, 
  Presentation, 
  ChevronDown, 
  LayoutDashboard, 
  Twitter, 
  Linkedin, 
  Instagram, 
  Facebook,
  CheckCircle2,
  FileText,
  Settings,
  Bell,
  Search
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authService } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useDemoMode } from "@/lib/contexts/DemoModeContext";
import { OrganizationDropdown } from "@/components/organization/OrganizationDropdown";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useQuery } from "@tanstack/react-query";
import { approvalsApi } from "@/lib/api";

const ANALYTICS_OPTIONS = [
  { label: "Overall", href: "/storyteller", icon: LayoutDashboard },
  { label: "X (Twitter)", href: "/storyteller/x", icon: Twitter },
  { label: "LinkedIn", href: "/storyteller/linkedin", icon: Linkedin },
  { label: "Instagram", href: "/storyteller/instagram", icon: Instagram },
  { label: "Facebook", href: "/storyteller/facebook", icon: Facebook },
] as const;

const MAIN_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/storyteller", icon: BarChart3, hasDropdown: true },
  { label: "Approvals", href: "/approvals", icon: CheckCircle2 },
  { label: "Workspace", href: "/workspace", icon: FileText },
] as const;

export const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const { demoMode, toggleDemoMode } = useDemoMode();
  const { activeOrganization, isDemoMode } = useOrganization();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [notificationsCount, setNotificationsCount] = useState(3); // Mock notification count

  // Fetch pending approvals count
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ["approvals", activeOrganization?.id, "pending"],
    queryFn: async () => {
      if (!activeOrganization?.id) return { approvals: [] };
      try {
        const data = await approvalsApi.list(activeOrganization.id, { status: "pending" });
        return data;
      } catch (error) {
        console.error("Failed to fetch pending approvals:", error);
        return { approvals: [] };
      }
    },
    enabled: !!activeOrganization?.id,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const pendingApprovalsCount = pendingApprovalsData?.approvals?.length || 0;

  const isMember = activeOrganization?.role === "member";

  const generateLocalAvatar = (email: string | undefined): string => {
    if (!email) return '';
    
    const initial = email.charAt(0).toUpperCase();
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    const colorIndex = (email.charCodeAt(0) || 0) % colors.length;
    const bgColor = colors[colorIndex];
    
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="100" fill="${bgColor}"/>
        <text x="50" y="65" font-family="Arial, sans-serif" font-size="40" 
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${initial}
        </text>
      </svg>
    `)}`;
  };

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ email: session.user.email });
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({ email: session.user.email });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await authService.logout();
      toast.success("Logged out successfully");
      router.replace("/auth");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Failed to logout");
    }
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    if (href === "/storyteller") return pathname?.startsWith("/storyteller");
    if (href === "/approvals") return pathname?.startsWith("/approvals");
    if (href === "/workspace") return pathname?.startsWith("/workspace");
    return pathname === href;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="h-full max-w-[1920px] mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <motion.div
          className="flex items-center gap-3 cursor-pointer group"
          whileHover={{ scale: 1.02 }}
          onClick={() => router.push(isMember && !isDemoMode ? '/storyteller' : isDemoMode ? '/workspace' : '/dashboard')}
          role="button"
          aria-label={isMember && !isDemoMode ? "Go to Analytics" : isDemoMode ? "Go to Workspace" : "Go to Dashboard"}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-none">
              Story<span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">Teller</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Enterprise</span>
          </div>
        </motion.div>

        {/* Main Navigation */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center px-8">
          {MAIN_NAV_ITEMS.filter((item) => {
            if (isDemoMode) return item.label !== "Dashboard"; // Demo users never see Dashboard; Workspace is their main page
            if (isMember && !isDemoMode) {
              return item.label === "Analytics" || item.label === "Approvals";
            }
            return true;
          }).map((item) => {
            if ("hasDropdown" in item && item.hasDropdown && item.label === "Analytics") {
              return (
                <DropdownMenu key={item.href}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "h-10 px-4 gap-2 font-medium text-sm transition-all",
                        isActive(item.href)
                          ? "bg-primary/10 text-primary hover:bg-primary/15"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-56">
                    <DropdownMenuLabel>Platform Analytics</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {ANALYTICS_OPTIONS.map(({ label, href, icon: Icon }) => {
                      const isActiveOption = pathname === href || (href !== "/storyteller" && pathname.startsWith(href));
                      return (
                        <DropdownMenuItem
                          key={href}
                          onClick={() => router.push(href)}
                          className={cn(
                            "cursor-pointer",
                            isActiveOption && "bg-primary/10 text-primary"
                          )}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            }

            return (
              <Button
                key={item.href}
                variant="ghost"
                onClick={() => router.push(item.href)}
                className={cn(
                  "h-10 px-4 gap-2 font-medium text-sm transition-all relative",
                  isActive(item.href)
                    ? "bg-primary/10 text-primary hover:bg-primary/15"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
                {item.label === "Approvals" && pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-background">
                    {pendingApprovalsCount > 9 ? "9+" : pendingApprovalsCount}
                  </span>
                )}
              </Button>
            );
          })}
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          {/* Search (optional - can be expanded later) */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </Button>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-background" />
            )}
          </Button>

          {/* Demo Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDemoMode}
            className={cn(
              "w-10 h-10 rounded-lg transition-colors",
              demoMode 
                ? "bg-primary/15 text-primary hover:bg-primary/20" 
                : "hover:bg-muted/50"
            )}
            aria-label={demoMode ? "Demo mode on" : "Demo mode off"}
            title={demoMode ? "Demo mode: Showing sample data" : "Demo mode: Showing your data"}
          >
            <Presentation className="w-4 h-4" />
          </Button>

          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          )}

          {/* Organization Dropdown */}
          <div className="border-l border-border/50 h-6 mx-1" />
          <OrganizationDropdown />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Avatar className="w-9 h-9 border-2 border-border hover:border-primary transition-colors cursor-pointer ring-2 ring-transparent hover:ring-primary/20">
                  <AvatarImage 
                    src={
                      (avatarError || !user?.email
                        ? generateLocalAvatar(user?.email)
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=random`
                      ) || undefined
                    }
                    onError={() => setAvatarError(true)}
                  />
                  <AvatarFallback className="bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              {user?.email && (
                <>
                  <div className="px-2 py-2">
                    <p className="text-sm font-semibold text-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Enterprise Account</p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              {!isMember && !isDemoMode && (
                <DropdownMenuItem onClick={() => router.push('/dashboard')} className="cursor-pointer">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/storyteller')} className="cursor-pointer">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics Hub
              </DropdownMenuItem>
              {!isMember && (
                <DropdownMenuItem onClick={() => router.push('/style-profile')} className="cursor-pointer">
                  <UserCog className="w-4 h-4 mr-2" />
                  Style Profile
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => router.push('/approvals')} className="cursor-pointer">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approvals
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};
