import type { SupabaseClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { getAnalyticsDate } from './analyticsSchema';

export interface AnalyticsSnapshotRow {
  id: string;
  user_id: string;
  platform: string;
  image_url: string;
  extracted_data: Record<string, unknown> | null;
  ai_insights: Record<string, unknown> | null;
  created_at: string;
}

const DATA_DIR = path.join(process.cwd(), '.data', 'storyteller');
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

function useLocalStore(): boolean {
  return process.env.STORYTELLER_USE_LOCAL_STORE === 'true';
}

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

async function readSnapshotsFile(): Promise<AnalyticsSnapshotRow[]> {
  try {
    const raw = await fs.readFile(SNAPSHOTS_FILE, 'utf-8');
    const data = JSON.parse(raw) as AnalyticsSnapshotRow[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeSnapshotsFile(rows: AnalyticsSnapshotRow[]): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(SNAPSHOTS_FILE, JSON.stringify(rows, null, 0), 'utf-8');
}

export async function listByUserLocal(
  userId: string,
  limit: number,
  platform?: string,
  snapshotType?: 'dashboard' | 'post',
  dateRange?: { from?: string; to?: string }
): Promise<AnalyticsSnapshotRow[]> {
  await ensureDataDir();
  const rows = await readSnapshotsFile();
  let filtered = rows.filter((r) => {
    if (r.user_id !== userId) return false;
    if (platform && r.platform.toLowerCase() !== platform.toLowerCase()) return false;
    if (snapshotType) {
      const type = (r.extracted_data as Record<string, unknown> | null)?.snapshot_type as string | undefined;
      const hasPost = !!(r.extracted_data as Record<string, unknown> | null)?.post;
      if (snapshotType === 'post') return type === 'post' || hasPost;
      if (snapshotType === 'dashboard') return type === 'dashboard' || (!type && !hasPost);
    }
    if (dateRange?.from || dateRange?.to) {
      const analyticsDate = getAnalyticsDate(r);
      if (dateRange.from && analyticsDate < dateRange.from) return false;
      if (dateRange.to && analyticsDate > dateRange.to) return false;
    }
    return true;
  });
  filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return filtered.slice(0, limit);
}

export async function insertLocal(
  userId: string,
  platform: string,
  imageBuffer: ArrayBuffer,
  mimeType: string,
  ext: string,
  extractedData: Record<string, unknown>,
  aiInsights: Record<string, unknown> | null
): Promise<AnalyticsSnapshotRow> {
  await ensureDataDir();
  const userDir = path.join(UPLOADS_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });
  const filename = `${Date.now()}-screenshot.${ext}`;
  const filePath = path.join(userDir, filename);
  await fs.writeFile(filePath, Buffer.from(imageBuffer));
  const imageUrl = `${userId}/${filename}`;

  const row: AnalyticsSnapshotRow = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    user_id: userId,
    platform,
    image_url: imageUrl,
    extracted_data: extractedData,
    ai_insights: aiInsights,
    created_at: new Date().toISOString(),
  };

  const rows = await readSnapshotsFile();
  rows.unshift(row);
  await writeSnapshotsFile(rows);
  return row;
}

export async function listByUserSupabase(
  supabase: SupabaseClient,
  userId: string,
  limit: number,
  platform?: string,
  snapshotType?: 'dashboard' | 'post',
  dateRange?: { from?: string; to?: string },
  organizationId?: string
): Promise<AnalyticsSnapshotRow[]> {
  let query = supabase
    .from('analytics_snapshots')
    .select('id, platform, image_url, extracted_data, ai_insights, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(snapshotType || dateRange ? Math.max(limit * 3, 50) : limit);
  
  if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }
  
  if (platform) {
    query = query.ilike('platform', platform);
  }
  const { data, error } = await query;

  if (error) {
    if (error.code === 'PGRST205') {
      return [];
    }
    throw error;
  }

  let rows = (data ?? []).map((r) => ({
    id: r.id,
    user_id: userId,
    platform: r.platform,
    image_url: r.image_url,
    extracted_data: r.extracted_data as Record<string, unknown> | null,
    ai_insights: r.ai_insights as Record<string, unknown> | null,
    created_at: r.created_at,
  }));

  if (snapshotType) {
    rows = rows.filter((r) => {
      const type = (r.extracted_data as Record<string, unknown> | null)?.snapshot_type as string | undefined;
      const hasPost = !!(r.extracted_data as Record<string, unknown> | null)?.post;
      if (snapshotType === 'post') return type === 'post' || hasPost;
      if (snapshotType === 'dashboard') return type === 'dashboard' || (!type && !hasPost);
      return true;
    });
  }

  if (dateRange?.from || dateRange?.to) {
    rows = rows.filter((r) => {
      const analyticsDate = getAnalyticsDate(r);
      if (dateRange.from && analyticsDate < dateRange.from) return false;
      if (dateRange.to && analyticsDate > dateRange.to) return false;
      return true;
    });
  }

  return rows.slice(0, limit);
}

export async function insertSupabase(
  supabase: SupabaseClient,
  userId: string,
  platform: string,
  storagePath: string,
  extractedData: Record<string, unknown>,
  aiInsights: Record<string, unknown> | null,
  organizationId: string
): Promise<AnalyticsSnapshotRow> {
  if (!organizationId) {
    throw new Error('Organization ID is required to create an analytics snapshot');
  }

  const { data, error } = await supabase
    .from('analytics_snapshots')
    .insert({
      user_id: userId,
      organization_id: organizationId,
      platform,
      image_url: storagePath,
      extracted_data: extractedData,
      ai_insights: aiInsights,
    })
    .select('id, platform, image_url, extracted_data, ai_insights, created_at')
    .single();

  if (error) {
    if (
      error.message?.includes('organization_id') ||
      error.message?.includes('schema cache') ||
      error.code === '42703'
    ) {
      throw new Error(
        `Database migration not applied: The 'organization_id' column is missing from the 'analytics_snapshots' table. ` +
        `Please run migration: 20250212000006_add_organization_id_to_tables.sql (see MIGRATION_GUIDE.md)`
      );
    }
    throw error;
  }

  return {
    id: data.id,
    user_id: userId,
    platform: data.platform,
    image_url: data.image_url,
    extracted_data: data.extracted_data as Record<string, unknown> | null,
    ai_insights: data.ai_insights as Record<string, unknown> | null,
    created_at: data.created_at,
  };
}

export function useStorytellerLocalStore(): boolean {
  return useLocalStore();
}
