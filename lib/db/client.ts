import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables for Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Log environment status (for debugging in development)
if (process.env.NODE_ENV === 'development') {
  console.log('[DB] Environment check:');
  console.log('[DB] SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing');
  console.log('[DB] SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
  console.log('[DB] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ Set' : '✗ Missing');
}

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB] ❌ Supabase credentials not found!');
  console.error('[DB] Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env.local file');
}

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] ✅ Supabase client initialized successfully');
    }
  } catch (error) {
    console.error('[DB] ❌ Failed to initialize Supabase client:', error);
  }
} else {
  console.error('[DB] ❌ Cannot initialize Supabase client - missing credentials');
}

export { supabase };
export type { SupabaseClient };

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return supabase !== null;
}
