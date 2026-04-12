import { toast } from "@/hooks/use-toast";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigurationValidationOptions {
  allowEmptyName?: boolean;
  maxNameLength?: number;
  maxDescriptionLength?: number;
  maxTags?: number;
  maxTagLength?: number;
  allowedCharacters?: RegExp;
}

const DEFAULT_OPTIONS: Required<ConfigurationValidationOptions> = {
  allowEmptyName: false,
  maxNameLength: 100,
  maxDescriptionLength: 500,
  maxTags: 10,
  maxTagLength: 30,
  allowedCharacters: /^[a-zA-Z0-9\s\-_.,!?()]+$/,
};

export class ToolConfigValidator {
  private static sanitizeString(str: string): string {
    return str.trim();
  }

  private static validateName(name: string, options: Required<ConfigurationValidationOptions>): string[] {
    const errors: string[] = [];
    
    if (!options.allowEmptyName && !name) {
      errors.push("Configuration name is required");
      return errors;
    }

    if (name.length > options.maxNameLength) {
      errors.push(`Configuration name must be ${options.maxNameLength} characters or less`);
    }

    if (!options.allowedCharacters.test(name)) {
      errors.push("Configuration name contains invalid characters");
    }

    if (name.length > 0 && name.length < 2) {
      errors.push("Configuration name must be at least 2 characters long");
    }

    return errors;
  }

  private static validateDescription(description: string, options: Required<ConfigurationValidationOptions>): string[] {
    const errors: string[] = [];
    
    if (description.length > options.maxDescriptionLength) {
      errors.push(`Description must be ${options.maxDescriptionLength} characters or less`);
    }

    return errors;
  }

  private static validateTags(tags: string[], options: Required<ConfigurationValidationOptions>): { errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (tags.length > options.maxTags) {
      errors.push(`Maximum ${options.maxTags} tags allowed`);
    }

    const uniqueTags = new Set(tags.map(tag => tag.toLowerCase()));
    if (uniqueTags.size !== tags.length) {
      warnings.push("Duplicate tags detected - duplicates will be removed");
    }

    for (const tag of tags) {
      if (tag.length === 0) {
        errors.push("Empty tags are not allowed");
      } else if (tag.length > options.maxTagLength) {
        errors.push(`Tag "${tag}" must be ${options.maxTagLength} characters or less`);
      } else if (!options.allowedCharacters.test(tag)) {
        errors.push(`Tag "${tag}" contains invalid characters`);
      }
    }

    return { errors, warnings };
  }

  private static validateSettings(settings: Record<string, unknown>): string[] {
    const errors: string[] = [];
    
    try {
      // Check if settings can be serialized
      JSON.stringify(settings);
    } catch {
      errors.push("Configuration settings contain invalid data that cannot be saved");
    }

    // Check for circular references
    const seen = new WeakSet();
    const checkCircular = (obj: any): boolean => {
      if (obj === null || typeof obj !== 'object') return false;
      if (seen.has(obj)) return true;
      seen.add(obj);
      
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          if (checkCircular(obj[key])) return true;
        }
      }
      return false;
    };

    if (checkCircular(settings)) {
      errors.push("Configuration settings contain circular references");
    }

    return errors;
  }

  static validateConfiguration(
    config: {
      name: string;
      description: string;
      tags: string[];
      settings: Record<string, unknown>;
      isDefault: boolean;
    },
    options: ConfigurationValidationOptions = {}
  ): ValidationResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Sanitize inputs
    const sanitizedName = this.sanitizeString(config.name);
    const sanitizedDescription = this.sanitizeString(config.description);
    const sanitizedTags = config.tags.map(tag => this.sanitizeString(tag)).filter(tag => tag.length > 0);

    // Validate name
    errors.push(...this.validateName(sanitizedName, opts));

    // Validate description
    errors.push(...this.validateDescription(sanitizedDescription, opts));

    // Validate tags
    const tagValidation = this.validateTags(sanitizedTags, opts);
    errors.push(...tagValidation.errors);
    warnings.push(...tagValidation.warnings);

    // Validate settings
    errors.push(...this.validateSettings(config.settings));

    // Validate isDefault flag
    if (typeof config.isDefault !== 'boolean') {
      errors.push("isDefault must be a boolean value");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static validateImportData(data: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data || typeof data !== 'object') {
      errors.push("Invalid import data format");
      return { isValid: false, errors, warnings };
    }

    if (!data.version) {
      warnings.push("Import data missing version information");
    }

    if (!data.configurations || !Array.isArray(data.configurations)) {
      errors.push("Import data must contain configurations array");
      return { isValid: false, errors, warnings };
    }

    for (const config of data.configurations) {
      if (!config.name || typeof config.name !== 'string') {
        errors.push("Configuration must have a valid name");
      }
      if (!config.toolId || typeof config.toolId !== 'number') {
        errors.push("Configuration must have a valid toolId");
      }
      if (config.tags && !Array.isArray(config.tags)) {
        errors.push("Configuration tags must be an array");
      }
      if (config.settings && typeof config.settings !== 'object') {
        errors.push("Configuration settings must be an object");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  static sanitizeConfiguration(config: any): any {
    return {
      ...config,
      name: this.sanitizeString(config.name || ""),
      description: this.sanitizeString(config.description || ""),
      tags: Array.isArray(config.tags) 
        ? config.tags.map((tag: string) => this.sanitizeString(tag)).filter((tag: string) => tag.length > 0)
        : [],
      settings: config.settings || {},
      isDefault: Boolean(config.isDefault),
      version: config.version || "1.0.0",
    };
  }

  static showValidationErrors(validationResult: ValidationResult): void {
    if (validationResult.errors.length > 0) {
      toast({
        title: "Configuration validation failed",
        description: validationResult.errors.join(". "),
        variant: "destructive",
      });
    }

    if (validationResult.warnings.length > 0) {
      toast({
        title: "Configuration warnings",
        description: validationResult.warnings.join(". "),
        variant: "default",
      });
    }
  }

  static getSanitizedConfiguration(config: any): any {
    const sanitized = this.sanitizeConfiguration(config);
    const validation = this.validateConfiguration(sanitized);
    
    if (!validation.isValid) {
      this.showValidationErrors(validation);
      throw new Error("Configuration validation failed");
    }

    return sanitized;
  }
}

// Utility functions for common validation scenarios
export const validateToolConfiguration = (
  name: string,
  description: string,
  tags: string[],
  settings: Record<string, unknown>,
  isDefault: boolean
): ValidationResult => {
  return ToolConfigValidator.validateConfiguration({
    name,
    description,
    tags,
    settings,
    isDefault,
  });
};

export const validateConfigurationName = (name: string): ValidationResult => {
  return ToolConfigValidator.validateConfiguration({
    name,
    description: "",
    tags: [],
    settings: {},
    isDefault: false,
  }, { allowEmptyName: true });
};

export const validateConfigurationTags = (tags: string[]): ValidationResult => {
  return ToolConfigValidator.validateConfiguration({
    name: "test",
    description: "",
    tags,
    settings: {},
    isDefault: false,
  });
};

// Error handling wrapper for configuration operations
export class ConfigOperationHandler {
  static async executeWithValidation<T>(
    operation: () => Promise<T>,
    operationName: string = "Configuration operation"
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`${operationName} failed:`, error);
      
      let errorMessage = `${operationName} failed`;
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: "Operation failed",
        description: errorMessage,
        variant: "destructive",
      });

      throw error;
    }
  }

  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
        }
      }
    }

    toast({
      title: "Operation failed after retries",
      description: lastError?.message || "Please try again later",
      variant: "destructive",
    });

    throw lastError;
  }
}
