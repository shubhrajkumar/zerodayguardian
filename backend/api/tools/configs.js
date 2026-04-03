const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../../middleware/authentication');
const { authorizeRole } = require('../../middleware/authorization');
const { validateToolConfig } = require('../../middleware/request-validator');
const { ToolConfig } = require('../../database/models');

/**
 * @route   GET /api/tools/:toolId/configs
 * @desc    Get all configurations for a tool
 * @access  Private
 */
router.get('/:toolId/configs', authenticateUser, async (req, res) => {
  try {
    const { toolId } = req.params;
    const { page = 1, limit = 20, search, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build query
    const query = {
      toolId: parseInt(toolId),
      userId: req.user.id
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const configs = await ToolConfig.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await ToolConfig.countDocuments(query);

    res.json({
      success: true,
      data: configs,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching tool configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configurations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tools/:toolId/configs/:configId
 * @desc    Get a specific configuration
 * @access  Private
 */
router.get('/:toolId/configs/:configId', authenticateUser, async (req, res) => {
  try {
    const { toolId, configId } = req.params;

    const config = await ToolConfig.findOne({
      _id: configId,
      toolId: parseInt(toolId),
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch configuration',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tools/:toolId/configs
 * @desc    Create a new configuration
 * @access  Private
 */
router.post('/:toolId/configs', authenticateUser, validateToolConfig, async (req, res) => {
  try {
    const { toolId } = req.params;
    const configData = req.body;

    // Check if configuration with same name already exists for this user
    const existingConfig = await ToolConfig.findOne({
      toolId: parseInt(toolId),
      name: configData.name,
      userId: req.user.id
    });

    if (existingConfig) {
      return res.status(409).json({
        success: false,
        message: 'Configuration with this name already exists'
      });
    }

    // Create new configuration
    const config = new ToolConfig({
      ...configData,
      toolId: parseInt(toolId),
      userId: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await config.save();

    // If this is set as default, unset other defaults for this tool
    if (configData.isDefault) {
      await ToolConfig.updateMany(
        {
          toolId: parseInt(toolId),
          userId: req.user.id,
          _id: { $ne: config._id }
        },
        { $set: { isDefault: false } }
      );
    }

    res.status(201).json({
      success: true,
      data: config,
      message: 'Configuration created successfully'
    });
  } catch (error) {
    console.error('Error creating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create configuration',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/tools/:toolId/configs/:configId
 * @desc    Update a configuration
 * @access  Private
 */
router.put('/:toolId/configs/:configId', authenticateUser, validateToolConfig, async (req, res) => {
  try {
    const { toolId, configId } = req.params;
    const configData = req.body;

    const config = await ToolConfig.findOne({
      _id: configId,
      toolId: parseInt(toolId),
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    // Check for name conflicts (excluding current config)
    if (configData.name && configData.name !== config.name) {
      const existingConfig = await ToolConfig.findOne({
        toolId: parseInt(toolId),
        name: configData.name,
        userId: req.user.id,
        _id: { $ne: configId }
      });

      if (existingConfig) {
        return res.status(409).json({
          success: false,
          message: 'Configuration with this name already exists'
        });
      }
    }

    // Update configuration
    Object.assign(config, {
      ...configData,
      updatedAt: new Date()
    });

    await config.save();

    // If this is set as default, unset other defaults for this tool
    if (configData.isDefault) {
      await ToolConfig.updateMany(
        {
          toolId: parseInt(toolId),
          userId: req.user.id,
          _id: { $ne: configId }
        },
        { $set: { isDefault: false } }
      );
    }

    res.json({
      success: true,
      data: config,
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update configuration',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/tools/:toolId/configs/:configId
 * @desc    Delete a configuration
 * @access  Private
 */
router.delete('/:toolId/configs/:configId', authenticateUser, async (req, res) => {
  try {
    const { toolId, configId } = req.params;

    const config = await ToolConfig.findOne({
      _id: configId,
      toolId: parseInt(toolId),
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    // Prevent deletion of default configuration
    if (config.isDefault) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete default configuration. Set another configuration as default first.'
      });
    }

    await ToolConfig.deleteOne({ _id: configId });

    res.json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete configuration',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/tools/:toolId/configs/:configId/default
 * @desc    Set a configuration as default
 * @access  Private
 */
router.put('/:toolId/configs/:configId/default', authenticateUser, async (req, res) => {
  try {
    const { toolId, configId } = req.params;

    const config = await ToolConfig.findOne({
      _id: configId,
      toolId: parseInt(toolId),
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    // Set this config as default and unset others
    await ToolConfig.updateMany(
      {
        toolId: parseInt(toolId),
        userId: req.user.id
      },
      { $set: { isDefault: false } }
    );

    config.isDefault = true;
    config.updatedAt = new Date();
    await config.save();

    res.json({
      success: true,
      data: config,
      message: 'Default configuration updated successfully'
    });
  } catch (error) {
    console.error('Error setting default configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set default configuration',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tools/:toolId/configs/default
 * @desc    Get the default configuration for a tool
 * @access  Private
 */
router.get('/:toolId/configs/default', authenticateUser, async (req, res) => {
  try {
    const { toolId } = req.params;

    const config = await ToolConfig.findOne({
      toolId: parseInt(toolId),
      userId: req.user.id,
      isDefault: true
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No default configuration found'
      });
    }

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('Error fetching default configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default configuration',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tools/:toolId/configs/import
 * @desc    Import configurations from JSON
 * @access  Private
 */
router.post('/:toolId/configs/import', authenticateUser, async (req, res) => {
  try {
    const { toolId } = req.params;
    const { configurations } = req.body;

    if (!Array.isArray(configurations) || configurations.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid import data'
      });
    }

    let importedCount = 0;
    const errors = [];

    for (const configData of configurations) {
      try {
        // Check if configuration already exists
        const existingConfig = await ToolConfig.findOne({
          toolId: parseInt(toolId),
          name: configData.name,
          userId: req.user.id
        });

        if (existingConfig) {
          errors.push(`Configuration "${configData.name}" already exists`);
          continue;
        }

        // Create new configuration
        const config = new ToolConfig({
          ...configData,
          toolId: parseInt(toolId),
          userId: req.user.id,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await config.save();
        importedCount++;
      } catch (error) {
        errors.push(`Failed to import "${configData.name}": ${error.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        importedCount,
        total: configurations.length,
        errors
      },
      message: `Import completed: ${importedCount} configurations imported`
    });
  } catch (error) {
    console.error('Error importing configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import configurations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tools/:toolId/configs/export
 * @desc    Export all configurations for a tool
 * @access  Private
 */
router.get('/:toolId/configs/export', authenticateUser, async (req, res) => {
  try {
    const { toolId } = req.params;

    const configs = await ToolConfig.find({
      toolId: parseInt(toolId),
      userId: req.user.id
    }).lean();

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      toolId: parseInt(toolId),
      configurations: configs
    };

    res.json({
      success: true,
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export configurations',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tools/configs/shared
 * @desc    Get shared configurations (for team collaboration)
 * @access  Private
 */
router.get('/configs/shared', authenticateUser, authorizeRole(['admin', 'team-lead']), async (req, res) => {
  try {
    const { teamId } = req.user;
    const { page = 1, limit = 20, toolId } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const query = {
      isShared: true,
      ...(teamId && { teamId }),
      ...(toolId && { toolId: parseInt(toolId) })
    };

    const configs = await ToolConfig.find(query)
      .populate('userId', 'name email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await ToolConfig.countDocuments(query);

    res.json({
      success: true,
      data: configs,
      pagination: {
        page: parseInt(page),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching shared configurations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared configurations',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tools/:toolId/configs/:configId/share
 * @desc    Share a configuration with team
 * @access  Private
 */
router.post('/:toolId/configs/:configId/share', authenticateUser, async (req, res) => {
  try {
    const { toolId, configId } = req.params;
    const { isShared, teamId } = req.body;

    const config = await ToolConfig.findOne({
      _id: configId,
      toolId: parseInt(toolId),
      userId: req.user.id
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    config.isShared = isShared;
    if (isShared) {
      config.teamId = teamId || req.user.teamId;
      config.sharedAt = new Date();
      config.sharedBy = req.user.id;
    } else {
      config.teamId = null;
      config.sharedAt = null;
      config.sharedBy = null;
    }

    await config.save();

    res.json({
      success: true,
      data: config,
      message: `Configuration ${isShared ? 'shared' : 'unshared'} successfully`
    });
  } catch (error) {
    console.error('Error sharing configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share configuration',
      error: error.message
    });
  }
});

module.exports = router;