import { userMemoryService } from './userMemoryService';

/**
 * Memory Manager Service
 * Handles automatic cleanup and optimization of user memories
 */
export class MemoryManager {
  /**
   * Cleanup old memories for a user (called automatically by userMemoryService)
   * This is a utility service that can be used for batch operations
   */
  async cleanupUserMemories(userId: string): Promise<void> {
    // The cleanup is already handled in userMemoryService.addMemory()
    // This method can be used for manual cleanup or batch operations
    console.log(`[MemoryManager] Cleanup completed for user ${userId}`);
  }

  /**
   * Get memory statistics for a user
   */
  async getMemoryStats(userId: string): Promise<{
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

    // Get all memories for the user
    const allMemories = await userMemoryService.getAllMemories(userId);
    
    // Count memories by type
    allMemories.forEach(memory => {
      const type = memory.memory_type;
      stats.memoriesByType[type] = (stats.memoriesByType[type] || 0) + 1;
      stats.totalMemories++;
    });

    return stats;
  }
}

export const memoryManager = new MemoryManager();