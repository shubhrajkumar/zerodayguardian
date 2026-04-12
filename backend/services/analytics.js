const ToolConfig = require('../database/models/ToolConfig');
const AuditLog = require('../monitoring/audit-logs');

class ConfigurationAnalytics {
  /**
   * Get configuration usage statistics
   */
  static async getUsageStats(toolId, userId, timeframe = '7d') {
    const timeLimit = new Date();
    timeLimit.setDate(timeLimit.getDate() - (timeframe === '7d' ? 7 : 30));

    const matchStage = {
      createdAt: { $gte: timeLimit },
      action: 'CONFIG_LOAD'
    };

    if (toolId) matchStage.toolId = toolId;
    if (userId) matchStage.userId = userId;

    const usageStats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$resourceId',
          usageCount: { $sum: 1 },
          lastUsed: { $max: '$createdAt' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $lookup: {
          from: 'toolconfigs',
          localField: '_id',
          foreignField: '_id',
          as: 'config'
        }
      },
      { $unwind: '$config' },
      {
        $project: {
          configName: '$config.name',
          toolId: '$config.toolId',
          usageCount: 1,
          lastUsed: 1,
          uniqueUsersCount: { $size: '$uniqueUsers' },
          isDefault: '$config.isDefault',
          isShared: '$config.isShared'
        }
      },
      { $sort: { usageCount: -1 } }
    ]);

    return usageStats;
  }

  /**
   * Get configuration creation trends
   */
  static async getCreationTrends(toolId, userId, timeframe = '30d') {
    const timeLimit = new Date();
    timeLimit.setDate(timeLimit.getDate() - (timeframe === '30d' ? 30 : 7));

    const matchStage = {
      createdAt: { $gte: timeLimit },
      action: { $in: ['CONFIG_CREATE', 'CONFIG_UPDATE'] }
    };

    if (toolId) matchStage.toolId = toolId;
    if (userId) matchStage.userId = userId;

    const trends = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } },
      {
        $group: {
          _id: '$_id.action',
          data: {
            $push: {
              date: '$_id.date',
              count: '$count'
            }
          }
        }
      }
    ]);

    return trends;
  }

  /**
   * Get configuration sharing statistics
   */
  static async getSharingStats(toolId, teamId) {
    const matchStage = {
      action: { $in: ['CONFIG_SHARE', 'CONFIG_UNSHARE'] }
    };

    if (toolId) matchStage.toolId = toolId;
    if (teamId) matchStage['config.teamId'] = teamId;

    const sharingStats = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: 'toolconfigs',
          localField: 'resourceId',
          foreignField: '_id',
          as: 'config'
        }
      },
      { $unwind: '$config' },
      {
        $group: {
          _id: '$config.teamId',
          shareCount: {
            $sum: { $cond: [{ $eq: ['$action', 'CONFIG_SHARE'] }, 1, 0] }
          },
          unshareCount: {
            $sum: { $cond: [{ $eq: ['$action', 'CONFIG_UNSHARE'] }, 1, 0] }
          },
          uniqueConfigs: { $addToSet: '$resourceId' },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          teamId: '$_id',
          shareCount: 1,
          unshareCount: 1,
          uniqueConfigsCount: { $size: '$uniqueConfigs' },
          uniqueUsersCount: { $size: '$uniqueUsers' }
        }
      }
    ]);

    return sharingStats;
  }

  /**
   * Get configuration performance metrics
   */
  static async getPerformanceMetrics(toolId, userId) {
    const matchStage = {
      action: 'CONFIG_LOAD'
    };

    if (toolId) matchStage.toolId = toolId;
    if (userId) matchStage.userId = userId;

    const performanceData = await AuditLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$toolId',
          avgLoadTime: { $avg: '$response.loadTime' },
          maxLoadTime: { $max: '$response.loadTime' },
          minLoadTime: { $min: '$response.loadTime' },
          totalLoads: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $ne: ['$response.status', 200] }, 1, 0] }
          }
        }
      },
      {
        $project: {
          toolId: '$_id',
          avgLoadTime: 1,
          maxLoadTime: 1,
          minLoadTime: 1,
          totalLoads: 1,
          errorCount: 1,
          errorRate: { $divide: ['$errorCount', '$totalLoads'] }
        }
      }
    ]);

    return performanceData;
  }

  /**
   * Get user engagement metrics
   */
  static async getUserEngagement(toolId, timeframe = '30d') {
    const timeLimit = new Date();
    timeLimit.setDate(timeLimit.getDate() - (timeframe === '30d' ? 30 : 7));

    const engagementData = await AuditLog.aggregate([
      {
        $match: {
          createdAt: { $gte: timeLimit },
          toolId: toolId ? toolId : { $exists: true },
          action: { $in: ['CONFIG_CREATE', 'CONFIG_LOAD', 'CONFIG_SHARE'] }
        }
      },
      {
        $group: {
          _id: '$userId',
          actions: { $push: '$action' },
          lastActivity: { $max: '$createdAt' },
          totalActions: { $sum: 1 }
        }
      },
      {
        $project: {
          userId: '$_id',
          createCount: { $size: { $filter: { input: '$actions', cond: { $eq: ['$$this', 'CONFIG_CREATE'] } } } },
          loadCount: { $size: { $filter: { input: '$actions', cond: { $eq: ['$$this', 'CONFIG_LOAD'] } } } },
          shareCount: { $size: { $filter: { input: '$actions', cond: { $eq: ['$$this', 'CONFIG_SHARE'] } } } },
          lastActivity: 1,
          totalActions: 1
        }
      },
      { $sort: { totalActions: -1 } },
      { $limit: 20 }
    ]);

    return engagementData;
  }

  /**
   * Get configuration health metrics
   */
  static async getConfigurationHealth(toolId, userId) {
    const matchStage = {};
    if (toolId) matchStage.toolId = toolId;
    if (userId) matchStage.userId = userId;

    const configs = await ToolConfig.find(matchStage).lean();

    const healthMetrics = configs.map(config => {
      const ageDays = Math.floor((Date.now() - config.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const lastUsedDays = config.lastUsedAt 
        ? Math.floor((Date.now() - config.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24))
        : ageDays;

      return {
        configId: config._id,
        configName: config.name,
        toolId: config.toolId,
        ageDays,
        lastUsedDays,
        usageCount: config.usageCount,
        isDefault: config.isDefault,
        isShared: config.isShared,
        tagsCount: config.tags.length,
        settingsSize: JSON.stringify(config.settings).length,
        healthScore: this.calculateHealthScore(config, ageDays, lastUsedDays)
      };
    });

    return healthMetrics.sort((a, b) => b.healthScore - a.healthScore);
  }

  /**
   * Calculate health score for a configuration
   */
  static calculateHealthScore(config, ageDays, lastUsedDays) {
    let score = 100;

    // Deduct points for age
    if (ageDays > 90) score -= 20;
    else if (ageDays > 30) score -= 10;

    // Deduct points for inactivity
    if (lastUsedDays > 30) score -= 20;
    else if (lastUsedDays > 7) score -= 10;

    // Deduct points for low usage
    if (config.usageCount < 5) score -= 10;
    else if (config.usageCount < 20) score -= 5;

    // Deduct points for no tags
    if (config.tags.length === 0) score -= 5;

    // Bonus for being default
    if (config.isDefault) score += 10;

    // Bonus for being shared
    if (config.isShared) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get configuration recommendations
   */
  static async getRecommendations(userId, toolId) {
    const configs = await ToolConfig.find({ userId, toolId }).lean();
    const recommendations = [];

    configs.forEach(config => {
      const ageDays = Math.floor((Date.now() - config.createdAt.getTime()) / (1000 * 60 * 60 * 24));
      const lastUsedDays = config.lastUsedAt 
        ? Math.floor((Date.now() - config.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24))
        : ageDays;

      // Recommendation: Archive old unused configs
      if (ageDays > 60 && lastUsedDays > 30 && config.usageCount < 3) {
        recommendations.push({
          configId: config._id,
          configName: config.name,
          type: 'ARCHIVE',
          message: `Consider archiving "${config.name}" - hasn't been used in ${lastUsedDays} days`,
          priority: 'LOW'
        });
      }

      // Recommendation: Share popular configs
      if (config.usageCount > 50 && !config.isShared) {
        recommendations.push({
          configId: config._id,
          configName: config.name,
          type: 'SHARE',
          message: `Consider sharing "${config.name}" - it's very popular with ${config.usageCount} uses`,
          priority: 'MEDIUM'
        });
      }

      // Recommendation: Add tags
      if (config.tags.length === 0) {
        recommendations.push({
          configId: config._id,
          configName: config.name,
          type: 'TAG',
          message: `Add tags to "${config.name}" for better organization`,
          priority: 'LOW'
        });
      }

      // Recommendation: Set as default
      if (config.usageCount > 20 && !config.isDefault) {
        recommendations.push({
          configId: config._id,
          configName: config.name,
          type: 'DEFAULT',
          message: `Consider setting "${config.name}" as default - it's frequently used`,
          priority: 'MEDIUM'
        });
      }
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Generate comprehensive analytics report
   */
  static async generateReport(toolId, userId, timeframe = '30d') {
    const [
      usageStats,
      creationTrends,
      sharingStats,
      performanceMetrics,
      userEngagement,
      healthMetrics,
      recommendations
    ] = await Promise.all([
      this.getUsageStats(toolId, userId, timeframe),
      this.getCreationTrends(toolId, userId, timeframe),
      this.getSharingStats(toolId),
      this.getPerformanceMetrics(toolId, userId),
      this.getUserEngagement(toolId, timeframe),
      this.getConfigurationHealth(toolId, userId),
      this.getRecommendations(userId, toolId)
    ]);

    return {
      reportDate: new Date().toISOString(),
      timeframe,
      summary: {
        totalConfigs: usageStats.length,
        totalLoads: usageStats.reduce((sum, stat) => sum + stat.usageCount, 0),
        uniqueUsers: userEngagement.length,
        sharedConfigs: sharingStats.reduce((sum, stat) => sum + stat.uniqueConfigsCount, 0),
        averageHealthScore: healthMetrics.length > 0 
          ? healthMetrics.reduce((sum, metric) => sum + metric.healthScore, 0) / healthMetrics.length 
          : 0
      },
      usageStats,
      creationTrends,
      sharingStats,
      performanceMetrics,
      userEngagement,
      healthMetrics,
      recommendations
    };
  }
}

module.exports = ConfigurationAnalytics;
