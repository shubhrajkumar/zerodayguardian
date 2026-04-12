import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  Upload, 
  Download, 
  Trash2, 
  Star, 
  Edit, 
  Plus, 
  Search, 
  X, 
  Check, 
  Clock,
  Tag,
  FileText,
  Settings,
  Database
} from "lucide-react";
import { ToolConfigManager, type ToolConfiguration } from "@/lib/toolConfigManager";

interface ToolConfigModalProps {
  toolId: number;
  toolName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigSelect: (config: ToolConfiguration | null) => void;
  currentConfigId?: string | null;
}

export function ToolConfigModal({ 
  toolId, 
  toolName, 
  isOpen, 
  onOpenChange, 
  onConfigSelect,
  currentConfigId 
}: ToolConfigModalProps) {
  const [configs, setConfigs] = useState<ToolConfiguration[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("manage");
  
  // Form state for creating/editing configurations
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    tags: "",
    isDefault: false,
    editingId: null as string | null
  });

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const configsData = await ToolConfigManager.loadToolConfigurations(toolId);
      setConfigs(configsData);
      
      // Set default form values if editing
      if (formState.editingId) {
        const configToEdit = configsData.find(c => c.id === formState.editingId);
        if (configToEdit) {
          setFormState(prev => ({
            ...prev,
            name: configToEdit.name,
            description: configToEdit.description,
            tags: configToEdit.tags.join(", "),
            isDefault: configToEdit.isDefault
          }));
        }
      }
    } catch (error) {
      console.error("Failed to load configurations:", error);
      toast({
        title: "Error",
        description: "Failed to load configurations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toolId, formState.editingId]);

  useEffect(() => {
    if (isOpen) {
      loadConfigs();
    }
  }, [isOpen, loadConfigs]);

  const handleSaveConfig = async () => {
    if (!formState.name.trim()) {
      toast({
        title: "Error",
        description: "Configuration name is required.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const tags = formState.tags.split(",").map(tag => tag.trim()).filter(tag => tag);
      
      const configData = {
        toolId,
        name: formState.name.trim(),
        description: formState.description.trim(),
        settings: {}, // Will be populated by the tool-specific settings
        isDefault: formState.isDefault,
        tags,
        version: "1.0.0"
      };

      const savedConfig = await ToolConfigManager.saveConfiguration(configData);
      
      if (formState.isDefault) {
        await ToolConfigManager.setDefaultConfiguration(savedConfig.id);
      }

      toast({
        title: "Configuration saved",
        description: `${savedConfig.name} has been saved successfully.`,
      });

      setFormState({
        name: "",
        description: "",
        tags: "",
        isDefault: false,
        editingId: null
      });
      
      await loadConfigs();
    } catch (error) {
      console.error("Failed to save configuration:", error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditConfig = (config: ToolConfiguration) => {
    setFormState({
      name: config.name,
      description: config.description,
      tags: config.tags.join(", "),
      isDefault: config.isDefault,
      editingId: config.id
    });
    setActiveTab("create");
  };

  const handleDeleteConfig = async (configId: string) => {
    const success = await ToolConfigManager.deleteConfiguration(configId);
    if (success) {
      await loadConfigs();
    }
  };

  const handleSetDefault = async (configId: string) => {
    const success = await ToolConfigManager.setDefaultConfiguration(configId);
    if (success) {
      await loadConfigs();
    }
  };

  const handleLoadConfig = (config: ToolConfiguration) => {
    onConfigSelect(config);
    onOpenChange(false);
  };

  const handleExportConfig = async (configId: string) => {
    try {
      const exportData = await ToolConfigManager.exportConfiguration(configId);
      const config = configs.find(c => c.id === configId);
      const filename = `${toolName.replace(/\s+/g, '_')}_${config?.name.replace(/\s+/g, '_')}_config.json`;
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Configuration exported",
        description: "Configuration has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: "Failed to export configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleImportConfig = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = await ToolConfigManager.importConfiguration(text);
      
      if (success) {
        await loadConfigs();
      }
    } catch (error) {
      console.error("Import failed:", error);
      toast({
        title: "Import failed",
        description: "Invalid configuration file. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      event.target.value = "";
    }
  };

  const filteredConfigs = configs.filter(config => {
    const searchText = `${config.name} ${config.description} ${config.tags.join(' ')}`.toLowerCase();
    return searchText.includes(searchQuery.toLowerCase());
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Settings className="h-5 w-5 text-cyan-400" />
            Configuration Manager - {toolName}
          </DialogTitle>
          <DialogDescription>
            Save, load, and manage custom configurations for {toolName}. Create multiple configurations for different use cases and switch between them as needed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="manage">Manage Configurations</TabsTrigger>
              <TabsTrigger value="create">Create/Edit</TabsTrigger>
              <TabsTrigger value="import-export">Import/Export</TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search configurations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {filteredConfigs.length} configuration(s) found
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("create")}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  New Configuration
                </Button>
              </div>

              <ScrollArea className="flex-1 p-4">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                  </div>
                ) : filteredConfigs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No configurations found. Create your first configuration to get started.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredConfigs.map((config) => (
                      <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{config.name}</h3>
                              {config.isDefault && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <Star className="h-3 w-3" />
                                  Default
                                </Badge>
                              )}
                              {config.tags.length > 0 && (
                                <div className="flex gap-1">
                                  {config.tags.slice(0, 3).map(tag => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                  {config.tags.length > 3 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{config.tags.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-3">{config.description}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Updated: {formatDate(config.updatedAt)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {config.tags.length} tag(s)
                              </span>
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Version {config.version}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadConfig(config)}
                              disabled={currentConfigId === config.id}
                              className="gap-2"
                            >
                              <Check className="h-4 w-4" />
                              Use
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditConfig(config)}
                              className="gap-2"
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleExportConfig(config.id)}
                              className="gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Export
                            </Button>
                            {!config.isDefault && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSetDefault(config.id)}
                                className="gap-2"
                              >
                                <Star className="h-4 w-4" />
                                Set Default
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteConfig(config.id)}
                              className="gap-2"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="create" className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">
                  {formState.editingId ? "Edit Configuration" : "Create New Configuration"}
                </h3>
                <p className="text-gray-600 text-sm">
                  Configure the settings for your new tool configuration.
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="config-name">Configuration Name *</Label>
                    <Input
                      id="config-name"
                      placeholder="e.g., Production Setup, Development Debug"
                      value={formState.name}
                      onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="config-description">Description</Label>
                    <Textarea
                      id="config-description"
                      placeholder="Describe what this configuration is for..."
                      value={formState.description}
                      onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="config-tags">Tags</Label>
                    <Input
                      id="config-tags"
                      placeholder="e.g., production, debug, security"
                      value={formState.tags}
                      onChange={(e) => setFormState(prev => ({ ...prev, tags: e.target.value }))}
                      className="text-sm"
                    />
                    <p className="text-xs text-gray-500">Separate tags with commas</p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="config-default"
                      checked={formState.isDefault}
                      onChange={(e) => setFormState(prev => ({ ...prev, isDefault: e.target.checked }))}
                      className="h-4 w-4 text-cyan-600 focus:ring-cyan-500 border-gray-300 rounded"
                    />
                    <Label htmlFor="config-default" className="text-sm font-medium">
                      Set as default configuration for this tool
                    </Label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveConfig} disabled={loading} className="gap-2">
                      <Save className="h-4 w-4" />
                      {formState.editingId ? "Update Configuration" : "Save Configuration"}
                    </Button>
                    {formState.editingId && (
                      <Button 
                        variant="outline" 
                        onClick={() => setFormState({
                          name: "",
                          description: "",
                          tags: "",
                          isDefault: false,
                          editingId: null
                        })}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancel Edit
                      </Button>
                    )}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="import-export" className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b">
                <h3 className="text-lg font-semibold">Import/Export Configurations</h3>
                <p className="text-gray-600 text-sm">
                  Share your configurations with team members or backup your settings.
                </p>
              </div>

              <ScrollArea className="flex-1 p-4">
                <div className="space-y-6 max-w-md">
                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Import Configuration
                    </h4>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Input
                        type="file"
                        accept=".json"
                        onChange={handleImportConfig}
                        className="hidden"
                        id="config-file-input"
                      />
                      <Label 
                        htmlFor="config-file-input"
                        className="cursor-pointer flex flex-col items-center gap-2 text-gray-600 hover:text-gray-800"
                      >
                        <Upload className="h-8 w-8" />
                        <span className="text-sm">Click to upload configuration file</span>
                        <span className="text-xs text-gray-400">JSON files only</span>
                      </Label>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Export All Configurations
                    </h4>
                    <p className="text-sm text-gray-600">
                      Download all configurations for this tool as a backup or for sharing.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        try {
                          const exportData = await ToolConfigManager.exportAllConfigurations();
                          const filename = `${toolName.replace(/\s+/g, '_')}_all_configs.json`;
                          
                          const blob = new Blob([exportData], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = filename;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);

                          toast({
                            title: "Configurations exported",
                            description: "All configurations have been downloaded successfully.",
                          });
                        } catch {
                          toast({
                            title: "Export failed",
                            description: "Failed to export configurations. Please try again.",
                            variant: "destructive",
                          });
                        }
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Export All
                    </Button>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      Configuration Statistics
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-cyan-600">{configs.length}</div>
                        <div className="text-sm text-gray-600">Total Configs</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-amber-600">{configs.filter(c => c.isDefault).length}</div>
                        <div className="text-sm text-gray-600">Default Configs</div>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
