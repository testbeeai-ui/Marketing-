import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SupabaseClient } from '@supabase/supabase-js';

export async function createAuthenticatedClient(): Promise<SupabaseClient> {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    );
}

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    try {
        const supabase = await createAuthenticatedClient();
        const authHeader = request.headers.get('authorization');

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const { data: { user }, error } = await supabase.auth.getUser(token);
             if (error || !user) {
                return null;
            }
            return user.id;
        }

        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return null;
        }

        // Return the UUID as the user ID
        return user.id;
    } catch (error) {
        console.error('Error getting user ID from request:', error);
        return null;
    }
}

export async function getNumericUserIdFromRequest(request: NextRequest): Promise<number | null> {
    try {
        const userId = await getUserIdFromRequest(request);
        if (!userId) return null;

        // Convert UUID to numeric ID for backend compatibility
        return parseInt(userId.replace(/-/g, '').substring(0, 15), 16) % 2147483647;
    } catch (error) {
        console.error('Error getting numeric user ID:', error);
        return null;
    }
}

export async function getAuthenticatedUser(request: NextRequest): Promise<{ user: any, supabase: SupabaseClient } | null> {
    try {
        const supabase = await createAuthenticatedClient();
        const authHeader = request.headers.get('authorization');

        let user = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const { data, error } = await supabase.auth.getUser(token);
            if (!error && data.user) {
                user = data.user;
            }
        } else {
            const { data, error } = await supabase.auth.getUser();
            if (!error && data.user) {
                user = data.user;
            }
        }

        if (!user) return null;

        return { user, supabase };
    } catch (error) {
        console.error('Error getting authenticated user:', error);
        return null;
    }
}
