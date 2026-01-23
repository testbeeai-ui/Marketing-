import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { userProfileService } from '@/lib/services/userProfileService';

// Helper to verify auth token
async function verifyAuthToken(request: NextRequest) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
    const authHeader = request.headers.get('authorization');

    if (authHeader && authHeader.startsWith('Bearer ')) {
         const token = authHeader.substring(7);
         const { data: { user }, error } = await supabase.auth.getUser(token);
         if (error || !user) {
             return null;
         }
         return {
            id: user.id,
            email: user.email,
        };
    }
    
    // Check cookie session if no bearer token
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }

    return {
        id: user.id,
        email: user.email,
    };
}

// GET /api/auth/me - Get current user profile
export async function GET(request: NextRequest) {
    try {
        const userInfo = await verifyAuthToken(request);
        if (!userInfo) {
            return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
        }

        let profile = await userProfileService.getUserProfile(userInfo.id);

        if (!profile) {
            profile = await userProfileService.getOrCreateUser(userInfo.id);
        }

        return NextResponse.json({
            user: {
                id: userInfo.id,
                email: userInfo.email,
            },
            profile,
        });
    } catch (error: any) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json({ error: error.message || 'Failed to fetch user profile' }, { status: 500 });
    }
}