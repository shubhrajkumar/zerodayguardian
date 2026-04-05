# Tool Configuration Management System

## Overview

The Tool Configuration Management System is a comprehensive solution for managing, organizing, and optimizing tool configurations within the Zero Day Guardian platform. This system provides advanced features for configuration management, team collaboration, version control, and performance monitoring.

## Features

### Core Features

- **Configuration Management**: Create, edit, and manage tool configurations with advanced validation
- **Template System**: Reusable configuration templates for common setups
- **Version Control**: Complete version history and rollback capabilities
- **Team Collaboration**: Share configurations across teams with permission controls
- **Backup & Restore**: Automated backup system with point-in-time recovery
- **Performance Monitoring**: Real-time monitoring and optimization suggestions
- **Audit Logging**: Comprehensive audit trails for compliance and security
- **Analytics**: Detailed usage analytics and insights

### Advanced Features

- **Configuration Sharing**: Secure sharing between users and teams
- **Advanced Search**: Powerful search and filtering capabilities
- **Export/Import**: Flexible configuration import/export in multiple formats
- **Real-time Collaboration**: Live collaboration features for team environments
- **Performance Optimization**: Automated performance monitoring and suggestions

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Components                      │
├─────────────────────────────────────────────────────────────┤
│  ToolConfigModal  │  ToolCard  │  ConfigurationList  │  ... │
├─────────────────────────────────────────────────────────────┤
│                    Context & Hooks                          │
├─────────────────────────────────────────────────────────────┤
│  ToolConfigContext  │  useToolConfig  │  useConfigTemplates │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
├─────────────────────────────────────────────────────────────┤
│  ToolConfigManager  │  ConfigTemplates  │  ConfigBackup     │
├─────────────────────────────────────────────────────────────┤
│                    API Layer                                │
├─────────────────────────────────────────────────────────────┤
│  Backend API Routes  │  Database Models  │  Middleware       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Interaction**: Users interact with frontend components
2. **Context Management**: State managed through React Context
3. **Service Layer**: Business logic handled by service classes
4. **API Communication**: RESTful API communication with backend
5. **Database Operations**: Persistent storage in MongoDB
6. **Real-time Updates**: WebSocket updates for collaborative features

## Installation

### Prerequisites

- Node.js 18.x or higher
- npm 8.x or higher
- MongoDB 4.4 or higher
- Redis (optional, for caching)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd zeroday-guardian
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```

3. **Setup environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the application**:
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm run build
   npm start
   ```

5. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

## Usage

### Basic Configuration Management

#### Creating a Configuration

```typescript
import { ToolConfigManager } from '@/lib/toolConfigManager';

// Create a new configuration
const config = await ToolConfigManager.createConfiguration({
  toolId: 1,
  name: 'Production Setup',
  description: 'Configuration for production environment',
  settings: {
    timeout: 30000,
    retries: 3,
    debug: false
  },
  tags: ['production', 'critical']
});
```

#### Editing a Configuration

```typescript
// Update an existing configuration
const updatedConfig = await ToolConfigManager.updateConfiguration(config.id, {
  description: 'Updated production configuration',
  settings: {
    ...config.settings,
    timeout: 60000
  }
});
```

#### Loading Configurations

```typescript
// Load all configurations
const configs = await ToolConfigManager.getConfigurations();

// Load specific configuration
const config = await ToolConfigManager.getConfiguration(configId);

// Load configurations by tool
const toolConfigs = await ToolConfigManager.getConfigurationsByTool(toolId);
```

### Using Templates

#### Creating Templates

```typescript
import { ConfigTemplates } from '@/lib/toolConfigTemplates';

// Create a template
const template = await ConfigTemplates.createTemplate({
  name: 'Security Hardened',
  description: 'Template for security-focused configurations',
  settings: {
    encryption: true,
    auditLogging: true,
    rateLimiting: true
  },
  tags: ['security', 'template']
});
```

#### Applying Templates

```typescript
// Apply template to a configuration
const config = await ConfigTemplates.applyTemplate(configId, templateId);

// Create configuration from template
const newConfig = await ConfigTemplates.createFromTemplate(templateId, {
  name: 'My Security Config',
  description: 'Custom security configuration'
});
```

### Version Management

#### Creating Versions

```typescript
import { ToolConfigVersioning } from '@/lib/toolConfigVersioning';

// Create a new version
const version = await ToolConfigVersioning.createVersion(
  configId,
  '1.0.0',
  'Initial version',
  {
    before: oldSettings,
    after: newSettings,
    fields: ['timeout', 'retries']
  }
);
```

#### Comparing Versions

```typescript
// Compare two versions
const comparison = await ToolConfigVersioning.compareVersions(
  configId,
  versionId1,
  versionId2
);

console.log('Differences:', comparison.differences);
console.log('Summary:', comparison.summary);
```

#### Rolling Back

```typescript
// Rollback to previous version
const rolledBackConfig = await ToolConfigVersioning.rollback(configId, {
  targetVersion: '0.9.0',
  createNewVersion: true,
  commitMessage: 'Rolling back due to issues'
});
```

### Team Collaboration

#### Sharing Configurations

```typescript
import { ConfigSharing } from '@/lib/toolConfigSharing';

// Share configuration with user
await ConfigSharing.shareWithUser(configId, {
  userId: 'user123',
  permission: 'read'
});

// Share with team
await ConfigSharing.shareWithTeam(configId, {
  teamId: 'team456',
  permission: 'edit'
});
```

#### Managing Permissions

```typescript
// Update permissions
await ConfigSharing.updatePermissions(configId, {
  userId: 'user123',
  permission: 'edit'
});

// Remove access
await ConfigSharing.removeAccess(configId, 'user123');
```

### Performance Monitoring

#### Tracking Performance

```typescript
import { ToolConfigMonitoring } from '@/lib/toolConfigMonitoring';

// Start monitoring
ToolConfigMonitoring.startHealthMonitoring(30000); // Check every 30 seconds

// Get system health
const health = await ToolConfigMonitoring.getSystemHealth();
console.log('Memory usage:', health.memoryUsage.percentage + '%');
console.log('Performance score:', health.performanceScore);

// Get optimization suggestions
const suggestions = ToolConfigMonitoring.getOptimizationSuggestions();
console.log('Suggestions:', suggestions);
```

#### Performance Alerts

```typescript
// Setup alert rules
ToolConfigMonitoring.addAlertRule({
  name: 'High Memory Usage',
  condition: (metric) => metric.memoryUsage > 50 * 1024 * 1024,
  severity: 'medium',
  message: 'Configuration {configId} is using high memory',
  enabled: true
});
```

## API Reference

### Configuration Management API

#### POST /api/tools/configs
Create a new configuration

**Request Body:**
```json
{
  "toolId": 1,
  "name": "Configuration Name",
  "description": "Configuration description",
  "settings": {
    "key": "value"
  },
  "tags": ["tag1", "tag2"],
  "isDefault": false
}
```

#### GET /api/tools/configs
Get all configurations

**Query Parameters:**
- `toolId`: Filter by tool ID
- `search`: Search term
- `tags`: Comma-separated tags
- `page`: Page number
- `limit`: Items per page

#### PUT /api/tools/configs/:id
Update a configuration

#### DELETE /api/tools/configs/:id
Delete a configuration

### Template API

#### POST /api/tools/templates
Create a new template

#### GET /api/tools/templates
Get all templates

#### POST /api/tools/templates/:id/apply
Apply template to configuration

### Version API

#### POST /api/tools/configs/:id/versions
Create a new version

#### GET /api/tools/configs/:id/versions
Get version history

#### POST /api/tools/configs/:id/versions/rollback
Rollback to specific version

### Sharing API

#### POST /api/tools/configs/:id/share
Share configuration

#### PUT /api/tools/configs/:id/share/:userId
Update user permissions

## Configuration Examples

### Basic Tool Configuration

```json
{
  "toolId": 1,
  "name": "Development Setup",
  "description": "Configuration for development environment",
  "settings": {
    "timeout": 30000,
    "retries": 3,
    "debug": true,
    "logLevel": "debug",
    "maxConnections": 10
  },
  "tags": ["development", "debug"],
  "isDefault": true
}
```

### Security Template

```json
{
  "name": "Security Hardened",
  "description": "Template for security-focused configurations",
  "settings": {
    "encryption": {
      "enabled": true,
      "algorithm": "AES-256",
      "keyRotation": "90d"
    },
    "auditLogging": {
      "enabled": true,
      "level": "detailed",
      "retention": "1y"
    },
    "rateLimiting": {
      "enabled": true,
      "requestsPerMinute": 100,
      "burstLimit": 20
    },
    "authentication": {
      "required": true,
      "method": "oauth2",
      "mfaRequired": true
    }
  },
  "tags": ["security", "template", "compliance"]
}
```

### Performance Monitoring Configuration

```json
{
  "toolId": 2,
  "name": "Performance Optimized",
  "description": "Configuration optimized for performance",
  "settings": {
    "caching": {
      "enabled": true,
      "ttl": 3600,
      "maxSize": "1GB"
    },
    "compression": {
      "enabled": true,
      "algorithm": "gzip",
      "level": 6
    },
    "connectionPooling": {
      "enabled": true,
      "maxConnections": 50,
      "idleTimeout": 300
    },
    "monitoring": {
      "enabled": true,
      "metricsInterval": 30,
      "alertThresholds": {
        "memoryUsage": 80,
        "cpuUsage": 70,
        "responseTime": 1000
      }
    }
  },
  "tags": ["performance", "optimized", "monitoring"]
}
```

## Best Practices

### Configuration Management

1. **Use Descriptive Names**: Always use clear, descriptive names for configurations
2. **Tag Strategically**: Use tags to organize and categorize configurations
3. **Version Control**: Always create versions when making significant changes
4. **Template Usage**: Create templates for common configuration patterns
5. **Regular Backups**: Ensure regular backups are performed

### Security Considerations

1. **Access Control**: Implement proper access controls for sensitive configurations
2. **Audit Logging**: Enable audit logging for all configuration changes
3. **Secret Management**: Use secure methods for storing sensitive configuration data
4. **Regular Reviews**: Regularly review and audit configuration access

### Performance Optimization

1. **Monitor Usage**: Use the monitoring system to track configuration performance
2. **Optimize Settings**: Regularly review and optimize configuration settings
3. **Resource Management**: Monitor resource usage and adjust accordingly
4. **Caching Strategy**: Implement appropriate caching strategies

### Team Collaboration

1. **Clear Communication**: Use clear descriptions and documentation
2. **Permission Management**: Set appropriate permissions for team members
3. **Version Control**: Use version control for collaborative configuration management
4. **Regular Sync**: Regular team syncs for configuration reviews

## Troubleshooting

### Common Issues

#### Configuration Not Loading
- Check if the configuration exists in the database
- Verify user permissions
- Check for any error messages in the console

#### Template Application Fails
- Ensure the template exists and is valid
- Check if the target configuration exists
- Verify user has edit permissions

#### Performance Issues
- Check system health metrics
- Review configuration settings for optimization opportunities
- Monitor resource usage

#### Version Rollback Issues
- Ensure the target version exists
- Check if rollback is allowed for the configuration
- Verify user has appropriate permissions

### Debug Mode

Enable debug mode for detailed logging:

```typescript
// Enable debug mode
localStorage.setItem('ZDG_DEBUG', 'true');

// View debug logs
console.log('Debug logs enabled');
```

### Support

For additional support:
- Check the system logs
- Review the API documentation
- Contact the development team
- Check the GitHub issues

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Submit a pull request

### Code Style

- Follow the existing code style
- Use TypeScript for type safety
- Add appropriate comments and documentation
- Ensure all tests pass

### Testing

Run the test suite:
```bash
npm test
```

Run specific tests:
```bash
npm test -- --testNamePattern="configuration"
```

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release of Tool Configuration Management System
- Core configuration management features
- Template system implementation
- Version control and rollback
- Team collaboration features
- Performance monitoring
- Audit logging and analytics

### Version 1.1.0
- Advanced search and filtering
- Enhanced security features
- Performance optimizations
- Improved user interface
- Additional configuration types support

## Contact

For questions, support, or feature requests:
- GitHub Issues: [Repository Issues](https://github.com/your-repo/issues)
- Email: ksubhraj28@gmail.com
- Documentation: [Full Documentation](./README.md)
