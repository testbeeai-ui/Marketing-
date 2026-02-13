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

const SESSION_CACHE_BUFFER_MS = 60 * 1000; // Consider expired 1 min before actual expiry to avoid 401s
class AuthService {
  private currentUser: AuthUser | null = null;
  /** In-memory cache to avoid hitting Supabase Auth on every getSessionToken() (reduces 429 rate limits). */
  private sessionCache: { token: string; expiresAt: number } | null = null;
  /** Shared in-flight getSession so concurrent callers don't each hit the API (prevents 429). */
  private getSessionPromise: Promise<string | null> | null = null;

  constructor() {
    // Initialize user from Supabase session if available
    if (typeof window !== 'undefined') {
      this.initializeFromSession();
    }
  }

  private clearSessionCache(): void {
    this.sessionCache = null;
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
      const token = this.sessionCache?.token ?? (await this.getSessionToken());
      // Try to get profile from backend
      const response = await fetch('/api/auth/me', {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
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
   * Get session access token. Uses in-memory cache and throttling so concurrent
   * callers share one Supabase getSession() call (prevents 429 rate limits).
   */
  async getSessionToken(): Promise<string | null> {
    const now = Date.now();
    if (this.sessionCache && this.sessionCache.expiresAt > now + SESSION_CACHE_BUFFER_MS) {
      return this.sessionCache.token;
    }
    if (this.getSessionPromise) {
      return this.getSessionPromise;
    }
    this.getSessionPromise = this.fetchSession();
    try {
      const token = await this.getSessionPromise;
      return token;
    } finally {
      this.getSessionPromise = null;
    }
  }

  private async fetchSession(): Promise<string | null> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || null;
      if (token && session?.expires_at) {
        this.sessionCache = { token, expiresAt: session.expires_at * 1000 };
      } else {
        this.clearSessionCache();
      }
      return token;
    } catch (error) {
      console.error('Error getting session token:', error);
      this.clearSessionCache();
      return null;
    }
  }

  /**
   * Check if user is authenticated. Reuses cached session when possible (no extra getSession).
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const token = await this.getSessionToken();
      if (!token) return false;
      if (this.currentUser) return true;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await this.syncUser(session.user);
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
      this.clearSessionCache();
      this.currentUser = null;
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  /**
   * Refresh user profile
   */
  async refreshProfile(): Promise<AuthUser | null> {
    try {
      this.clearSessionCache();
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
