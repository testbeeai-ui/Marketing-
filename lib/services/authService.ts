import { userProfileService } from './userProfileService';

// Simple session-based authentication
// In production, you might want to use JWT tokens or Supabase Auth
interface Session {
  userId: string; // Changed from number to string to match UUID
  createdAt: number;
  expiresAt: number;
}

// In-memory session store (in production, use Redis or database)
const sessions = new Map<string, Session>();

// Session expiry: 7 days
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export class AuthService {
  /**
   * Create a session for a user
   */
  createSession(userId: string): string { // Changed from number to string
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const now = Date.now();

    sessions.set(sessionId, {
      userId,
      createdAt: now,
      expiresAt: now + SESSION_DURATION,
    });

    // Cleanup expired sessions periodically
    this.cleanupExpiredSessions();

    return sessionId;
  }

  /**
   * Get user ID from session
   */
  getUserIdFromSession(sessionId: string): string | null { // Changed from number to string
    const session = sessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if expired
    if (Date.now() > session.expiresAt) {
      sessions.delete(sessionId);
      return null;
    }

    return session.userId;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): void {
    sessions.delete(sessionId);
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [sessionId, session] of sessions.entries()) {
      if (now > session.expiresAt) {
        sessions.delete(sessionId);
      }
    }
  }

  /**
   * Authenticate user (simple implementation - can be enhanced)
   * For now, we'll auto-create users on first request
   */
  async authenticateUser(userId: string): Promise<{ sessionId: string; profile: any }> { // Changed from number to string
    // Get or create user profile
    const profile = await userProfileService.getOrCreateUser(userId);
    
    // Create session
    const sessionId = this.createSession(userId);

    return { sessionId, profile };
  }
}

export const authService = new AuthService();