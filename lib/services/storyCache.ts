interface StoryVariation {
  id: string;
  tone: string;
  style: string;
  title: string;
  content: string;
}

interface CachedStory {
  id: string;
  blockId: string;
  prompt: string;
  variations: Record<string, string>; // mapping id -> content for compatibility
  structuredVariations: StoryVariation[];
  contextUsed: string[];
  createdAt: number;
}

class StoryCache {
  private cache: Map<string, CachedStory>;
  private readonly TTL: number = 1000 * 60 * 60 * 24; // 24 hours

  constructor() {
    this.cache = new Map();
  }

  set(storyId: string, story: CachedStory): void {
    this.cache.set(storyId, story);
    this.cleanUp();
  }

  get(storyId: string): CachedStory | undefined {
    const story = this.cache.get(storyId);
    if (!story) return undefined;

    if (Date.now() - story.createdAt > this.TTL) {
      this.cache.delete(storyId);
      return undefined;
    }

    return story;
  }

  getByBlockId(blockId: string): CachedStory[] {
    const stories: CachedStory[] = [];
    for (const story of this.cache.values()) {
      if (story.blockId === blockId) {
        if (Date.now() - story.createdAt <= this.TTL) {
          stories.push(story);
        } else {
          this.cache.delete(story.id);
        }
      }
    }
    return stories.sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteByBlockId(blockId: string): void {
    const storiesToDelete = Array.from(this.cache.entries())
      .filter(([_, story]) => story.blockId === blockId)
      .map(([id]) => id);
    
    storiesToDelete.forEach(id => this.cache.delete(id));
  }

  private cleanUp(): void {
    const now = Date.now();
    for (const [id, story] of this.cache.entries()) {
      if (now - story.createdAt > this.TTL) {
        this.cache.delete(id);
      }
    }
  }
}

export const storyCache = new StoryCache();
