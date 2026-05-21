import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import { ToolConfigManager, type ToolConfiguration } from "@/lib/toolConfigManager";

interface ToolConfigContextValue {
  // State
  currentConfig: ToolConfiguration | null;
  isLoading: boolean;
  
  // Actions
  loadConfig: (toolId: number, configId?: string) => Promise<ToolConfiguration | null>;
  saveConfig: (toolId: number, configData: Omit<ToolConfiguration, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ToolConfiguration | null>;
  deleteConfig: (configId: string) => Promise<boolean>;
  setDefaultConfig: (configId: string) => Promise<boolean>;
  getConfigsForTool: (toolId: number) => Promise<ToolConfiguration[]>;
  exportConfig: (configId: string) => Promise<string>;
  importConfig: (exportData: string) => Promise<boolean>;
  clearAllConfigs: () => Promise<void>;
}

const ToolConfigContext = createContext<ToolConfigContextValue | null>(null);

export const ToolConfigProvider = ({ children }: { children: ReactNode }) => {
  const [currentConfig, setCurrentConfig] = useState<ToolConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load default configuration for a tool
  const loadConfig = useCallback(async (toolId: number, configId?: string) => {
    setIsLoading(true);
    try {
      let config: ToolConfiguration | null = null;

      if (configId) {
        // Load specific configuration
        config = await ToolConfigManager.loadConfiguration(configId);
      } else {
        // Load default configuration for the tool
        config = await ToolConfigManager.getToolDefaultConfiguration(toolId);
      }

      if (!config) {
        // If no configuration found, try to load the most recent one
        const configs = await ToolConfigManager.loadToolConfigurations(toolId);
        if (configs.length > 0) {
          config = configs[0]; // Most recent
        }
      }

      setCurrentConfig(config);
      return config;
    } catch (error) {
      console.error("Failed to load configuration:", error);
      toast({
        title: "Error",
        description: "Failed to load configuration. Using default settings.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new configuration or update existing one
  const saveConfig = useCallback(async (
    toolId: number, 
    configData: Omit<ToolConfiguration, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ToolConfiguration | null> => {
    void toolId;
    setIsLoading(true);
    try {
      const savedConfig = await ToolConfigManager.saveConfiguration(configData);
      setCurrentConfig(savedConfig);
      
      toast({
        title: "Configuration saved",
        description: `${savedConfig.name} has been saved successfully.`,
      });
      
      return savedConfig;
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete a configuration
  const deleteConfig = useCallback(async (configId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await ToolConfigManager.deleteConfiguration(configId);
      if (success) {
        // If deleted config was current, clear it
        if (currentConfig?.id === configId) {
          setCurrentConfig(null);
        }
      }
      return success;
    } catch (error) {
      console.error("Failed to delete configuration:", error);
      toast({
        title: "Error",
        description: "Failed to delete configuration. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentConfig]);

  // Set a configuration as default
  const setDefaultConfig = useCallback(async (configId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await ToolConfigManager.setDefaultConfiguration(configId);
      if (success) {
        // Reload the configuration to get updated isDefault flag
        const config = await ToolConfigManager.loadConfiguration(configId);
        if (config) {
          setCurrentConfig(config);
        }
      }
      return success;
    } catch (error) {
      console.error("Failed to set default configuration:", error);
      toast({
        title: "Error",
        description: "Failed to set default configuration. Please try again.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get all configurations for a tool
  const getConfigsForTool = useCallback(async (toolId: number): Promise<ToolConfiguration[]> => {
    setIsLoading(true);
    try {
      const configs = await ToolConfigManager.loadToolConfigurations(toolId);
      return configs;
    } catch (error) {
      console.error("Failed to load configurations:", error);
      toast({
        title: "Error",
        description: "Failed to load configurations. Please try again.",
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Export a configuration
  const exportConfig = useCallback(async (configId: string): Promise<string> => {
    setIsLoading(true);
    try {
      const exportData = await ToolConfigManager.exportConfiguration(configId);
      toast({
        title: "Configuration exported",
        description: "Configuration has been exported successfully.",
      });
      return exportData;
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "Failed to export configuration. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Import a configuration
  const importConfig = useCallback(async (exportData: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await ToolConfigManager.importConfiguration(exportData);
      if (success) {
        toast({
          title: "Configuration imported",
          description: "Configuration has been imported successfully.",
        });
      }
      return success;
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import failed",
        description: "Invalid configuration data. Please check the file format.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Clear all configurations (for development/testing)
  const clearAllConfigs = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await ToolConfigManager.clearAllConfigurations();
      setCurrentConfig(null);
      toast({
        title: "All configurations cleared",
        description: "All tool configurations have been removed.",
      });
    } catch (error) {
      console.error("Failed to clear configurations:", error);
      toast({
        title: "Error",
        description: "Failed to clear configurations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-load default configuration when tool changes
  useEffect(() => {
    // This effect can be used to auto-load configurations based on route changes
    // or other application state changes
  }, []);

  const value: ToolConfigContextValue = {
    currentConfig,
    isLoading,
    loadConfig,
    saveConfig,
    deleteConfig,
    setDefaultConfig,
    getConfigsForTool,
    exportConfig,
    importConfig,
    clearAllConfigs,
  };

  return (
    <ToolConfigContext.Provider value={value}>
      {children}
    </ToolConfigContext.Provider>
  );
};

export const useToolConfig = () => {
  const context = useContext(ToolConfigContext);
  if (!context) {
    throw new Error("useToolConfig must be used within ToolConfigProvider");
  }
  return context;
};

// Hook for easy access to current configuration state
export const useCurrentConfig = () => {
  const { currentConfig, isLoading } = useToolConfig();
  return { currentConfig, isLoading };
};

// Hook for configuration management actions
export const useConfigActions = () => {
  const { 
    loadConfig, 
    saveConfig, 
    deleteConfig, 
    setDefaultConfig, 
    getConfigsForTool,
    exportConfig,
    importConfig,
    clearAllConfigs 
  } = useToolConfig();
  
  return {
    loadConfig,
    saveConfig,
    deleteConfig,
    setDefaultConfig,
    getConfigsForTool,
    exportConfig,
    importConfig,
    clearAllConfigs,
  };
};
