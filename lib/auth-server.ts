import { NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
    try {
        const supabase = createServerClient();
        const authHeader = request.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.substring(7);
        const { data: { user }, error } = await supabase.auth.getUser(token);

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
