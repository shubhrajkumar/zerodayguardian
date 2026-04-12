const mongoose = require('mongoose');

const toolConfigSchema = new mongoose.Schema({
  // Basic configuration info
  name: {
    type: String,
    required: [true, 'Configuration name is required'],
    trim: true,
    maxlength: [100, 'Configuration name cannot exceed 100 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-_.,!?()]+$/.test(v);
      },
      message: 'Configuration name contains invalid characters'
    }
  },
  
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },

  // Tool association
  toolId: {
    type: Number,
    required: [true, 'Tool ID is required'],
    min: [1, 'Tool ID must be a positive number']
  },

  // User association
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required']
  },

  // Team collaboration
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },

  // Configuration data
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
    validate: {
      validator: function(v) {
        try {
          JSON.stringify(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'Settings contain invalid data'
    }
  },

  // Metadata
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z0-9\s\-_.,!?()]+$/.test(v);
      },
      message: 'Tag contains invalid characters'
    }
  }],

  version: {
    type: String,
    default: '1.0.0',
    required: true
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  isShared: {
    type: Boolean,
    default: false
  },

  // Sharing metadata
  sharedAt: {
    type: Date,
    default: null
  },

  sharedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Audit fields
  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  // Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },

  lastUsedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for performance
toolConfigSchema.index({ toolId: 1, userId: 1 });
toolConfigSchema.index({ userId: 1, toolId: 1, name: 1 }, { unique: true });
toolConfigSchema.index({ userId: 1, isDefault: 1 });
toolConfigSchema.index({ isShared: 1, teamId: 1 });
toolConfigSchema.index({ createdAt: -1 });
toolConfigSchema.index({ updatedAt: -1 });

// Compound indexes for search
toolConfigSchema.index({ 
  toolId: 1, 
  userId: 1, 
  name: 'text', 
  description: 'text',
  'tags': 'text' 
});

// Virtual for full text search
toolConfigSchema.virtual('searchText').get(function() {
  return `${this.name} ${this.description} ${this.tags.join(' ')}`.toLowerCase();
});

// Instance methods
toolConfigSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  return this.save();
};

toolConfigSchema.methods.updateLastUsed = function() {
  this.lastUsedAt = new Date();
  return this.save();
};

// Static methods
toolConfigSchema.statics.getDefaultForTool = function(toolId, userId) {
  return this.findOne({
    toolId,
    userId,
    isDefault: true
  });
};

toolConfigSchema.statics.getSharedForTeam = function(teamId, toolId) {
  const query = {
    isShared: true,
    teamId
  };
  
  if (toolId) {
    query.toolId = toolId;
  }

  return this.find(query)
    .populate('userId', 'name email')
    .sort({ updatedAt: -1 });
};

toolConfigSchema.statics.search = function(toolId, userId, query) {
  const searchQuery = {
    toolId,
    userId
  };

  if (query) {
    searchQuery.$or = [
      { name: { $regex: query, $options: 'i' } },
      { description: { $regex: query, $options: 'i' } },
      { tags: { $in: [new RegExp(query, 'i')] } }
    ];
  }

  return this.find(searchQuery)
    .sort({ updatedAt: -1 });
};

// Pre-save middleware
toolConfigSchema.pre('save', function(next) {
  // Ensure tags are unique and trimmed
  if (this.tags && Array.isArray(this.tags)) {
    this.tags = [...new Set(this.tags.map(tag => tag.trim()).filter(tag => tag.length > 0))];
  }

  // Update timestamp
  this.updatedAt = new Date();

  next();
});

// Pre-update middleware
toolConfigSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate'], function(next) {
  // Update timestamp for updates
  this.set({ updatedAt: new Date() });
  next();
});

toolConfigSchema.post('save', function(doc) {
});

toolConfigSchema.post('remove', function(doc) {
});

module.exports = mongoose.model('ToolConfig', toolConfigSchema);
