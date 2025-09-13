import { storage } from '../storage.js';
import type { BillingLock } from '../../shared/schema.js';
import { nanoid } from 'nanoid';

/**
 * Enterprise-grade distributed locking service for billing operations
 * Replaces in-memory mutex locks with database-backed distributed locks
 * Provides robust concurrency protection with TTL, timeouts, and deadlock prevention
 */
export class BillingLockService {
  private readonly defaultTimeoutMs = 300000; // 5 minutes
  private readonly instanceId: string;

  constructor() {
    // Generate unique instance ID for this process/server
    this.instanceId = `billing-${process.env.REPL_ID || 'local'}-${Date.now()}-${nanoid(8)}`;
  }

  /**
   * Acquire a distributed lock for billing operations
   * Supports queuing and automatic retry with exponential backoff
   */
  async acquireLock(
    lockType: string,
    resourceId: string,
    options: {
      lockReason?: string;
      timeoutMs?: number;
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ success: boolean; lock?: BillingLock; waitTime?: number }> {
    const {
      lockReason = 'billing_operation',
      timeoutMs = this.defaultTimeoutMs,
      correlationId,
      metadata = {}
    } = options;

    const lockerId = `${this.instanceId}-${Date.now()}-${nanoid(6)}`;
    
    console.log(`🔒 Acquiring billing lock: ${lockType}/${resourceId} [${correlationId || 'no-correlation'}]`);
    
    try {
      const result = await storage.acquireBillingLock(lockType, resourceId, lockerId, {
        lockReason,
        timeoutMs,
        correlationId: correlationId || `lock-${Date.now()}-${nanoid(8)}`,
        metadata: {
          ...metadata,
          instanceId: this.instanceId,
          acquiredAt: new Date().toISOString()
        }
      });

      if (result.success) {
        console.log(`✅ Lock acquired: ${lockType}/${resourceId} (wait: ${result.waitTime}ms)`);
      } else {
        console.warn(`❌ Lock acquisition failed: ${lockType}/${resourceId} (wait: ${result.waitTime}ms, queue: ${result.queuePosition})`);
      }

      return result;
    } catch (error) {
      console.error(`💥 Lock acquisition error: ${lockType}/${resourceId}:`, error);
      throw new Error(`Failed to acquire billing lock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Renew an existing lock to extend its lifetime
   * Used for long-running operations that need to keep the lock active
   */
  async renewLock(lockId: string, additionalTimeMs: number = this.defaultTimeoutMs): Promise<boolean> {
    try {
      console.log(`🔄 Renewing billing lock: ${lockId} (+${additionalTimeMs}ms)`);
      
      const result = await storage.renewBillingLock(lockId, additionalTimeMs);
      
      if (result.success) {
        console.log(`✅ Lock renewed: ${lockId}`);
      } else {
        console.warn(`❌ Lock renewal failed: ${lockId}`);
      }
      
      return result.success;
    } catch (error) {
      console.error(`💥 Lock renewal error: ${lockId}:`, error);
      return false;
    }
  }

  /**
   * Release a distributed lock
   * Should always be called when operation completes (success or failure)
   */
  async releaseLock(lockId: string): Promise<void> {
    try {
      console.log(`🔓 Releasing billing lock: ${lockId}`);
      await storage.releaseBillingLock(lockId);
      console.log(`✅ Lock released: ${lockId}`);
    } catch (error) {
      console.error(`💥 Lock release error: ${lockId}:`, error);
      // Don't throw - lock will auto-expire
    }
  }

  /**
   * Get current lock holder for a resource
   * Useful for debugging and monitoring
   */
  async getCurrentLock(lockType: string, resourceId: string): Promise<BillingLock | undefined> {
    return await storage.getBillingLock(lockType, resourceId);
  }

  /**
   * Check if a resource is currently locked
   * Lightweight check without detailed lock information
   */
  async isLocked(lockType: string, resourceId: string): Promise<boolean> {
    const lock = await this.getCurrentLock(lockType, resourceId);
    return !!lock;
  }

  /**
   * Get queue status for a lock type/resource
   * Shows how many operations are waiting
   */
  async getLockQueue(lockType: string, resourceId: string): Promise<BillingLock[]> {
    return await storage.getBillingLockQueue(lockType, resourceId);
  }

  /**
   * Get all active locks with optional filtering
   * Useful for monitoring and debugging
   */
  async getActiveLocks(filters?: {
    lockType?: string;
    resourceId?: string;
    correlationId?: string;
  }): Promise<BillingLock[]> {
    return await storage.getActiveBillingLocks(filters);
  }

  /**
   * Cleanup expired locks (should be run periodically)
   * Returns number of locks cleaned up
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      const cleanedCount = await storage.cleanupExpiredBillingLocks();
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} expired billing locks`);
      }
      return cleanedCount;
    } catch (error) {
      console.error('💥 Lock cleanup error:', error);
      return 0;
    }
  }

  /**
   * Execute a function with exclusive lock protection
   * Automatically handles lock acquisition and release
   */
  async withLock<T>(
    lockType: string,
    resourceId: string,
    operation: (lock: BillingLock) => Promise<T>,
    options?: {
      lockReason?: string;
      timeoutMs?: number;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<T> {
    const lockResult = await this.acquireLock(lockType, resourceId, options);
    
    if (!lockResult.success || !lockResult.lock) {
      throw new Error(`Failed to acquire lock for ${lockType}/${resourceId} after ${lockResult.waitTime}ms`);
    }

    const { lock } = lockResult;
    
    try {
      console.log(`🔒 Executing protected operation: ${lockType}/${resourceId}`);
      const result = await operation(lock);
      console.log(`✅ Protected operation completed: ${lockType}/${resourceId}`);
      return result;
    } catch (error) {
      console.error(`💥 Protected operation failed: ${lockType}/${resourceId}:`, error);
      throw error;
    } finally {
      await this.releaseLock(lock.id);
    }
  }

  /**
   * Health check - verifies lock service is functioning
   * Returns diagnostics about the locking system
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    activeLocks: number;
    expiredLocks: number;
    instanceId: string;
    errors: string[];
  }> {
    const errors: string[] = [];
    let activeLocks = 0;
    let expiredLocks = 0;

    try {
      // Get active locks count
      const active = await this.getActiveLocks();
      activeLocks = active.length;

      // Cleanup expired locks
      expiredLocks = await this.cleanupExpiredLocks();

    } catch (error) {
      errors.push(`Lock health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      healthy: errors.length === 0,
      activeLocks,
      expiredLocks,
      instanceId: this.instanceId,
      errors
    };
  }
}

// Singleton instance
export const billingLockService = new BillingLockService();