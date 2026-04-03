const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Audit log schema
const auditLogSchema = new mongoose.Schema({
  // Unique identifier for the audit log entry
  auditId: {
    type: String,
    default: uuidv4,
    unique: true
  },

  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  userEmail: {
    type: String,
    required: true
  },

  // Action details
  action: {
    type: String,
    required: true,
    enum: [
      'CONFIG_CREATE',
      'CONFIG_UPDATE', 
      'CONFIG_DELETE',
      'CONFIG_LOAD',
      'CONFIG_SHARE',
      'CONFIG_UNSHARE',
      'CONFIG_IMPORT',
      'CONFIG_EXPORT',
      'CONFIG_SET_DEFAULT',
      'CONFIG_SEARCH'
    ]
  },

  // Resource details
  resourceType: {
    type: String,
    enum: ['tool_config', 'user_config', 'team_config'],
    required: true
  },

  resourceId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'resourceType'
  },

  // Tool information
  toolId: {
    type: Number,
    required: true
  },

  // Request details
  request: {
    ip: String,
    userAgent: String,
    method: String,
    url: String,
    body: mongoose.Schema.Types.Mixed,
    query: mongoose.Schema.Types.Mixed
  },

  // Response details
  response: {
    status: Number,
    success: Boolean,
    message: String
  },

  // Changes made (for create/update operations)
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },

  // Metadata
  metadata: {
    sessionId: String,
    requestId: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },

  // Risk assessment
  riskLevel: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  },

  // Compliance flags
  compliance: {
    gdpr: Boolean,
    hipaa: Boolean,
    pci: Boolean,
    sox: Boolean
  }
}, {
  timestamps: true
});

// Indexes for performance
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ toolId: 1, action: 1 });
auditLogSchema.index({ 'metadata.timestamp': -1 });
auditLogSchema.index({ riskLevel: 1 });
auditLogSchema.index({ 'request.ip': 1 });

// Static methods for audit logging
auditLogSchema.statics.logAction = async function(userId, userEmail, action, details) {
  try {
    const auditLog = new this({
      userId,
      userEmail,
      action,
      resourceType: details.resourceType || 'tool_config',
      resourceId: details.resourceId,
      toolId: details.toolId,
      request: details.request || {},
      response: details.response || {},
      changes: details.changes || {},
      metadata: {
        sessionId: details.sessionId,
        requestId: details.requestId || uuidv4(),
        timestamp: new Date()
      },
      riskLevel: details.riskLevel || 'LOW',
      compliance: details.compliance || {}
    });

    await auditLog.save();
    
    // Trigger alerts for high-risk actions
    if (auditLog.riskLevel === 'HIGH' || auditLog.riskLevel === 'CRITICAL') {
      this.triggerAlert(auditLog);
    }

    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Method to trigger alerts for high-risk actions
auditLogSchema.statics.triggerAlert = function(auditLog) {
  // Implementation would depend on your alerting system
  // This could send emails, Slack notifications, etc.
  console.warn(`HIGH RISK ACTION DETECTED: ${auditLog.action} by ${auditLog.userEmail}`);
  
  // Example: Send alert to security team
  // await sendSecurityAlert(auditLog);
};

// Static method to get audit logs with filters
auditLogSchema.statics.getLogs = function(filters = {}) {
  const query = {};
  
  if (filters.userId) query.userId = filters.userId;
  if (filters.action) query.action = filters.action;
  if (filters.toolId) query.toolId = filters.toolId;
  if (filters.riskLevel) query.riskLevel = filters.riskLevel;
  
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
  }

  return this.find(query)
    .populate('userId', 'name email')
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100);
};

// Static method to get suspicious activities
auditLogSchema.statics.getSuspiciousActivities = function(timeframe = '24h') {
  const timeLimit = new Date();
  timeLimit.setHours(timeLimit.getHours() - (timeframe === '24h' ? 24 : 1));

  return this.find({
    createdAt: { $gte: timeLimit },
    $or: [
      { riskLevel: { $in: ['HIGH', 'CRITICAL'] } },
      { action: { $in: ['CONFIG_DELETE', 'CONFIG_SHARE'] } },
      { 'request.ip': { $exists: true } }
    ]
  })
  .populate('userId', 'name email')
  .sort({ createdAt: -1 });
};

// Static method to get configuration usage statistics
auditLogSchema.statics.getConfigUsageStats = function(toolId, userId, timeframe = '7d') {
  const timeLimit = new Date();
  timeLimit.setDate(timeLimit.getDate() - (timeframe === '7d' ? 7 : 30));

  const matchStage = {
    createdAt: { $gte: timeLimit },
    action: 'CONFIG_LOAD'
  };

  if (toolId) matchStage.toolId = toolId;
  if (userId) matchStage.userId = userId;

  return this.aggregate([
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
        usageCount: 1,
        lastUsed: 1,
        uniqueUsersCount: { $size: '$uniqueUsers' }
      }
    },
    { $sort: { usageCount: -1 } }
  ]);
};

module.exports = mongoose.model('AuditLog', auditLogSchema);