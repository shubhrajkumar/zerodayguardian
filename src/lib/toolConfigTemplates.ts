import { ToolConfiguration, ConfigurationTemplate } from "./toolConfigManager";
import { apiGetJson, apiPostJson, apiPutJson, apiDeleteJson } from "./apiClient";
import { toast } from "@/hooks/use-toast";

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

export interface TemplateUsageStats {
  templateId: string;
  usageCount: number;
  lastUsed: string;
  rating?: number;
  reviews?: number;
}

export class ToolConfigTemplates {
  private static STORAGE_KEY = "zdg_config_templates";

  // Template categories
  static readonly CATEGORIES: TemplateCategory[] = [
    { id: "security", name: "Security", description: "Security-focused configurations", icon: "🔒", color: "#ef4444" },
    { id: "performance", name: "Performance", description: "Performance optimization templates", icon: "⚡", color: "#f59e0b" },
    { id: "debugging", name: "Debugging", description: "Debugging and troubleshooting templates", icon: "🐛", color: "#3b82f6" },
    { id: "production", name: "Production", description: "Production-ready configurations", icon: "🚀", color: "#10b981" },
    { id: "development", name: "Development", description: "Development and testing templates", icon: "🛠️", color: "#8b5cf6" },
    { id: "compliance", name: "Compliance", description: "Compliance and audit templates", icon: "📋", color: "#64748b" }
  ];

  // Built-in templates
  static readonly BUILTIN_TEMPLATES: ConfigurationTemplate[] = [
    {
      id: "security-hardened",
      name: "Security Hardened",
      description: "High-security configuration with strict settings",
      toolId: 1,
      settings: {
        securityLevel: "high",
        encryption: true,
        auditLogging: true,
        rateLimiting: true,
        timeout: 30000
      },
      tags: ["security", "hardened", "production"],
      isPublic: true
    },
    {
      id: "performance-optimized",
      name: "Performance Optimized",
      description: "Optimized for maximum performance and throughput",
      toolId: 1,
      settings: {
        cacheSize: "large",
        parallelism: 8,
        memoryLimit: "unlimited",
        timeout: 60000
      },
      tags: ["performance", "optimized", "production"],
      isPublic: true
    },
    {
      id: "debug-detailed",
      name: "Debug Detailed",
      description: "Detailed debugging with verbose logging",
      toolId: 1,
      settings: {
        debugMode: true,
        verboseLogging: true,
        stackTraces: true,
        profiling: true
      },
      tags: ["debug", "verbose", "development"],
      isPublic: true
    },
    {
      id: "minimal",
      name: "Minimal Setup",
      description: "Minimal configuration for basic functionality",
      toolId: 1,
      settings: {
        minimalMode: true,
        features: ["basic"]
      },
      tags: ["minimal", "basic", "starter"],
      isPublic: true
    }
  ];

  // Template management
  static async getTemplates(toolId?: number): Promise<ConfigurationTemplate[]> {
    try {
      // Try to get from backend first
      const backendTemplates = await apiGetJson<ConfigurationTemplate[]>(`/api/tools/templates${toolId ? `?toolId=${toolId}` : ''}`);
      return backendTemplates;
    } catch {
      // Fallback to local storage
      const localTemplates = this.getLocalTemplates();
      const filtered = toolId ? localTemplates.filter(t => t.toolId === toolId) : localTemplates;
      
      // Add built-in templates if none exist locally
      if (filtered.length === 0) {
        return this.BUILTIN_TEMPLATES.filter(t => !toolId || t.toolId === toolId);
      }
      
      return filtered;
    }
  }

  static async createTemplate(template: Omit<ConfigurationTemplate, 'id'>): Promise<ConfigurationTemplate> {
    try {
      const createdTemplate = await apiPostJson<ConfigurationTemplate>('/api/tools/templates', template);
      toast({
        title: "Template created",
        description: `${template.name} has been created successfully.`
      });
      return createdTemplate;
    } catch {
      // Fallback to local storage
      const localTemplates = this.getLocalTemplates();
      const newTemplate: ConfigurationTemplate = {
        ...template,
        id: crypto.randomUUID()
      };
      localTemplates.push(newTemplate);
      this.saveLocalTemplates(localTemplates);
      
      toast({
        title: "Template saved locally",
        description: `${template.name} has been saved to local storage.`
      });
      return newTemplate;
    }
  }

  static async updateTemplate(id: string, updates: Partial<ConfigurationTemplate>): Promise<ConfigurationTemplate | null> {
    try {
      const updatedTemplate = await apiPutJson<ConfigurationTemplate>(`/api/tools/templates/${id}`, updates);
      toast({
        title: "Template updated",
        description: "Template has been updated successfully."
      });
      return updatedTemplate;
    } catch {
      // Fallback to local storage
      const localTemplates = this.getLocalTemplates();
      const index = localTemplates.findIndex(t => t.id === id);
      if (index >= 0) {
        localTemplates[index] = { ...localTemplates[index], ...updates };
        this.saveLocalTemplates(localTemplates);
        
        toast({
          title: "Template updated locally",
          description: "Template has been updated in local storage."
        });
        return localTemplates[index];
      }
      return null;
    }
  }

  static async deleteTemplate(id: string): Promise<boolean> {
    try {
      await apiDeleteJson(`/api/tools/templates/${id}`);
      toast({
        title: "Template deleted",
        description: "Template has been deleted successfully."
      });
      return true;
    } catch {
      // Fallback to local storage
      const localTemplates = this.getLocalTemplates();
      const index = localTemplates.findIndex(t => t.id === id);
      if (index >= 0) {
        localTemplates.splice(index, 1);
        this.saveLocalTemplates(localTemplates);
        
        toast({
          title: "Template deleted locally",
          description: "Template has been removed from local storage."
        });
        return true;
      }
      return false;
    }
  }

  // Template application
  static async applyTemplate(template: ConfigurationTemplate, configName: string): Promise<ToolConfiguration> {
    // Import template as a configuration
    const createdConfig = await this.importTemplateAsConfig(template, configName);
    return createdConfig;
  }

  static async importTemplateAsConfig(template: ConfigurationTemplate, configName: string): Promise<ToolConfiguration> {
    const config: Omit<ToolConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
      toolId: template.toolId,
      name: configName,
      description: `Created from template: ${template.name}`,
      settings: { ...template.settings },
      isDefault: false,
      tags: [...template.tags, "template-import"],
      version: "1.0.0"
    };

    // This would integrate with the ToolConfigManager
    // For now, we'll create a basic configuration
    return {
      ...config,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as ToolConfiguration;
  }

  // Template sharing and collaboration
  static async shareTemplate(id: string, shareData: { isPublic: boolean; teamId?: string }): Promise<boolean> {
    try {
      await apiPutJson(`/api/tools/templates/${id}/share`, shareData);
      toast({
        title: "Template shared",
        description: "Template sharing settings updated successfully."
      });
      return true;
    } catch {
      toast({
        title: "Share failed",
        description: "Failed to update template sharing settings.",
        variant: "destructive"
      });
      return false;
    }
  }

  static async getTemplateStats(templateId: string): Promise<TemplateUsageStats | null> {
    try {
      return await apiGetJson<TemplateUsageStats>(`/api/tools/templates/${templateId}/stats`);
    } catch {
      return null;
    }
  }

  // Template recommendations
  static async getRecommendedTemplates(toolId: number, userPreferences?: string[]): Promise<ConfigurationTemplate[]> {
    try {
      const params = new URLSearchParams({ toolId: toolId.toString() });
      if (userPreferences) {
        params.append('preferences', userPreferences.join(','));
      }
      
      return await apiGetJson<ConfigurationTemplate[]>(`/api/tools/templates/recommended?${params}`);
    } catch {
      // Fallback to local recommendations
      const templates = this.getLocalTemplates().filter(t => t.toolId === toolId);
      return templates.slice(0, 5); // Return top 5
    }
  }

  // Template import/export
  static async exportTemplate(templateId: string): Promise<string> {
    const templates = await this.getTemplates();
    const template = templates.find(t => t.id === templateId);
    
    if (!template) {
      throw new Error("Template not found");
    }

    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      template
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importTemplate(exportData: string): Promise<boolean> {
    try {
      const data = JSON.parse(exportData);
      if (!data.template) {
        throw new Error("Invalid template data");
      }

      await this.createTemplate(data.template);
      toast({
        title: "Template imported",
        description: "Template has been imported successfully."
      });
      return true;
    } catch {
      toast({
        title: "Import failed",
        description: "Invalid template data. Please check the file format.",
        variant: "destructive"
      });
      return false;
    }
  }

  // Local storage management
  private static getLocalTemplates(): ConfigurationTemplate[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error("Failed to load templates:", error);
      return [];
    }
  }

  private static saveLocalTemplates(templates: ConfigurationTemplate[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      console.error("Failed to save templates:", error);
      throw new Error("Unable to save template");
    }
  }

  // Template validation
  static validateTemplate(template: ConfigurationTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length === 0) {
      errors.push("Template name is required");
    }

    if (!template.description || template.description.trim().length === 0) {
      errors.push("Template description is required");
    }

    if (!template.toolId || template.toolId <= 0) {
      errors.push("Valid tool ID is required");
    }

    if (!template.settings || Object.keys(template.settings).length === 0) {
      errors.push("Template must have at least one setting");
    }

    if (template.tags && template.tags.length > 10) {
      errors.push("Templates can have at most 10 tags");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Template search and filtering
  static async searchTemplates(query: string, toolId?: number, category?: string): Promise<ConfigurationTemplate[]> {
    try {
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (toolId) params.append('toolId', toolId.toString());
      if (category) params.append('category', category);

      return await apiGetJson<ConfigurationTemplate[]>(`/api/tools/templates/search?${params}`);
    } catch {
      // Fallback to local search
      const templates = this.getLocalTemplates();
      const filtered = templates.filter(t => {
        const matchesTool = !toolId || t.toolId === toolId;
        const matchesCategory = !category || this.getTemplateCategory(t.id) === category;
        const searchText = `${t.name} ${t.description} ${t.tags.join(' ')}`.toLowerCase();
        const matchesQuery = !query || searchText.includes(query.toLowerCase());
        return matchesTool && matchesCategory && matchesQuery;
      });

      return filtered;
    }
  }

  static getTemplateCategory(templateId: string): string {
    // Simple categorization based on template ID or name
    if (templateId.includes('security') || templateId.includes('hardened')) return 'security';
    if (templateId.includes('performance') || templateId.includes('optimized')) return 'performance';
    if (templateId.includes('debug') || templateId.includes('verbose')) return 'debugging';
    if (templateId.includes('production')) return 'production';
    if (templateId.includes('development') || templateId.includes('minimal')) return 'development';
    return 'development'; // Default category
  }

  // Template usage tracking
  static async trackTemplateUsage(templateId: string, configId: string): Promise<void> {
    try {
      await apiPostJson(`/api/tools/templates/${templateId}/usage`, {
        configId,
        timestamp: new Date().toISOString()
      });
    } catch {
      return;
    }
  }

  // Bulk operations
  static async exportAllTemplates(): Promise<string> {
    const templates = await this.getTemplates();
    
    const exportData = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      templates
    };

    return JSON.stringify(exportData, null, 2);
  }

  static async importAllTemplates(exportData: string): Promise<boolean> {
    try {
      const data = JSON.parse(exportData);
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error("Invalid export data");
      }

      let importedCount = 0;
      for (const template of data.templates) {
        try {
          await this.createTemplate(template);
          importedCount++;
        } catch (error) {
          console.warn("Failed to import template:", template.name, error);
        }
      }

      toast({
        title: "Templates imported",
        description: `${importedCount} template(s) have been imported successfully.`
      });

      return true;
    } catch {
      toast({
        title: "Import failed",
        description: "Invalid template data. Please check the file format.",
        variant: "destructive"
      });
      return false;
    }
  }
}

// Template utilities
export const getTemplatePreview = (template: ConfigurationTemplate): string => {
  const settingsCount = Object.keys(template.settings).length;
  const tagsPreview = template.tags.slice(0, 3).join(', ');
  return `${template.name} • ${settingsCount} settings • ${tagsPreview}`;
};

export const getTemplateComplexity = (template: ConfigurationTemplate): 'simple' | 'medium' | 'complex' => {
  const settingsCount = Object.keys(template.settings).length;
  const hasNestedSettings = Object.values(template.settings).some(value => 
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );

  if (settingsCount <= 3 && !hasNestedSettings) return 'simple';
  if (settingsCount <= 10) return 'medium';
  return 'complex';
};

export const isTemplateCompatible = (template: ConfigurationTemplate, toolId: number): boolean => {
  return template.toolId === toolId;
};
