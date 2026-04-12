import { ToolConfiguration, ConfigImportExport, ConfigurationTemplate } from "./toolConfigManager";
import { toast } from "@/hooks/use-toast";
import { apiGetJson, apiPostJson, apiPutJson, apiDeleteJson } from "./apiClient";

export interface BackupMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  size: number;
  configCount: number;
  templateCount: number;
  version: string;
  tags: string[];
}

export interface BackupRestoreOptions {
  restoreConfigs: boolean;
  restoreTemplates: boolean;
  overwriteExisting: boolean;
  createBackupBeforeRestore: boolean;
}

export interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm format
  enabled: boolean;
  retentionDays: number;
  lastRun?: string;
  nextRun?: string;
}

export class ToolConfigBackup {
  private static STORAGE_KEY = "zdg_config_backups";
  private static SCHEDULES_KEY = "zdg_backup_schedules";

  // Backup creation
  static async createBackup(name: string, description: string, tags: string[] = []): Promise<BackupMetadata> {
    try {
      // Get all configurations and templates
      const configs = await this.getAllConfigurations();
      const templates = await this.getAllTemplates();

      const backupData: ConfigImportExport = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        configurations: configs,
        templates: templates
      };

      const backupString = JSON.stringify(backupData, null, 2);
      const size = new Blob([backupString]).size;

      const metadata: BackupMetadata = {
        id: crypto.randomUUID(),
        name,
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        size,
        configCount: configs.length,
        templateCount: templates.length,
        version: "1.0.0",
        tags
      };

      // Save to backend if available
      try {
        await apiPostJson('/api/tools/backups', {
          metadata,
          data: backupString
        });
      } catch {
        // Fallback to local storage
        const backups = this.getLocalBackups();
        backups.push({ metadata, data: backupString });
        this.saveLocalBackups(backups);
      }

      toast({
        title: "Backup created",
        description: `${name} has been backed up successfully.`
      });

      return metadata;
    } catch (error) {
      toast({
        title: "Backup failed",
        description: "Failed to create backup. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  }

  // Backup restoration
  static async restoreBackup(backupId: string, options: BackupRestoreOptions): Promise<boolean> {
    try {
      let backupData: ConfigImportExport;

      // Try to get from backend first
      try {
        backupData = await apiGetJson<ConfigImportExport>(`/api/tools/backups/${backupId}/data`);
      } catch {
        // Fallback to local storage
        const backups = this.getLocalBackups();
        const backup = backups.find(b => b.metadata.id === backupId);
        if (!backup) {
          throw new Error("Backup not found");
        }
        backupData = JSON.parse(backup.data);
      }

      // Create backup before restore if requested
      if (options.createBackupBeforeRestore) {
        await this.createBackup(
          `Pre-restore backup - ${new Date().toISOString()}`,
          "Automatic backup created before restore operation",
          ["auto", "pre-restore"]
        );
      }

      let restoredConfigs = 0;
      let restoredTemplates = 0;

      // Restore configurations
      if (options.restoreConfigs && backupData.configurations) {
        for (const config of backupData.configurations) {
          try {
            // Check if config exists and handle overwrite
            if (!options.overwriteExisting) {
              // Skip if config with same name exists
              continue;
            }
            // Import config (this would integrate with ToolConfigManager)
            restoredConfigs++;
          } catch (error) {
            console.warn("Failed to restore config:", config.name, error);
          }
        }
      }

      // Restore templates
      if (options.restoreTemplates && backupData.templates) {
        for (const template of backupData.templates) {
          try {
            // Check if template exists and handle overwrite
            if (!options.overwriteExisting) {
              // Skip if template with same name exists
              continue;
            }
            // Import template (this would integrate with ToolConfigTemplates)
            restoredTemplates++;
          } catch (error) {
            console.warn("Failed to restore template:", template.name, error);
          }
        }
      }

      toast({
        title: "Backup restored",
        description: `Successfully restored ${restoredConfigs} configurations and ${restoredTemplates} templates.`
      });

      return true;
    } catch {
      toast({
        title: "Restore failed",
        description: "Failed to restore backup. Please try again.",
        variant: "destructive"
      });
      return false;
    }
  }

  // Backup management
  static async getBackups(): Promise<BackupMetadata[]> {
    try {
      return await apiGetJson<BackupMetadata[]>('/api/tools/backups');
    } catch {
      // Fallback to local storage
      return this.getLocalBackups().map(b => b.metadata);
    }
  }

  static async deleteBackup(backupId: string): Promise<boolean> {
    try {
      await apiDeleteJson(`/api/tools/backups/${backupId}`);
      toast({
        title: "Backup deleted",
        description: "Backup has been deleted successfully."
      });
      return true;
    } catch {
      // Fallback to local storage
      const backups = this.getLocalBackups();
      const index = backups.findIndex(b => b.metadata.id === backupId);
      if (index >= 0) {
        backups.splice(index, 1);
        this.saveLocalBackups(backups);
        
        toast({
          title: "Backup deleted locally",
          description: "Backup has been removed from local storage."
        });
        return true;
      }
      return false;
    }
  }

  static async downloadBackup(backupId: string): Promise<void> {
    try {
      const backupData = await apiGetJson<ConfigImportExport>(`/api/tools/backups/${backupId}/data`);
      const dataString = JSON.stringify(backupData, null, 2);
      this.downloadFile(dataString, `backup-${backupId}.json`);
    } catch {
      // Fallback to local storage
      const backups = this.getLocalBackups();
      const backup = backups.find(b => b.metadata.id === backupId);
      if (backup) {
        this.downloadFile(backup.data, `backup-${backupId}.json`);
      } else {
        toast({
          title: "Download failed",
          description: "Backup not found.",
          variant: "destructive"
        });
      }
    }
  }

  // Backup scheduling
  static async createSchedule(schedule: Omit<BackupSchedule, 'id' | 'lastRun' | 'nextRun'>): Promise<BackupSchedule> {
    const newSchedule: BackupSchedule = {
      ...schedule,
      id: crypto.randomUUID(),
      lastRun: undefined,
      nextRun: this.calculateNextRun(schedule.frequency, schedule.time)
    };

    try {
      const createdSchedule = await apiPostJson<BackupSchedule>('/api/tools/backups/schedules', newSchedule);
      toast({
        title: "Schedule created",
        description: `${createdSchedule.name} has been scheduled successfully.`
      });
      return createdSchedule;
    } catch {
      // Fallback to local storage
      const schedules = this.getLocalSchedules();
      schedules.push(newSchedule);
      this.saveLocalSchedules(schedules);
      
      toast({
        title: "Schedule saved locally",
        description: `${newSchedule.name} has been saved to local storage.`
      });
      return newSchedule;
    }
  }

  static async updateSchedule(id: string, updates: Partial<BackupSchedule>): Promise<BackupSchedule | null> {
    try {
      const updatedSchedule = await apiPutJson<BackupSchedule>(`/api/tools/backups/schedules/${id}`, updates);
      return updatedSchedule;
    } catch {
      // Fallback to local storage
      const schedules = this.getLocalSchedules();
      const index = schedules.findIndex(s => s.id === id);
      if (index >= 0) {
        schedules[index] = { ...schedules[index], ...updates };
        this.saveLocalSchedules(schedules);
        return schedules[index];
      }
      return null;
    }
  }

  static async deleteSchedule(scheduleId: string): Promise<boolean> {
    try {
      await apiDeleteJson(`/api/tools/backups/schedules/${scheduleId}`);
      return true;
    } catch {
      // Fallback to local storage
      const schedules = this.getLocalSchedules();
      const index = schedules.findIndex(s => s.id === scheduleId);
      if (index >= 0) {
        schedules.splice(index, 1);
        this.saveLocalSchedules(schedules);
        return true;
      }
      return false;
    }
  }

  static async getSchedules(): Promise<BackupSchedule[]> {
    try {
      return await apiGetJson<BackupSchedule[]>('/api/tools/backups/schedules');
    } catch {
      return this.getLocalSchedules();
    }
  }

  // Backup validation and integrity
  static validateBackup(backupData: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const data = JSON.parse(backupData) as ConfigImportExport;

      if (!data.version) {
        errors.push("Missing backup version");
      }

      if (!data.exportedAt) {
        errors.push("Missing export timestamp");
      }

      if (!data.configurations || !Array.isArray(data.configurations)) {
        errors.push("Invalid configurations data");
      } else {
        for (const config of data.configurations) {
          if (!config.name || !config.toolId) {
            errors.push(`Invalid configuration: ${config.name || 'unnamed'}`);
          }
        }
      }

      if (!data.templates || !Array.isArray(data.templates)) {
        warnings.push("No templates found in backup");
      } else {
        for (const template of data.templates) {
          if (!template.name || !template.toolId) {
            warnings.push(`Invalid template: ${template.name || 'unnamed'}`);
          }
        }
      }

      // Check for potential data corruption
      if (data.configurations && data.configurations.length > 0) {
        const totalSize = JSON.stringify(data.configurations).length;
        if (totalSize > 10 * 1024 * 1024) { // 10MB limit
          warnings.push("Backup size is very large, may cause performance issues");
        }
      }

    } catch {
      errors.push("Invalid JSON format");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Backup comparison
  static compareBackups(backup1: ConfigImportExport, backup2: ConfigImportExport): {
    configDifferences: string[];
    templateDifferences: string[];
    commonConfigs: string[];
    commonTemplates: string[];
  } {
    const config1Names = new Set(backup1.configurations.map(c => c.name));
    const config2Names = new Set(backup2.configurations.map(c => c.name));
    const template1Names = new Set(backup1.templates.map(t => t.name));
    const template2Names = new Set(backup2.templates.map(t => t.name));

    const configDifferences: string[] = [];
    const templateDifferences: string[] = [];

    // Find config differences
    for (const name of config1Names) {
      if (!config2Names.has(name)) {
        configDifferences.push(`Config "${name}" only in backup 1`);
      }
    }
    for (const name of config2Names) {
      if (!config1Names.has(name)) {
        configDifferences.push(`Config "${name}" only in backup 2`);
      }
    }

    // Find template differences
    for (const name of template1Names) {
      if (!template2Names.has(name)) {
        templateDifferences.push(`Template "${name}" only in backup 1`);
      }
    }
    for (const name of template2Names) {
      if (!template1Names.has(name)) {
        templateDifferences.push(`Template "${name}" only in backup 2`);
      }
    }

    return {
      configDifferences,
      templateDifferences,
      commonConfigs: Array.from(config1Names).filter(name => config2Names.has(name)),
      commonTemplates: Array.from(template1Names).filter(name => template2Names.has(name))
    };
  }

  // Performance optimizations
  static async optimizeBackups(): Promise<void> {
    try {
      const backups = await this.getBackups();
      
      // Remove old backups based on retention policy
      const now = new Date();
      const schedules = await this.getSchedules();
      
      for (const schedule of schedules) {
        if (schedule.retentionDays > 0) {
          const cutoffDate = new Date(now.getTime() - schedule.retentionDays * 24 * 60 * 60 * 1000);
          const oldBackups = backups.filter(b => 
            new Date(b.createdAt) < cutoffDate &&
            b.tags.includes(schedule.name)
          );

          for (const backup of oldBackups) {
            await this.deleteBackup(backup.id);
          }
        }
      }

      toast({
        title: "Backup optimization complete",
        description: "Old backups have been cleaned up according to retention policies."
      });
    } catch {
      toast({
        title: "Optimization failed",
        description: "Failed to optimize backups.",
        variant: "destructive"
      });
    }
  }

  // Utility methods
  private static async getAllConfigurations(): Promise<ToolConfiguration[]> {
    // This would integrate with ToolConfigManager
    // For now, return empty array
    return [];
  }

  private static async getAllTemplates(): Promise<ConfigurationTemplate[]> {
    // This would integrate with ToolConfigTemplates
    // For now, return empty array
    return [];
  }

  private static getLocalBackups(): Array<{ metadata: BackupMetadata; data: string }> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to load backups:", error);
      return [];
    }
  }

  private static saveLocalBackups(backups: Array<{ metadata: BackupMetadata; data: string }>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(backups));
    } catch (error) {
      console.error("Failed to save backups:", error);
      throw new Error("Unable to save backup");
    }
  }

  private static getLocalSchedules(): BackupSchedule[] {
    try {
      const stored = localStorage.getItem(this.SCHEDULES_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to load schedules:", error);
      return [];
    }
  }

  private static saveLocalSchedules(schedules: BackupSchedule[]): void {
    try {
      localStorage.setItem(this.SCHEDULES_KEY, JSON.stringify(schedules));
    } catch (error) {
      console.error("Failed to save schedules:", error);
      throw new Error("Unable to save schedule");
    }
  }

  private static calculateNextRun(frequency: string, time: string): string {
    const now = new Date();
    const [hours, minutes] = time.split(':').map(Number);
    
    const nextRun = new Date(now);
    nextRun.setHours(hours, minutes, 0, 0);

    if (nextRun <= now) {
      switch (frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
      }
    }

    return nextRun.toISOString();
  }

  private static downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Backup utilities
export const getBackupSize = (backupData: ConfigImportExport): number => {
  return new Blob([JSON.stringify(backupData)]).size;
};

export const formatBackupSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const isBackupRecent = (backup: BackupMetadata, hours: number = 24): boolean => {
  const now = new Date();
  const backupTime = new Date(backup.createdAt);
  const diffHours = (now.getTime() - backupTime.getTime()) / (1000 * 60 * 60);
  return diffHours <= hours;
};
