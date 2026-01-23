"use client";

import { motion } from "framer-motion";
import { Sparkles, Sun, Moon, LogOut, UserCog } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

/**
 * ERR_ABORTED Error Explanation:
 * The ui-avatars.com API call fails with net::ERR_ABORTED because:
 * 1. CORS restrictions - External APIs may block cross-origin requests from localhost
 * 2. Rate limiting - The free service may limit requests from the same IP
 * 3. Network issues - Temporary connectivity problems or service downtime
 * 4. Ad blockers - Some browser extensions block external API calls
 * 5. Firewall restrictions - Corporate networks may block external services
 * 
 * The Avatar component automatically falls back to AvatarFallback when the image fails to load,
 * so the user experience is not broken, but we should provide a local alternative.
 */

export const Navbar = () => {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<{ email?: string } | null>(null);
  const [avatarError, setAvatarError] = useState(false);

  /**
   * Generate a local avatar SVG as a data URL
   * This provides a fallback when the external service fails
   */
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

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    // Get current user
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({ email: session.user.email });
      }
    });

    // Listen for auth changes
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

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 h-16 glass-panel border-t-0 border-x-0 rounded-none"
    >
      <div className="h-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        <motion.div
          className="flex items-center gap-3 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          onClick={() => router.push('/')}
          role="button"
          aria-label="Go to Dashboard"
        >
          <div className="w-9 h-9 rounded-lg gradient-violet flex items-center justify-center glow-violet">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-semibold tracking-tight">
            Story<span className="text-gradient-violet">Teller</span>
          </span>
        </motion.div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-10 h-10 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-foreground" />
              ) : (
                <Moon className="w-5 h-5 text-foreground" />
              )}
            </Button>
          )}

          {/* User Avatar with Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Avatar className="w-10 h-10 border-2 border-border hover:border-primary transition-colors cursor-pointer">
                  <AvatarImage 
                    src={avatarError || !user?.email 
                      ? generateLocalAvatar(user?.email) 
                      : `https://ui-avatars.com/api/?name=${user.email}&background=random`
                    } 
                    // Error handling: If the external service fails or is blocked, use local avatar
                    onError={(e) => {
                      console.warn('Avatar image failed to load from external service:', e);
                      console.warn('ERR_ABORTED causes: CORS, rate limiting, network issues, ad blockers, or firewall restrictions');
                      // Set error state to use local avatar on next render
                      setAvatarError(true);
                    }}
                  />
                  <AvatarFallback className="bg-secondary text-foreground">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user?.email && (
                <>
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    {user.email}
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => router.push('/style-profile')} className="cursor-pointer">
                <UserCog className="w-4 h-4 mr-2" />
                My Style Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.nav>
  );
};
