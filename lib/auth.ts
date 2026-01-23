import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface AuthUser {
  id: string; // Supabase user ID (UUID)
  email?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  onboardingCompleted: boolean;
}

class AuthService {
  private currentUser: AuthUser | null = null;

  constructor() {
    // Initialize user from Supabase session if available
    if (typeof window !== 'undefined') {
      this.initializeFromSession();
    }
  }

  private async initializeFromSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await this.syncUser(session.user);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    }
  }

  private async syncUser(supabaseUser: User): Promise<void> {
    try {
      // Get user profile from backend (which uses Supabase user_id)
      const userId = parseInt(supabaseUser.id.replace(/-/g, '').substring(0, 15), 16) % 2147483647; // Convert UUID to number (simple hash)
      
      // Try to get profile from backend
      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.currentUser = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          username: data.user?.username,
          firstName: data.user?.first_name,
          lastName: data.user?.last_name,
          onboardingCompleted: data.user?.onboarding_completed || false,
        };
      } else {
        // Fallback if backend call fails
        this.currentUser = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          onboardingCompleted: false,
        };
      }
    } catch (error) {
      console.error('Error syncing user:', error);
      // Fallback to basic user info
      this.currentUser = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        onboardingCompleted: false,
      };
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Get Supabase user ID (UUID)
   */
  getUserId(): string | null {
    return this.currentUser?.id || null;
  }

  /**
   * Get user ID as number for backend compatibility
   */
  getUserIdAsNumber(): number | null {
    if (!this.currentUser?.id) return null;
    // Convert UUID to number for backend compatibility
    const numericId = parseInt(this.currentUser.id.replace(/-/g, '').substring(0, 15), 16) % 2147483647;
    return numericId;
  }

  /**
   * Get session access token
   */
  async getSessionToken(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Error getting session token:', error);
      return null;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (!this.currentUser) {
          await this.syncUser(session.user);
        }
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
      this.currentUser = null;
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  /**
   * Refresh user profile
   */
  async refreshProfile(): Promise<AuthUser | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        this.currentUser = null;
        return null;
      }

      await this.syncUser(session.user);
      return this.currentUser;
    } catch (error) {
      console.error('Error refreshing profile:', error);
      return null;
    }
  }
}

export const authService = new AuthService();
