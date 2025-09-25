/**
 * Performance monitoring and metrics collection
 */

import { EventEmitter } from 'events';
import type { PerformanceMetrics, CacheStats } from '../types/index.js';

export interface PerformanceConfig {
  enableMetrics: boolean;
  slowOperationThreshold: number;
  memoryMonitoring: boolean;
  maxMetricsHistory: number;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private config: PerformanceConfig;
  private startTimes: Map<string, number> = new Map();
  private memoryBaseline: number;

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = {
      enableMetrics: true,
      slowOperationThreshold: 5000, // 5 seconds
      memoryMonitoring: true,
      maxMetricsHistory: 1000,
      ...config,
    };

    this.memoryBaseline = this.getCurrentMemoryUsage();
  }

  /**
   * Start timing an operation
   */
  startOperation(operationId: string, operationName: string): void {
    if (!this.config.enableMetrics) return;

    this.startTimes.set(operationId, performance.now());
  }

  /**
   * End timing an operation and record metrics
   */
  endOperation(
    operationId: string,
    operationName: string,
    success: boolean = true,
    errorMessage?: string
  ): PerformanceMetrics | null {
    if (!this.config.enableMetrics) return null;

    const startTime = this.startTimes.get(operationId);
    if (!startTime) {
      console.warn(`No start time found for operation: ${operationId}`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: PerformanceMetrics = {
      operationName,
      duration,
      startTime,
      endTime,
      success,
      errorMessage,
    };

    if (this.config.memoryMonitoring) {
      metric.memoryUsage = this.getCurrentMemoryUsage();
    }

    // Store metric
    this.recordMetric(operationName, metric);

    // Clean up
    this.startTimes.delete(operationId);

    // Emit events for slow operations
    if (duration > this.config.slowOperationThreshold) {
      this.emit('slowOperation', metric);
    }

    if (!success) {
      this.emit('operationError', metric);
    }

    return metric;
  }

  /**
   * Record a metric
   */
  private recordMetric(operationName: string, metric: PerformanceMetrics): void {
    let operationMetrics = this.metrics.get(operationName);
    if (!operationMetrics) {
      operationMetrics = [];
      this.metrics.set(operationName, operationMetrics);
    }

    operationMetrics.push(metric);

    // Limit history size
    if (operationMetrics.length > this.config.maxMetricsHistory) {
      operationMetrics.shift();
    }
  }

  /**
   * Get metrics for a specific operation
   */
  getOperationMetrics(operationName: string): PerformanceMetrics[] {
    return this.metrics.get(operationName) || [];
  }

  /**
   * Get summary statistics for an operation
   */
  getOperationSummary(operationName: string): {
    totalCalls: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    successRate: number;
    slowOperations: number;
    lastError?: string;
  } {
    const metrics = this.getOperationMetrics(operationName);

    if (metrics.length === 0) {
      return {
        totalCalls: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        successRate: 0,
        slowOperations: 0,
      };
    }

    const durations = metrics.map(m => m.duration);
    const successful = metrics.filter(m => m.success);
    const slowOps = metrics.filter(m => m.duration > this.config.slowOperationThreshold);
    const errors = metrics.filter(m => !m.success);

    return {
      totalCalls: metrics.length,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      successRate: successful.length / metrics.length,
      slowOperations: slowOps.length,
      lastError: errors.length > 0 ? errors[errors.length - 1].errorMessage : undefined,
    };
  }

  /**
   * Get all performance statistics
   */
  getAllStatistics(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [operationName] of this.metrics) {
      stats[operationName] = this.getOperationSummary(operationName);
    }

    // Add system metrics
    stats._system = {
      currentMemoryUsage: this.getCurrentMemoryUsage(),
      memoryBaseline: this.memoryBaseline,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    };

    return stats;
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.startTimes.clear();
    this.memoryBaseline = this.getCurrentMemoryUsage();
  }

  /**
   * Create a performance timer decorator
   */
  createTimer(operationName: string) {
    return <T extends (...args: any[]) => any>(
      target: any,
      propertyKey: string,
      descriptor: TypedPropertyDescriptor<T>
    ): TypedPropertyDescriptor<T> => {
      const originalMethod = descriptor.value;

      descriptor.value = (async function(this: any, ...args: any[]) {
        const operationId = `${operationName}_${Date.now()}_${Math.random()}`;

        this.performanceMonitor?.startOperation(operationId, operationName);

        try {
          const result = await originalMethod?.apply(this, args);
          this.performanceMonitor?.endOperation(operationId, operationName, true);
          return result;
        } catch (error) {
          this.performanceMonitor?.endOperation(
            operationId,
            operationName,
            false,
            error instanceof Error ? error.message : String(error)
          );
          throw error;
        }
      } as any) as T;

      return descriptor;
    };
  }

  /**
   * Get metrics in a time range
   */
  getMetricsInRange(
    operationName: string,
    startTime: number,
    endTime: number
  ): PerformanceMetrics[] {
    const metrics = this.getOperationMetrics(operationName);
    return metrics.filter(
      m => m.startTime >= startTime && m.endTime <= endTime
    );
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    const data = {
      timestamp: Date.now(),
      config: this.config,
      metrics: Object.fromEntries(this.metrics),
      statistics: this.getAllStatistics(),
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Get resource usage statistics
   */
  getResourceUsage(): {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    uptime: number;
  } {
    return {
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      uptime: process.uptime(),
    };
  }
}

/**
 * Performance timer utility function
 */
export function createPerformanceTimer(monitor: PerformanceMonitor, operationName: string) {
  const operationId = `${operationName}_${Date.now()}_${Math.random()}`;

  return {
    start: () => monitor.startOperation(operationId, operationName),
    end: (success: boolean = true, errorMessage?: string) =>
      monitor.endOperation(operationId, operationName, success, errorMessage),
  };
}

/**
 * Async operation wrapper with performance monitoring
 */
export async function withPerformanceMonitoring<T>(
  monitor: PerformanceMonitor,
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  const timer = createPerformanceTimer(monitor, operationName);
  timer.start();

  try {
    const result = await operation();
    timer.end(true);
    return result;
  } catch (error) {
    timer.end(false, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Cache performance monitor
 */
export class CacheMonitor {
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private totalRequests: number = 0;

  recordHit(): void {
    this.hits++;
    this.totalRequests++;
  }

  recordMiss(): void {
    this.misses++;
    this.totalRequests++;
  }

  recordEviction(): void {
    this.evictions++;
  }

  getStats(): CacheStats {
    return {
      size: 0, // Will be set by cache implementation
      hits: this.hits,
      misses: this.misses,
      hitRate: this.totalRequests > 0 ? this.hits / this.totalRequests : 0,
      memoryUsage: 0, // Will be set by cache implementation
    };
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalRequests = 0;
  }
}

export default PerformanceMonitor;