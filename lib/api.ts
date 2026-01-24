import { authService } from './auth';

const API_BASE = '/api';

// Helper to get auth headers
async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await authService.getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Sync version for backwards compatibility (will use session token if available)
function getAuthHeadersSync(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  // Try to get token synchronously from Supabase storage
  if (typeof window !== 'undefined') {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseSession = localStorage.getItem('sb-' + supabaseUrl?.split('//')[1]?.split('.')[0] + '-auth-token');
      if (supabaseSession) {
        const parsed = JSON.parse(supabaseSession);
        if (parsed?.access_token) {
          headers['Authorization'] = `Bearer ${parsed.access_token}`;
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  return headers;
}

export interface Block {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  lastUpdated: string;
  status: 'ready' | 'indexing';
}

export interface FileItem {
  id: string;
  name: string;
  status: 'ready' | 'indexing';
  fileSize?: number;
  uploadedAt?: string;
}

export interface StoryResponse {
  stories: {
    professional: string;
    viral: string;
    storyteller: string;
  };
  contextUsed: boolean;
  chunksRetrieved: number;
}

// Blocks API
export const blocksApi = {
  getAll: async (): Promise<Block[]> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/blocks`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch blocks' }));
      throw new Error(error.error || `Failed to fetch blocks: ${response.statusText}`);
    }

    return response.json();
  },

  getById: async (id: string): Promise<Block> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/blocks?id=${id}`, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch block' }));
      throw new Error(error.error || `Failed to fetch block: ${response.statusText}`);
    }

    return response.json();
  },

  create: async (name: string, description: string): Promise<Block> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/blocks`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create block' }));
      throw new Error(error.error || `Failed to create block: ${response.statusText}`);
    }

    return response.json();
  },

  update: async (id: string, name: string, description: string): Promise<Block> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/blocks`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ id, name, description }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update block' }));
      throw new Error(error.error || `Failed to update block: ${response.statusText}`);
    }

    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/blocks?id=${id}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete block' }));
      throw new Error(error.error || `Failed to delete block: ${response.statusText}`);
    }
  },
};

// Files API
export const filesApi = {
  upload: async (file: File, blockId: string): Promise<FileItem> => {
    try {
      const token = await authService.getSessionToken();
      console.log('[Files API] Uploading file:', file.name, 'to block:', blockId);

      if (!token) {
        console.error('[Files API] No authentication token found');
        throw new Error('Authentication required. Please log in again.');
      }

      if (!blockId) {
        console.error('[Files API] No blockId provided');
        throw new Error('Block ID is required. Please select a block first.');
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('blockId', blockId);

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Don't set Content-Type - browser will set it automatically with boundary for FormData
      
      // Update: Point to the correct API endpoint
      console.log('[Files API] Sending request to:', `${API_BASE}/files`);
      console.log('[Files API] File size:', file.size, 'bytes');
      console.log('[Files API] File type:', file.type);

      let response: Response;
      try {
        response = await fetch(`${API_BASE}/files`, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch (networkError) {
        console.error('[Files API] Network error:', networkError);
        throw new Error('Network error: Unable to reach server. Please check your connection and ensure the server is running.');
      }

      console.log('[Files API] Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;

        try {
          const errorData = await response.json();
          console.error('[Files API] Upload failed with error data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;

          // Provide specific error messages for common cases
          if (response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (response.status === 404) {
            errorMessage = 'Block not found. Please refresh the page and try again.';
          } else if (response.status === 400) {
            errorMessage = errorData.error || 'Invalid request. Please check the file and try again.';
          } else if (response.status === 500) {
            errorMessage = errorData.error || 'Server error. Please try again or contact support.';
          }
        } catch (parseError) {
          // If we can't parse JSON, use the status text
          console.error('[Files API] Could not parse error response:', parseError);
          const text = await response.text().catch(() => '');
          if (text) {
            console.error('[Files API] Error response text:', text);
          }
        }

        throw new Error(errorMessage);
      }

      let result: FileItem;
      try {
        result = await response.json();
        console.log('[Files API] Upload successful:', result);
      } catch (parseError) {
        console.error('[Files API] Could not parse success response:', parseError);
        throw new Error('Upload completed but received invalid response from server.');
      }

      return result;
    } catch (error) {
      console.error('[Files API] Upload error:', error);
      // Re-throw with better error message if it's not already an Error
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to upload file: ${String(error)}`);
    }
  },

  delete: async (fileId: string): Promise<void> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/files?fileId=${fileId}`, {
      method: 'DELETE',
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete file' }));
      throw new Error(error.error || `Failed to delete file: ${response.statusText}`);
    }
  },

  list: async (blockId: string): Promise<FileItem[]> => {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/files?blockId=${blockId}`, {
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to list files' }));
      throw new Error(error.error || `Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return (data || []).map((file: any) => ({
      id: file.id,
      name: file.name ?? file.fileName ?? file.file_name ?? 'Untitled document',
      status: file.status ?? 'ready',
      fileSize: file.fileSize ?? file.file_size,
      uploadedAt: file.uploadedAt ?? file.uploaded_at,
    }));
  },
};

// Stories API
export const storiesApi = {
  generate: async (prompt: string, blockId: string, subBlockId?: string): Promise<StoryResponse & { storyId: string }> => {
    const response = await fetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ prompt, blockId, subBlockId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate stories' }));
      throw new Error(error.error || 'Failed to generate stories');
    }

    return response.json();
  },

  get: async (id: string): Promise<StoryResponse> => {
    const response = await fetch(`${API_BASE}/stories/${id}`, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch story');
    return response.json();
  },

  like: async (storyId: string, storyContent: string, styleType: 'professional' | 'viral' | 'storyteller'): Promise<void> => {
    const response = await fetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'like', storyId, storyContent, styleType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to like story' }));
      throw new Error(error.error || 'Failed to like story');
    }
  },

  dislike: async (storyId: string, storyContent: string, styleType: 'professional' | 'viral' | 'storyteller'): Promise<void> => {
    const response = await fetch(`${API_BASE}/stories`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'dislike', storyId, storyContent, styleType }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to dislike story' }));
      throw new Error(error.error || 'Failed to dislike story');
    }
  },
};

// Content API
export const contentApi = {
  generate: async (
    storyId: string | undefined,
    platforms: string[],
    storyContent?: string,
    imageContext?: Record<string, { enhancedPrompt: string; imageUrl?: string }>
  ): Promise<Record<string, string>> => {
    const response = await fetch(`${API_BASE}/content`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'generate', storyId, storyContent, platforms, imageContext }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate content' }));
      throw new Error(error.error || 'Failed to generate content');
    }

    const data = await response.json();
    return data.contents || {};
  },

  like: async (caption: string, platform: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/content`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'like', caption, platform }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to like caption' }));
      throw new Error(error.error || 'Failed to like caption');
    }
  },

  dislike: async (caption: string, platform: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/content`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'dislike', caption, platform }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to dislike caption' }));
      throw new Error(error.error || 'Failed to dislike caption');
    }
  },
};

// Images API
export const imagesApi = {
  generatePrompt: async (text: string, platform?: string): Promise<{ prompt: string }> => {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'prompt', text, platform }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate prompt' }));
      throw new Error(error.error || 'Failed to generate prompt');
    }

    const data = await response.json();
    return { prompt: data.prompt ?? data.enhancedPrompt };
  },

  generate: async (prompt: string, width?: number, height?: number, platform?: string): Promise<{ enhancedPrompt: string; imageUrl?: string; platform?: string }> => {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'generate', prompt, width, height, platform }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate image' }));
      throw new Error(error.error || 'Failed to generate image');
    }

    return response.json();
  },

  generateAllPlatforms: async (prompt: string): Promise<Record<string, { enhancedPrompt: string; imageUrl?: string }>> => {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'generate-all-platforms', prompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate images' }));
      throw new Error(error.error || 'Failed to generate images');
    }

    return response.json();
  },

  like: async (imagePrompt: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'like', imagePrompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to like image' }));
      throw new Error(error.error || 'Failed to like image');
    }
  },

  dislike: async (imagePrompt: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/images`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ action: 'dislike', imagePrompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to dislike image' }));
      throw new Error(error.error || 'Failed to dislike image');
    }
  },
};

// Auth API
export const authApi = {
  login: async (userId: number) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to login' }));
      throw new Error(error.error || 'Failed to login');
    }

    return response.json();
  },

  getMe: async () => {
    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      throw new Error('Failed to get user profile');
    }

    return response.json();
  },

  logout: async () => {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: await getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to logout');
    }

    return response.json();
  },
};

// Sub-Block interfaces
export interface StoryVariation {
  id: string; // 'professional', 'viral', 'storyteller'
  title: string;
  content: string;
  selected: boolean;
  platformContents?: Record<string, string>;
}

export interface SubBlock {
  id: string;
  blockId: string;
  name: string;
  prompt: string;
  storyVariations: StoryVariation[];
  selectedVariationId?: string;
  platformContents?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// Sub-Blocks API
export const subBlocksApi = {
  getByBlockId: async (blockId: string): Promise<SubBlock[]> => {
    const response = await fetch(`${API_BASE}/sub-blocks?blockId=${blockId}`, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch sub-blocks' }));
      throw new Error(error.error || `Failed to fetch sub-blocks: ${response.statusText}`);
    }
    return response.json();
  },

  getById: async (id: string): Promise<SubBlock> => {
    const response = await fetch(`${API_BASE}/sub-blocks?id=${id}`, {
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to fetch sub-block' }));
      throw new Error(error.error || `Failed to fetch sub-block: ${response.statusText}`);
    }
    return response.json();
  },

  create: async (blockId: string, name: string, prompt?: string): Promise<SubBlock> => {
    const response = await fetch(`${API_BASE}/sub-blocks`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ blockId, name, prompt: prompt || '' }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to create sub-block' }));
      throw new Error(error.error || `Failed to create sub-block: ${response.statusText}`);
    }
    return response.json();
  },

  update: async (id: string, updates: {
    storyVariations?: StoryVariation[];
    selectedVariationId?: string;
    platformContents?: Record<string, string>;
    name?: string;
    prompt?: string;
  }): Promise<SubBlock> => {
    const response = await fetch(`${API_BASE}/sub-blocks`, {
      method: 'PUT',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ id, ...updates }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update sub-block' }));
      throw new Error(error.error || `Failed to update sub-block: ${response.statusText}`);
    }
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/sub-blocks?id=${id}`, {
      method: 'DELETE',
      headers: await getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete sub-block' }));
      throw new Error(error.error || `Failed to delete sub-block: ${response.statusText}`);
    }
  },
};
