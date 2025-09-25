/**
 * Enhanced caching system with TTL, LRU eviction, and monitoring
 */

import { LRUCache } from 'lru-cache';
import { CacheMonitor } from './monitor.js';
import type { CacheEntry, CacheStats } from '../types/index.js';

export interface CacheConfig {
  maxSize: number;
  ttl: number; // milliseconds
  updateAgeOnGet: boolean;
  allowStale: boolean;
  enableMonitoring: boolean;
}

export class EnhancedCache<T = any> {
  private cache: LRUCache<string, CacheEntry<T>>;
  private monitor: CacheMonitor;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      ttl: 300000, // 5 minutes
      updateAgeOnGet: true,
      allowStale: false,
      enableMonitoring: true,
      ...config,
    };

    this.cache = new LRUCache<string, CacheEntry<T>>({
      max: this.config.maxSize,
      ttl: this.config.ttl,
      updateAgeOnGet: this.config.updateAgeOnGet,
      allowStale: this.config.allowStale,
      dispose: () => {
        if (this.config.enableMonitoring) {
          this.monitor.recordEviction();
        }
      },
    });

    this.monitor = new CacheMonitor();
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: ttl || this.config.ttl,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(key, entry, { ttl: entry.ttl });
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();

      if (this.config.enableMonitoring) {
        this.monitor.recordHit();
      }

      return entry.value;
    }

    if (this.config.enableMonitoring) {
      this.monitor.recordMiss();
    }

    return undefined;
  }

  /**
   * Check if a key exists in the cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    if (this.config.enableMonitoring) {
      this.monitor.reset();
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const stats = this.monitor.getStats();
    stats.size = this.cache.size;
    stats.memoryUsage = this.calculateMemoryUsage();

    // Find oldest and newest entries
    const entries = Array.from(this.cache.values());
    if (entries.length > 0) {
      stats.oldestEntry = Math.min(...entries.map(e => e.timestamp));
      stats.newestEntry = Math.max(...entries.map(e => e.timestamp));
    }

    return stats;
  }

  /**
   * Calculate approximate memory usage
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // UTF-16 characters
      totalSize += this.estimateValueSize(entry);
    }

    return totalSize;
  }

  /**
   * Estimate the size of a cache entry
   */
  private estimateValueSize(entry: CacheEntry<T>): number {
    try {
      return JSON.stringify(entry).length * 2; // Rough estimate
    } catch {
      return 1000; // Default estimate if serialization fails
    }
  }

  /**
   * Get or set with a factory function
   */
  async getOrSet<R = T>(
    key: string,
    factory: () => Promise<R>,
    ttl?: number
  ): Promise<R> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as unknown as R;
    }

    const value = await factory();
    this.set(key, value as unknown as T, ttl);
    return value;
  }

  /**
   * Set multiple values at once
   */
  setMany(entries: Array<{ key: string; value: T; ttl?: number }>): void {
    for (const { key, value, ttl } of entries) {
      this.set(key, value, ttl);
    }
  }

  /**
   * Get multiple values at once
   */
  getMany(keys: string[]): Array<{ key: string; value: T | undefined }> {
    return keys.map(key => ({ key, value: this.get(key) }));
  }

  /**
   * Delete multiple keys at once
   */
  deleteMany(keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        deleted++;
      }
    }
    return deleted;
  }

  /**
   * Get entries that match a pattern
   */
  getByPattern(pattern: RegExp): Array<{ key: string; value: T }> {
    const results: Array<{ key: string; value: T }> = [];

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        const value = this.get(key);
        if (value !== undefined) {
          results.push({ key, value });
        }
      }
    }

    return results;
  }

  /**
   * Delete entries that match a pattern
   */
  deleteByPattern(pattern: RegExp): number {
    const keysToDelete = Array.from(this.cache.keys()).filter(key => pattern.test(key));
    return this.deleteMany(keysToDelete);
  }

  /**
   * Get entries sorted by access frequency
   */
  getMostAccessed(limit: number = 10): Array<{ key: string; value: T; accessCount: number }> {
    const entries: Array<{ key: string; value: T; accessCount: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      entries.push({
        key,
        value: entry.value,
        accessCount: entry.accessCount,
      });
    }

    return entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Get entries that will expire soon
   */
  getExpiringSoon(withinMs: number = 60000): Array<{ key: string; expiresIn: number }> {
    const now = Date.now();
    const results: Array<{ key: string; expiresIn: number }> = [];

    for (const [key, entry] of this.cache.entries()) {
      const expiresAt = entry.timestamp + (entry.ttl || this.config.ttl);
      const expiresIn = expiresAt - now;

      if (expiresIn > 0 && expiresIn <= withinMs) {
        results.push({ key, expiresIn });
      }
    }

    return results.sort((a, b) => a.expiresIn - b.expiresIn);
  }

  /**
   * Refresh TTL for a key
   */
  refreshTTL(key: string, ttl?: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    const newTtl = ttl || this.config.ttl;
    entry.ttl = newTtl;
    entry.timestamp = Date.now();

    this.cache.set(key, entry, { ttl: newTtl });
    return true;
  }

  /**
   * Export cache contents for debugging
   */
  export(): Array<{ key: string; entry: CacheEntry<T> }> {
    const exports: Array<{ key: string; entry: CacheEntry<T> }> = [];

    for (const [key, entry] of this.cache.entries()) {
      exports.push({ key, entry });
    }

    return exports;
  }

  /**
   * Import cache contents
   */
  import(data: Array<{ key: string; entry: CacheEntry<T> }>): void {
    for (const { key, entry } of data) {
      const now = Date.now();
      const age = now - entry.timestamp;
      const remainingTtl = Math.max(0, (entry.ttl || this.config.ttl) - age);

      if (remainingTtl > 0) {
        this.cache.set(key, entry, { ttl: remainingTtl });
      }
    }
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.maxSize !== undefined) {
      // LRU Cache doesn't have resize method, need to recreate cache
      const oldEntries = this.export();
      this.cache = new LRUCache({
        max: newConfig.maxSize,
        ttl: newConfig.ttl || this.config.ttl,
        updateAgeOnGet: this.config.updateAgeOnGet,
        allowStale: this.config.allowStale,
        dispose: () => {
          if (this.config.enableMonitoring) {
            this.monitor.recordEviction();
          }
        },
      });
      // Re-import valid entries
      this.import(oldEntries);
    }
  }
}

/**
 * Multi-level cache with different TTLs
 */
export class MultiLevelCache {
  private l1Cache: EnhancedCache<any>; // Fast, short-lived
  private l2Cache: EnhancedCache<any>; // Slower, longer-lived

  constructor(
    l1Config: Partial<CacheConfig> = {},
    l2Config: Partial<CacheConfig> = {}
  ) {
    this.l1Cache = new EnhancedCache({
      maxSize: 100,
      ttl: 60000, // 1 minute
      ...l1Config,
    });

    this.l2Cache = new EnhancedCache({
      maxSize: 1000,
      ttl: 600000, // 10 minutes
      ...l2Config,
    });
  }

  async get<T>(key: string): Promise<T | undefined> {
    // Try L1 first
    let value = this.l1Cache.get(key);
    if (value !== undefined) {
      return value;
    }

    // Try L2
    value = this.l2Cache.get(key);
    if (value !== undefined) {
      // Promote to L1
      this.l1Cache.set(key, value);
      return value;
    }

    return undefined;
  }

  set<T>(key: string, value: T, level: 1 | 2 = 1): void {
    if (level === 1) {
      this.l1Cache.set(key, value);
    } else {
      this.l2Cache.set(key, value);
    }
  }

  delete(key: string): boolean {
    const l1Deleted = this.l1Cache.delete(key);
    const l2Deleted = this.l2Cache.delete(key);
    return l1Deleted || l2Deleted;
  }

  clear(): void {
    this.l1Cache.clear();
    this.l2Cache.clear();
  }

  getStats() {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache.getStats(),
    };
  }
}

export default EnhancedCache;