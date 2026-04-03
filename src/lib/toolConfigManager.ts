import { toast } from "@/hooks/use-toast";

// Core data models for tool configuration management
export interface ToolConfiguration {
  id: string;
  toolId: number;
  name: string;
  description: string;
  settings: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  version: string;
  isShared?: boolean;
  teamId?: string;
  usageCount?: number;
  lastUsedAt?: string;
}

export interface ToolConfigMetadata {
  id: string;
  toolId: number;
  name: string;
  description: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  version: string;
}

export interface ConfigurationTemplate {
  id: string;
  name: string;
  description: string;
  toolId: number;
  settings: Record<string, unknown>;
  tags: string[];
  isPublic: boolean;
}

export interface ConfigImportExport {
  version: string;
  exportedAt: string;
  configurations: ToolConfiguration[];
  templates: ConfigurationTemplate[];
}

// Configuration validation and defaults
export const DEFAULT_CONFIG_VERSION = "1.0.0";

export const createDefaultConfiguration = (toolId: number, name: string): ToolConfiguration => ({
  id: crypto.randomUUID(),
  toolId,
  name,
  description: "Default configuration",
  settings: {},
  isDefault: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: [],
  version: DEFAULT_CONFIG_VERSION,
});

export class ToolConfigManager {
  private static STORAGE_KEY = "zdg_tool_configs";

  // Storage operations
  private static getStoredConfigs(): ToolConfiguration[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      
      const configs = JSON.parse(stored) as ToolConfiguration[];
      // Validate and migrate configs if needed
      return configs.map(config => this.validateAndMigrateConfig(config));
    } catch (error) {
      console.error("Failed to load tool configurations:", error);
      return [];
    }
  }

  private static saveConfigs(configs: ToolConfiguration[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
    } catch (error) {
      console.error("Failed to save tool configurations:", error);
      throw new Error("Unable to save configuration");
    }
  }

  private static validateAndMigrateConfig(config: ToolConfiguration): ToolConfiguration {
    // Ensure all required fields exist
    const validated: ToolConfiguration = {
      ...createDefaultConfiguration(config.toolId, config.name),
      ...config,
      updatedAt: config.updatedAt || config.createdAt || new Date().toISOString(),
      version: config.version || DEFAULT_CONFIG_VERSION,
    };

    // Migrate old format if needed
    if (!validated.id) {
      validated.id = crypto.randomUUID();
    }

    return validated;
  }

  // CRUD Operations
  static async saveConfiguration(config: Omit<ToolConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<ToolConfiguration> {
    const configs = this.getStoredConfigs();
    const existingIndex = configs.findIndex(c => c.toolId === config.toolId && c.name === config.name);
    
    const newConfig: ToolConfiguration = {
      ...config,
      id: existingIndex >= 0 ? configs[existingIndex].id : crypto.randomUUID(),
      createdAt: existingIndex >= 0 ? configs[existingIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      configs[existingIndex] = newConfig;
    } else {
      configs.push(newConfig);
    }

    this.saveConfigs(configs);
    toast({
      title: "Configuration saved",
      description: `${config.name} has been saved successfully.`,
    });

    return newConfig;
  }

  static async loadConfiguration(id: string): Promise<ToolConfiguration | null> {
    const configs = this.getStoredConfigs();
    const config = configs.find(c => c.id === id);
    
    if (!config) {
      toast({
        title: "Configuration not found",
        description: "The requested configuration could not be loaded.",
        variant: "destructive",
      });
      return null;
    }

    return config;
  }

  static async loadToolConfigurations(toolId: number): Promise<ToolConfiguration[]> {
    const configs = this.getStoredConfigs();
    return configs.filter(c => c.toolId === toolId).sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  static async deleteConfiguration(id: string): Promise<boolean> {
    const configs = this.getStoredConfigs();
    const index = configs.findIndex(c => c.id === id);
    
    if (index === -1) {
      toast({
        title: "Configuration not found",
        description: "The configuration could not be deleted.",
        variant: "destructive",
      });
      return false;
    }

    // Prevent deletion of default configurations
    if (configs[index].isDefault) {
      toast({
        title: "Cannot delete default configuration",
        description: "Default configurations cannot be deleted.",
        variant: "destructive",
      });
      return false;
    }

    configs.splice(index, 1);
    this.saveConfigs(configs);

    toast({
      title: "Configuration deleted",
      description: "The configuration has been removed successfully.",
    });

    return true;
  }

  static async setDefaultConfiguration(id: string): Promise<boolean> {
    const configs = this.getStoredConfigs();
    const configIndex = configs.findIndex(c => c.id === id);
    
    if (configIndex === -1) {
      toast({
        title: "Configuration not found",
        description: "Cannot set as default - configuration not found.",
        variant: "destructive",
      });
      return false;
    }

    const config = configs[configIndex];
    const toolConfigs = configs.filter(c => c.toolId === config.toolId);
    
    // Remove default flag from all configs for this tool
    toolConfigs.forEach(c => { c.isDefault = false; });
    
    // Set the selected config as default
    config.isDefault = true;
    config.updatedAt = new Date().toISOString();

    this.saveConfigs(configs);

    toast({
      title: "Default configuration updated",
      description: `${config.name} is now the default configuration for this tool.`,
    });

    return true;
  }

  static async getToolDefaultConfiguration(toolId: number): Promise<ToolConfiguration | null> {
    const configs = this.getStoredConfigs();
    return configs.find(c => c.toolId === toolId && c.isDefault) || null;
  }

  // Template and sharing operations
  static async exportConfiguration(id: string): Promise<string> {
    const config = await this.loadConfiguration(id);
    if (!config) {
      throw new Error("Configuration not found for export");
    }

    const exportData: ConfigImportExport = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      configurations: [config],
      templates: [],
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importConfiguration(exportData: string): Promise<boolean> {
    try {
      const data: ConfigImportExport = JSON.parse(exportData);
      
      if (!data.configurations || data.configurations.length === 0) {
        throw new Error("No configurations found in import data");
      }

      const configs = this.getStoredConfigs();
      let importedCount = 0;

      for (const config of data.configurations) {
        // Check if configuration already exists
        const exists = configs.some(c => c.toolId === config.toolId && c.name === config.name);
        
        if (!exists) {
          const newConfig = {
            ...config,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          configs.push(newConfig);
          importedCount++;
        }
      }

      this.saveConfigs(configs);

      toast({
        title: "Configuration imported",
        description: `${importedCount} configuration(s) have been imported successfully.`,
      });

      return true;
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import failed",
        description: "Invalid configuration data. Please check the file format.",
        variant: "destructive",
      });
      return false;
    }
  }

  static async exportAllConfigurations(): Promise<string> {
    const configs = this.getStoredConfigs();
    
    const exportData: ConfigImportExport = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      configurations: configs,
      templates: [],
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importAllConfigurations(exportData: string): Promise<boolean> {
    try {
      const data: ConfigImportExport = JSON.parse(exportData);
      
      if (!data.configurations) {
        throw new Error("No configurations found in import data");
      }

      const configs = this.getStoredConfigs();
      const existingConfigs = new Set(configs.map(c => `${c.toolId}-${c.name}`));
      let importedCount = 0;

      for (const config of data.configurations) {
        const key = `${config.toolId}-${config.name}`;
        if (!existingConfigs.has(key)) {
          const newConfig = {
            ...config,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          configs.push(newConfig);
          importedCount++;
        }
      }

      this.saveConfigs(configs);

      toast({
        title: "Configurations imported",
        description: `${importedCount} configuration(s) have been imported successfully.`,
      });

      return true;
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import failed",
        description: "Invalid configuration data. Please check the file format.",
        variant: "destructive",
      });
      return false;
    }
  }

  // Utility methods
  static async getConfigurationMetadata(toolId: number): Promise<ToolConfigMetadata[]> {
    const configs = await this.loadToolConfigurations(toolId);
    return configs.map(c => ({
      id: c.id,
      toolId: c.toolId,
      name: c.name,
      description: c.description,
      isDefault: c.isDefault,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      tags: c.tags,
      version: c.version,
    }));
  }

  static async searchConfigurations(query: string, toolId?: number): Promise<ToolConfiguration[]> {
    const configs = this.getStoredConfigs();
    const filtered = configs.filter(c => {
      const matchesTool = !toolId || c.toolId === toolId;
      const searchText = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase();
      const matchesQuery = !query || searchText.includes(query.toLowerCase());
      return matchesTool && matchesQuery;
    });

    return filtered.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }

  static async clearAllConfigurations(): Promise<void> {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      toast({
        title: "All configurations cleared",
        description: "All tool configurations have been removed.",
      });
    } catch (error) {
      console.error("Failed to clear configurations:", error);
      throw new Error("Unable to clear configurations");
    }
  }
}
