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
         const numericUserId = parseInt(user.id.replace(/-/g, '').substring(0, 15), 16) % 2147483647;
         return {
            id: user.id,
            numericId: numericUserId,
            email: user.email,
        };
    }
    
    // Check cookie session if no bearer token
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return null;
    }

    const numericUserId = parseInt(user.id.replace(/-/g, '').substring(0, 15), 16) % 2147483647;

    return {
        id: user.id,
        numericId: numericUserId,
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

        let profile = await userProfileService.getUserProfile(userInfo.numericId);

        if (!profile) {
            profile = await userProfileService.getOrCreateUser(userInfo.numericId);
        }

        return NextResponse.json({
            user: {
                id: userInfo.id,
                email: userInfo.email,
                username: profile.username,
                firstName: profile.first_name,
                lastName: profile.last_name,
                stylePreferences: profile.style_preferences,
                brandVoice: profile.brand_voice,
                linkedinVoice: profile.linkedin_voice,
                twitterVoice: profile.twitter_voice,
                instagramVoice: profile.instagram_voice,
                facebookVoice: profile.facebook_voice,
                onboardingCompleted: profile.onboarding_completed,
                preferredEmojiUsage: profile.preferred_emoji_usage,
                preferredFormality: profile.preferred_formality,
            },
        });
    } catch (error: any) {
        console.error('Error getting user profile:', error);
        return NextResponse.json({ error: error.message || 'Failed to get user profile' }, { status: 500 });
    }
}
