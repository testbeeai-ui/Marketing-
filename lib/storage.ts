/**
 * Client-Side Image Storage Service using IndexedDB
 * Provides persistent storage for generated images with automatic LRU cleanup
 */
import { get, set, del, keys, createStore } from 'idb-keyval';

// Custom store for images (separate from default idb-keyval store)
const imageStore = createStore('story-weaver-images', 'images');

// Maximum number of images to keep (LRU eviction after this limit)
const MAX_IMAGES = 50;

// Image metadata for tracking order
interface ImageMetadata {
    id: string;
    timestamp: number;
    platform?: string;
    storyId?: string;
}

// Get metadata key
const getMetaKey = () => 'image-metadata';

/**
 * Get all image metadata (for tracking order)
 */
async function getMetadata(): Promise<ImageMetadata[]> {
    try {
        const meta = await get<ImageMetadata[]>(getMetaKey(), imageStore);
        return meta || [];
    } catch {
        return [];
    }
}

/**
 * Save metadata
 */
async function setMetadata(meta: ImageMetadata[]): Promise<void> {
    await set(getMetaKey(), meta, imageStore);
}

/**
 * Save an image blob to IndexedDB with LRU eviction
 */
export async function saveImage(
    id: string,
    blob: Blob,
    platform?: string,
    storyId?: string
): Promise<void> {
    try {
        // Save the blob
        await set(`img-${id}`, blob, imageStore);

        // Update metadata
        let meta = await getMetadata();

        // Remove existing entry if present (we'll re-add at end)
        meta = meta.filter(m => m.id !== id);

        // Add new entry
        meta.push({
            id,
            timestamp: Date.now(),
            platform,
            storyId,
        });

        // LRU Eviction: If over limit, remove oldest
        while (meta.length > MAX_IMAGES) {
            const oldest = meta.shift();
            if (oldest) {
                await del(`img-${oldest.id}`, imageStore);
                console.log(`[Storage] LRU evicted image: ${oldest.id}`);
            }
        }

        await setMetadata(meta);
        console.log(`[Storage] Saved image ${id} (${meta.length}/${MAX_IMAGES})`);
    } catch (error) {
        console.error('[Storage] Failed to save image:', error);
        throw error;
    }
}

/**
 * Get an image blob from IndexedDB
 */
export async function getImage(id: string): Promise<Blob | undefined> {
    try {
        return await get<Blob>(`img-${id}`, imageStore);
    } catch (error) {
        console.error('[Storage] Failed to get image:', error);
        return undefined;
    }
}

/**
 * Get image as Object URL (for displaying in <img> tags)
 */
export async function getImageUrl(id: string): Promise<string | undefined> {
    const blob = await getImage(id);
    if (blob) {
        return URL.createObjectURL(blob);
    }
    return undefined;
}

/**
 * Delete an image from IndexedDB
 */
export async function deleteImage(id: string): Promise<void> {
    try {
        await del(`img-${id}`, imageStore);

        // Update metadata
        let meta = await getMetadata();
        meta = meta.filter(m => m.id !== id);
        await setMetadata(meta);

        console.log(`[Storage] Deleted image: ${id}`);
    } catch (error) {
        console.error('[Storage] Failed to delete image:', error);
    }
}

/**
 * Get all stored image IDs with metadata
 */
export async function getAllImages(): Promise<ImageMetadata[]> {
    return getMetadata();
}

/**
 * Get images for a specific story
 */
export async function getImagesForStory(storyId: string): Promise<ImageMetadata[]> {
    const meta = await getMetadata();
    return meta.filter(m => m.storyId === storyId);
}

/**
 * Clear all stored images
 */
export async function clearAllImages(): Promise<void> {
    try {
        const allKeys = await keys(imageStore);
        for (const key of allKeys) {
            await del(key, imageStore);
        }
        console.log('[Storage] Cleared all images');
    } catch (error) {
        console.error('[Storage] Failed to clear images:', error);
    }
}

/**
 * Convert a URL to a Blob (for saving remote images)
 */
export async function urlToBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    return response.blob();
}

/**
 * Get storage usage info
 */
export async function getStorageInfo(): Promise<{ count: number; maxCount: number }> {
    const meta = await getMetadata();
    return {
        count: meta.length,
        maxCount: MAX_IMAGES,
    };
}
