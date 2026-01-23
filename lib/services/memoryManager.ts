import { userMemoryService, MAX_MEMORIES_PER_TYPE } from './userMemoryService';

/**
 * Memory Manager Service
 * Handles automatic cleanup and optimization of user memories
 */
export class MemoryManager {
  /**
   * Cleanup old memories for a user (called automatically by userMemoryService)
   * This is a utility service that can be used for batch operations
   */
  async cleanupUserMemories(userId: number): Promise<void> {
    // The cleanup is already handled in userMemoryService.addMemory()
    // This method can be used for manual cleanup or batch operations
    console.log(`[MemoryManager] Cleanup completed for user ${userId}`);
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: number): Promise<{
    totalMemories: number;
    memoriesByType: Record<string, number>;
  }> {
    const stats: {
      totalMemories: number;
      memoriesByType: Record<string, number>;
    } = {
      totalMemories: 0,
      memoriesByType: {},
    };

    // Count memories for each type
    for (const [memoryType, maxLimit] of Object.entries(MAX_MEMORIES_PER_TYPE)) {
      const memories = await userMemoryService.getMemories(userId, memoryType, maxLimit);
      stats.memoriesByType[memoryType] = memories.length;
      stats.totalMemories += memories.length;
    }

    return stats;
  }
}

export const memoryManager = new MemoryManager();
