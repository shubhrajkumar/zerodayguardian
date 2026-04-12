import { ToolConfiguration } from "./toolConfigManager";
import { toast } from "@/hooks/use-toast";
import { apiGetJson, apiPostJson, apiDeleteJson } from "./apiClient";

export interface ConfigurationVersion {
  id: string;
  configId: string;
  version: string;
  description: string;
  changes: {
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    fields: string[];
  };
  createdAt: string;
  createdBy: string;
  metadata: {
    commitMessage?: string;
    tags: string[];
    isBreaking: boolean;
  };
}

export interface VersionHistory {
  configId: string;
  versions: ConfigurationVersion[];
  currentVersion: string;
  totalVersions: number;
}

export interface VersionComparison {
  version1: ConfigurationVersion;
  version2: ConfigurationVersion;
  differences: {
    added: string[];
    removed: string[];
    modified: Array<{
      field: string;
      oldValue: unknown;
      newValue: unknown;
    }>;
  };
  summary: string;
}

export interface RollbackOptions {
  targetVersion: string;
  createNewVersion: boolean;
  commitMessage?: string;
}

export class ToolConfigVersioning {
  private static STORAGE_KEY = "zdg_config_versions";

  // Version creation
  static async createVersion(
    configId: string, 
    version: string, 
    description: string, 
    changes: {
      before: Record<string, unknown>;
      after: Record<string, unknown>;
      fields: string[];
    },
    metadata?: {
      commitMessage?: string;
      tags: string[];
      isBreaking: boolean;
    }
  ): Promise<ConfigurationVersion> {
    const versionData: Omit<ConfigurationVersion, 'id' | 'createdAt' | 'createdBy'> = {
      configId,
      version,
      description,
      changes,
      metadata: metadata || {
        commitMessage: undefined,
        tags: [],
        isBreaking: false
      }
    };

    try {
      const createdVersion = await apiPostJson<ConfigurationVersion>('/api/tools/versions', versionData);
      
      toast({
        title: "Version created",
        description: `Version ${version} has been created successfully.`
      });

      return createdVersion;
    } catch {
      // Fallback to local storage
      const versions = this.getLocalVersions(configId);
      const newVersion: ConfigurationVersion = {
        ...versionData,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        createdBy: "local-user"
      };
      
      versions.push(newVersion);
      this.saveLocalVersions(configId, versions);
      
      toast({
        title: "Version saved locally",
        description: `Version ${version} has been saved to local storage.`
      });

      return newVersion;
    }
  }

  // Version retrieval
  static async getVersions(configId: string): Promise<ConfigurationVersion[]> {
    try {
      return await apiGetJson<ConfigurationVersion[]>(`/api/tools/configs/${configId}/versions`);
    } catch {
      return this.getLocalVersions(configId);
    }
  }

  static async getVersion(configId: string, versionId: string): Promise<ConfigurationVersion | null> {
    try {
      return await apiGetJson<ConfigurationVersion>(`/api/tools/configs/${configId}/versions/${versionId}`);
    } catch {
      const versions = this.getLocalVersions(configId);
      return versions.find(v => v.id === versionId) || null;
    }
  }

  // Version comparison
  static async compareVersions(
    configId: string, 
    version1Id: string, 
    version2Id: string
  ): Promise<VersionComparison | null> {
    try {
      return await apiGetJson<VersionComparison>(
        `/api/tools/configs/${configId}/versions/compare?version1=${version1Id}&version2=${version2Id}`
      );
    } catch {
      const versions = this.getLocalVersions(configId);
      const version1 = versions.find(v => v.id === version1Id);
      const version2 = versions.find(v => v.id === version2Id);

      if (!version1 || !version2) return null;

      return this.compareVersionData(version1, version2);
    }
  }

  static compareVersionData(version1: ConfigurationVersion, version2: ConfigurationVersion): VersionComparison {
    const before = version1.changes.after;
    const after = version2.changes.after;

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const differences = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as Array<{ field: string; oldValue: unknown; newValue: unknown }>
    };

    for (const key of allKeys) {
      const oldValue = before[key];
      const newValue = after[key];

      if (!(key in before)) {
        differences.added.push(key);
      } else if (!(key in after)) {
        differences.removed.push(key);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        differences.modified.push({ field: key, oldValue, newValue });
      }
    }

    const summary = this.generateComparisonSummary(differences);

    return {
      version1,
      version2,
      differences,
      summary
    };
  }

  // Version rollback
  static async rollback(
    configId: string, 
    options: RollbackOptions
  ): Promise<ToolConfiguration | null> {
    try {
      const rollbackData = await apiPostJson<ToolConfiguration>(
        `/api/tools/configs/${configId}/versions/rollback`,
        options
      );

      toast({
        title: "Configuration rolled back",
        description: `Rolled back to version ${options.targetVersion}`
      });

      return rollbackData;
    } catch {
      // Fallback to local rollback
      const versions = this.getLocalVersions(configId);
      const targetVersion = versions.find(v => v.version === options.targetVersion);
      
      if (!targetVersion) {
        toast({
          title: "Rollback failed",
          description: "Target version not found.",
          variant: "destructive"
        });
        return null;
      }

      // Create new configuration from target version
      const newConfig: ToolConfiguration = {
        id: crypto.randomUUID(),
        toolId: 1, // This would come from the original config
        name: `Rollback to ${options.targetVersion}`,
        description: options.commitMessage || `Rollback to version ${options.targetVersion}`,
        settings: targetVersion.changes.after,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: ["rollback"],
        version: "1.0.0"
      };

      toast({
        title: "Configuration rolled back locally",
        description: `Rolled back to version ${options.targetVersion}`
      });

      return newConfig;
    }
  }

  // Version history
  static async getVersionHistory(configId: string): Promise<VersionHistory | null> {
    try {
      return await apiGetJson<VersionHistory>(`/api/tools/configs/${configId}/versions/history`);
    } catch {
      const versions = this.getLocalVersions(configId);
      if (versions.length === 0) return null;

      const currentVersion = versions[versions.length - 1];
      return {
        configId,
        versions,
        currentVersion: currentVersion.version,
        totalVersions: versions.length
      };
    }
  }

  // Version management
  static async deleteVersion(configId: string, versionId: string): Promise<boolean> {
    try {
      await apiDeleteJson(`/api/tools/configs/${configId}/versions/${versionId}`);
      toast({
        title: "Version deleted",
        description: "Version has been deleted successfully."
      });
      return true;
    } catch {
      // Fallback to local storage
      const versions = this.getLocalVersions(configId);
      const index = versions.findIndex(v => v.id === versionId);
      if (index >= 0) {
        versions.splice(index, 1);
        this.saveLocalVersions(configId, versions);
        
        toast({
          title: "Version deleted locally",
          description: "Version has been removed from local storage."
        });
        return true;
      }
      return false;
    }
  }

  static async getBreakingChanges(configId: string): Promise<ConfigurationVersion[]> {
    try {
      return await apiGetJson<ConfigurationVersion[]>(`/api/tools/configs/${configId}/versions/breaking`);
    } catch {
      const versions = this.getLocalVersions(configId);
      return versions.filter(v => v.metadata.isBreaking);
    }
  }

  // Version validation
  static validateVersion(version: string): boolean {
    // Semantic versioning pattern: MAJOR.MINOR.PATCH
    const semverPattern = /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?(\+[a-zA-Z0-9-]+)?$/;
    return semverPattern.test(version);
  }

  static generateNextVersion(currentVersion: string, type: 'patch' | 'minor' | 'major' = 'patch'): string {
    if (!this.validateVersion(currentVersion)) {
      return '1.0.0';
    }

    // Remove 'v' prefix if present
    const cleanVersion = currentVersion.replace(/^v/, '');
    const [major, minor, patch] = cleanVersion.split('.').map(Number);

    switch (type) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  // Bulk operations
  static async exportVersionHistory(configId: string): Promise<string> {
    const versions = await this.getVersions(configId);
    
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      configId,
      versions
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importVersionHistory(configId: string, exportData: string): Promise<boolean> {
    try {
      const data = JSON.parse(exportData);
      if (!data.versions || !Array.isArray(data.versions)) {
        throw new Error("Invalid version history data");
      }

      let importedCount = 0;
      for (const version of data.versions) {
        try {
          await this.createVersion(
            configId,
            version.version,
            version.description,
            version.changes,
            version.metadata
          );
          importedCount++;
        } catch (error) {
          console.warn("Failed to import version:", version.version, error);
        }
      }

      toast({
        title: "Version history imported",
        description: `${importedCount} versions have been imported successfully.`
      });

      return true;
    } catch {
      toast({
        title: "Import failed",
        description: "Invalid version history data. Please check the file format.",
        variant: "destructive"
      });
      return false;
    }
  }

  // Utility methods
  private static getLocalVersions(configId: string): ConfigurationVersion[] {
    try {
      const stored = localStorage.getItem(`${this.STORAGE_KEY}_${configId}`);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to load versions:", error);
      return [];
    }
  }

  private static saveLocalVersions(configId: string, versions: ConfigurationVersion[]): void {
    try {
      localStorage.setItem(`${this.STORAGE_KEY}_${configId}`, JSON.stringify(versions));
    } catch (error) {
      console.error("Failed to save versions:", error);
      throw new Error("Unable to save version");
    }
  }

  private static generateComparisonSummary(differences: {
    added: string[];
    removed: string[];
    modified: Array<{ field: string; oldValue: unknown; newValue: unknown }>
  }): string {
    const addedCount = differences.added.length;
    const removedCount = differences.removed.length;
    const modifiedCount = differences.modified.length;

    const parts: string[] = [];
    if (addedCount > 0) parts.push(`${addedCount} field(s) added`);
    if (removedCount > 0) parts.push(`${removedCount} field(s) removed`);
    if (modifiedCount > 0) parts.push(`${modifiedCount} field(s) modified`);

    return parts.length > 0 ? parts.join(', ') : 'No differences detected';
  }
}

// Version utilities
export const formatVersion = (version: string): string => {
  return version.startsWith('v') ? version : `v${version}`;
};

export const compareVersions = (v1: string, v2: string): number => {
  const cleanV1 = v1.replace(/^v/, '');
  const cleanV2 = v2.replace(/^v/, '');
  
  const [major1, minor1, patch1] = cleanV1.split('.').map(Number);
  const [major2, minor2, patch2] = cleanV2.split('.').map(Number);

  if (major1 !== major2) return major1 - major2;
  if (minor1 !== minor2) return minor1 - minor2;
  return patch1 - patch2;
};

export const isVersionBreaking = (version: string): boolean => {
  return version.includes('-breaking') || version.includes('-major');
};
