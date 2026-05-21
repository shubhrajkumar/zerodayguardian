import { toast } from "@/hooks/use-toast";

export interface PerformanceMetrics {
  configId: string;
  loadTime: number;
  memoryUsage: number;
  cpuUsage: number;
  timestamp: string;
  operation: 'load' | 'save' | 'delete' | 'import' | 'export' | 'health-check';
}

export interface SystemHealth {
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  storageUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  performanceScore: number;
  lastUpdated: string;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: PerformanceMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  enabled: boolean;
}

export interface DashboardStats {
  totalConfigs: number;
  totalTemplates: number;
  totalBackups: number;
  averageLoadTime: number;
  systemHealth: SystemHealth;
  recentActivity: string[];
}

export class ToolConfigMonitoring {
  private static metrics: PerformanceMetrics[] = [];
  private static alertRules: AlertRule[] = [];
  private static healthCheckInterval: NodeJS.Timeout | null = null;

  // Performance tracking
  static trackOperation(configId: string, operation: PerformanceMetrics['operation'], startTime: number): void {
    const endTime = performance.now();
    const loadTime = endTime - startTime;
    
    // Get memory usage (approximate)
    const perfWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
      };
    };
    const memoryUsage = perfWithMemory.memory ? perfWithMemory.memory.usedJSHeapSize : 0;
    
    const metric: PerformanceMetrics = {
      configId,
      loadTime,
      memoryUsage,
      cpuUsage: 0, // Would need additional implementation for CPU tracking
      timestamp: new Date().toISOString(),
      operation
    };

    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }

    // Check alert rules
    this.checkAlertRules(metric);
  }

  // System health monitoring
  static async getSystemHealth(): Promise<SystemHealth> {
    const perfWithMemory = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };
    const memoryInfo = perfWithMemory.memory || {
      usedJSHeapSize: 0,
      totalJSHeapSize: 100000000, // 100MB default
      jsHeapSizeLimit: 100000000
    };

    const memoryUsage = {
      used: memoryInfo.usedJSHeapSize,
      total: memoryInfo.totalJSHeapSize,
      percentage: (memoryInfo.usedJSHeapSize / memoryInfo.totalJSHeapSize) * 100
    };

    // Calculate storage usage (approximate)
    const storageUsage = this.calculateStorageUsage();

    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore();

    const health: SystemHealth = {
      memoryUsage,
      storageUsage,
      performanceScore,
      lastUpdated: new Date().toISOString()
    };

    return health;
  }

  private static calculateStorageUsage() {
    try {
      const total = 10 * 1024 * 1024; // 10MB default limit
      let used = 0;

      // Calculate localStorage usage
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          used += localStorage[key].length * 2; // Approximate bytes
        }
      }

      // Calculate sessionStorage usage
      for (const key in sessionStorage) {
        if (Object.prototype.hasOwnProperty.call(sessionStorage, key)) {
          used += sessionStorage[key].length * 2; // Approximate bytes
        }
      }

      return {
        used,
        total,
        percentage: (used / total) * 100
      };
    } catch (error) {
      return { used: 0, total: 10000000, percentage: 0 };
    }
  }

  private static calculatePerformanceScore(): number {
    if (this.metrics.length === 0) return 100;

    const recentMetrics = this.metrics.slice(-100);
    const avgLoadTime = recentMetrics.reduce((sum, m) => sum + m.loadTime, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;

    // Score calculation (0-100)
    let score = 100;

    // Deduct points for slow load times
    if (avgLoadTime > 1000) score -= 20;
    else if (avgLoadTime > 500) score -= 10;
    else if (avgLoadTime > 200) score -= 5;

    // Deduct points for high memory usage
    if (avgMemoryUsage > 50 * 1024 * 1024) score -= 20; // > 50MB
    else if (avgMemoryUsage > 25 * 1024 * 1024) score -= 10; // > 25MB
    else if (avgMemoryUsage > 10 * 1024 * 1024) score -= 5; // > 10MB

    return Math.max(0, Math.min(100, score));
  }

  // Alert management
  static addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = crypto.randomUUID();
    this.alertRules.push({ ...rule, id });
    return id;
  }

  static removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  static updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      return true;
    }
    return false;
  }

  private static checkAlertRules(metric: PerformanceMetrics): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      if (rule.condition(metric)) {
        this.triggerAlert(rule, metric);
      }
    }
  }

  private static triggerAlert(rule: AlertRule, metric: PerformanceMetrics): void {
    const message = rule.message
      .replace('{configId}', metric.configId)
      .replace('{loadTime}', metric.loadTime.toString())
      .replace('{memoryUsage}', (metric.memoryUsage / 1024 / 1024).toFixed(2));

    // Show toast notification
    toast({
      title: `Alert: ${rule.name}`,
      description: message,
      variant: rule.severity === 'critical' ? 'destructive' : 'default'
    });

    // Log to console
    console.warn(`[ALERT ${rule.severity.toUpperCase()}] ${rule.name}: ${message}`);
  }

  // Dashboard statistics
  static async getDashboardStats(): Promise<DashboardStats> {
    const totalConfigs = 0;
    const totalTemplates = 0;
    const totalBackups = 0;
    const averageLoadTime = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / this.metrics.length 
      : 0;
    const systemHealth = await this.getSystemHealth();
    const recentActivity = ["No verified data."];

    return {
      totalConfigs,
      totalTemplates,
      totalBackups,
      averageLoadTime,
      systemHealth,
      recentActivity
    };
  }

  // Performance optimization suggestions
  static async getOptimizationSuggestions(): Promise<string[]> {
    const suggestions: string[] = [];
    const health = await this.getSystemHealth();

    if (health.memoryUsage.percentage > 80) {
      suggestions.push('High memory usage detected. Consider clearing unused configurations.');
    }

    if (this.metrics.length > 500) {
      suggestions.push('Large number of metrics stored. Consider clearing old performance data.');
    }

    const avgLoadTime = this.metrics.length > 0 
      ? this.metrics.reduce((sum, m) => sum + m.loadTime, 0) / this.metrics.length 
      : 0;

    if (avgLoadTime > 1000) {
      suggestions.push('Slow configuration loading detected. Consider optimizing configuration size.');
    }

    if (suggestions.length === 0) {
      suggestions.push('System performance is optimal.');
    }

    return suggestions;
  }

  // Health check automation
  static startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const health = await this.getSystemHealth();
      
      // Check for critical conditions
      if (health.memoryUsage.percentage > 90) {
        this.triggerAlert({
          id: 'memory-critical',
          name: 'Memory Usage Critical',
          condition: () => true,
          severity: 'critical',
          message: 'Memory usage is critically high. System performance may be degraded.',
          enabled: true
        }, {
          configId: 'system',
          loadTime: 0,
          memoryUsage: health.memoryUsage.used,
          cpuUsage: 0,
          timestamp: new Date().toISOString(),
          operation: 'health-check'
        });
      }
    }, intervalMs);
  }

  static stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Data export for monitoring
  static exportMetrics(): string {
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      metrics: this.metrics,
      alertRules: this.alertRules,
      totalMetrics: this.metrics.length
    };

    return JSON.stringify(exportData, null, 2);
  }

  static clearMetrics(): void {
    this.metrics = [];
    toast({
      title: "Performance metrics cleared",
      description: "All performance metrics have been removed."
    });
  }

  // Built-in alert rules
  static setupDefaultAlertRules(): void {
    // High memory usage alert
    this.addAlertRule({
      name: 'High Memory Usage',
      condition: (metric) => metric.memoryUsage > 50 * 1024 * 1024, // > 50MB
      severity: 'medium',
      message: 'Configuration {configId} is using high memory ({memoryUsage} bytes)',
      enabled: true
    });

    // Slow load time alert
    this.addAlertRule({
      name: 'Slow Configuration Load',
      condition: (metric) => metric.loadTime > 2000, // > 2 seconds
      severity: 'medium',
      message: 'Configuration {configId} took {loadTime}ms to load',
      enabled: true
    });

    // Frequent operations alert
    this.addAlertRule({
      name: 'High Configuration Activity',
      condition: (metric) => {
        const recentOps = this.metrics.filter(m => 
          m.timestamp > new Date(Date.now() - 60000).toISOString() && // Last minute
          m.configId === metric.configId
        );
        return recentOps.length > 20; // More than 20 operations per minute
      },
      severity: 'low',
      message: 'High activity detected for configuration {configId}',
      enabled: true
    });
  }
}

// Performance utilities
export const measurePerformance = <T>(operation: () => T, configId: string, operationType: PerformanceMetrics['operation']): T => {
  const startTime = performance.now();
  const result = operation();
  
  ToolConfigMonitoring.trackOperation(configId, operationType, startTime);
  return result;
};

export const measureAsyncPerformance = async <T>(operation: () => Promise<T>, configId: string, operationType: PerformanceMetrics['operation']): Promise<T> => {
  const startTime = performance.now();
  const result = await operation();
  
  ToolConfigMonitoring.trackOperation(configId, operationType, startTime);
  return result;
};

export const getPerformanceReport = (): {
  totalOperations: number;
  averageLoadTime: number;
  slowestOperation: PerformanceMetrics | null;
  fastestOperation: PerformanceMetrics | null;
  memoryUsageTrend: number[];
} => {
  const totalOperations = ToolConfigMonitoring['metrics'].length;
  const averageLoadTime = totalOperations > 0 
    ? ToolConfigMonitoring['metrics'].reduce((sum, m) => sum + m.loadTime, 0) / totalOperations 
    : 0;

  const sortedByLoadTime = ToolConfigMonitoring['metrics'].sort((a, b) => a.loadTime - b.loadTime);
  const slowestOperation = sortedByLoadTime[sortedByLoadTime.length - 1] || null;
  const fastestOperation = sortedByLoadTime[0] || null;

  // Memory usage trend (last 10 operations)
  const recentMetrics = ToolConfigMonitoring['metrics'].slice(-10);
  const memoryUsageTrend = recentMetrics.map(m => m.memoryUsage / 1024 / 1024); // Convert to MB

  return {
    totalOperations,
    averageLoadTime,
    slowestOperation,
    fastestOperation,
    memoryUsageTrend
  };
};
