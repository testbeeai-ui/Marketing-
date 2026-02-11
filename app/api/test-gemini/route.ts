import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromRequest } from '@/lib/auth-server';

/**
 * Quick test to verify GOOGLE_API_KEY works from the app.
 * GET /api/test-gemini - call from browser. Delete after debugging.
 */
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const raw = process.env.GOOGLE_API_KEY;
  const apiKey = raw?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      error: 'GOOGLE_API_KEY not set',
      hint: 'Check .env has GOOGLE_API_KEY=your_key',
    }, { status: 500 });
  }

  // Fingerprint to verify you're using the right key (compare with your working curl key)
  const fingerprint = `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say hi in one word' }] }],
      }),
    });

    const data = (await res.json()) as { candidates?: unknown[]; error?: { message: string } };
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        error: data.error?.message || 'Request failed',
        fingerprint,
        keyLength: apiKey.length,
        hint: 'If fingerprint differs from your curl key, .env has a different key. Copy the EXACT key from aistudio.google.com into .env, then: rm -rf .next && npm run dev',
      });
    }
    return NextResponse.json({
      ok: true,
      message: 'Key works from app',
      fingerprint,
      keyLength: apiKey.length,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown error',
      fingerprint,
    }, { status: 500 });
  }
}
