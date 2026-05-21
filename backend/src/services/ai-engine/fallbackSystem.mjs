import { env } from "../../config/env.mjs";
import { logError, logInfo, logWarn } from "../../utils/logger.mjs";
import { aiErrorHandler } from "./errorHandler.mjs";

/**
 * Intelligent fallback system for AI responses
 */
export class FallbackSystem {
  constructor() {
    this.fallbackKnowledge = this.initializeFallbackKnowledge();
    this.responseTemplates = this.initializeResponseTemplates();
    this.lastFallbackTime = 0;
    this.fallbackCount = 0;
  }

  /**
   * Initialize fallback knowledge base
   */
  initializeFallbackKnowledge() {
    return {
      cybersecurity: {
        topics: [
          'network security',
          'malware analysis',
          'incident response',
          'vulnerability assessment',
          'penetration testing',
          'security monitoring',
          'threat intelligence',
          'security policies'
        ],
        responses: {
          'network security': 'Network security involves protecting computer networks from unauthorized access, misuse, or damage. Key components include firewalls, intrusion detection systems, VPNs, and network segmentation.',
          'malware analysis': 'Malware analysis is the process of examining malicious software to understand its behavior, purpose, and capabilities. This helps in developing detection signatures and understanding attack techniques.',
          'incident response': 'Incident response is the process of managing and mitigating security incidents. A typical incident response plan includes preparation, identification, containment, eradication, recovery, and lessons learned phases.',
          'vulnerability assessment': 'Vulnerability assessment is the systematic process of identifying, quantifying, and prioritizing security vulnerabilities in systems and applications.'
        }
      },
      programming: {
        topics: [
          'javascript',
          'python',
          'react',
          'node.js',
          'security',
          'debugging',
          'algorithms',
          'data structures'
        ],
        responses: {
          'javascript': 'JavaScript is a versatile programming language commonly used for web development. It supports both functional and object-oriented programming paradigms.',
          'python': 'Python is a high-level, interpreted programming language known for its readability and extensive library ecosystem. It\'s widely used in data science, web development, and automation.',
          'react': 'React is a JavaScript library for building user interfaces, particularly single-page applications. It uses a component-based architecture and virtual DOM for efficient rendering.',
          'security': 'Security in programming involves implementing practices and techniques to protect applications from vulnerabilities, attacks, and unauthorized access.'
        }
      },
      general: {
        topics: [
          'help',
          'support',
          'documentation',
          'troubleshooting',
          'guidance',
          'information'
        ],
        responses: {
          'help': 'I\'m here to help you with cybersecurity, programming, and technical questions. While my AI capabilities are temporarily limited, I can still provide guidance based on my knowledge base.',
          'support': 'For technical support, please check our documentation or contact our support team. In the meantime, I can provide general guidance and information.',
          'documentation': 'Documentation is available in our help section. You can find guides, tutorials, and API documentation to help you get started.',
          'troubleshooting': 'When troubleshooting technical issues, start by identifying the problem, checking logs, verifying configurations, and testing components systematically.'
        }
      }
    };
  }

  /**
   * Initialize response templates
   */
  initializeResponseTemplates() {
    return {
      error_response: {
        title: "AI System Temporarily Limited",
        message: "I'm currently experiencing technical difficulties with my AI processing capabilities.",
        explanation: "This is likely due to a temporary issue with my AI service providers or configuration.",
        suggestions: [
          "Try your request again in a moment",
          "Check if your API keys are configured correctly",
          "Contact support if this issue persists",
          "Review our troubleshooting guide"
        ]
      },
      fallback_response: {
        title: "Fallback Response",
        message: "While my AI capabilities are limited, I can still provide helpful information based on my knowledge base.",
        explanation: "I'm using my fallback knowledge to assist you with your request.",
        suggestions: [
          "Try a more specific question",
          "Check back later for full AI capabilities",
          "Explore our documentation for additional help"
        ]
      },
      maintenance_response: {
        title: "System Maintenance",
        message: "The AI system is currently undergoing maintenance or experiencing service issues.",
        explanation: "This may be due to scheduled maintenance, provider issues, or configuration problems.",
        suggestions: [
          "Check our status page for updates",
          "Try again in a few minutes",
          "Contact support for urgent matters"
        ]
      }
    };
  }

  /**
   * Generate fallback response based on user input
   */
  async generateFallbackResponse(userInput, errorInfo = null) {
    const startTime = Date.now();
    this.fallbackCount++;
    this.lastFallbackTime = startTime;

    logInfo('Generating fallback response', {
      inputLength: userInput.length,
      errorType: errorInfo?.type || 'none'
    });

    // Analyze user input to determine topic
    const topicAnalysis = this.analyzeTopic(userInput);
    
    // Generate response based on topic and error context
    const response = this.buildFallbackResponse(userInput, topicAnalysis, errorInfo);
    
    const duration = Date.now() - startTime;

    logInfo('Fallback response generated', {
      duration,
      topic: topicAnalysis.topic,
      confidence: topicAnalysis.confidence
    });

    return response;
  }

  /**
   * Analyze user input to determine topic
   */
  analyzeTopic(userInput) {
    const input = userInput.toLowerCase();
    const analysis = {
      topic: 'general',
      confidence: 0.5,
      keywords: []
    };

    // Check for cybersecurity topics
    for (const topic of this.fallbackKnowledge.cybersecurity.topics) {
      if (input.includes(topic)) {
        analysis.topic = 'cybersecurity';
        analysis.confidence = 0.8;
        analysis.keywords.push(topic);
      }
    }

    // Check for programming topics
    for (const topic of this.fallbackKnowledge.programming.topics) {
      if (input.includes(topic)) {
        analysis.topic = 'programming';
        analysis.confidence = 0.8;
        analysis.keywords.push(topic);
      }
    }

    // Check for general help topics
    for (const topic of this.fallbackKnowledge.general.topics) {
      if (input.includes(topic)) {
        analysis.topic = 'general';
        analysis.confidence = 0.7;
        analysis.keywords.push(topic);
      }
    }

    // Check for specific question patterns
    if (input.includes('how') || input.includes('what') || input.includes('why')) {
      analysis.confidence += 0.1;
    }

    if (input.includes('error') || input.includes('problem') || input.includes('issue')) {
      analysis.confidence += 0.1;
    }

    return analysis;
  }

  /**
   * Build comprehensive fallback response
   */
  buildFallbackResponse(userInput, topicAnalysis, errorInfo) {
    const template = this.selectTemplate(errorInfo);
    const topicResponse = this.getTopicResponse(topicAnalysis.topic, userInput);
    
    const response = {
      type: 'fallback',
      title: template.title,
      message: template.message,
      explanation: template.explanation,
      suggestions: template.suggestions,
      topic: topicAnalysis.topic,
      topicConfidence: topicAnalysis.confidence,
      userInput: userInput,
      timestamp: new Date().toISOString(),
      fallbackCount: this.fallbackCount,
      errorContext: errorInfo ? {
        type: errorInfo.type,
        message: errorInfo.message,
        provider: errorInfo.provider
      } : null,
      topicResponse: topicResponse,
      helpLinks: this.generateHelpLinks(topicAnalysis.topic)
    };

    return response;
  }

  /**
   * Select appropriate response template
   */
  selectTemplate(errorInfo) {
    if (!errorInfo) {
      return this.responseTemplates.fallback_response;
    }

    switch (errorInfo.type) {
      case 'auth':
        return {
          ...this.responseTemplates.error_response,
          message: "I'm currently unable to access my AI capabilities due to authentication issues.",
          explanation: "This is likely due to invalid or missing API keys. Please check your configuration."
        };
      case 'rate_limit':
        return {
          ...this.responseTemplates.error_response,
          message: "I'm temporarily unable to process requests due to rate limiting.",
          explanation: "The AI service has reached its usage limits. Please try again in a moment."
        };
      case 'timeout':
        return {
          ...this.responseTemplates.error_response,
          message: "I'm experiencing connectivity issues with my AI services.",
          explanation: "There may be network problems or the service is temporarily unavailable."
        };
      case 'network':
        return {
          ...this.responseTemplates.error_response,
          message: "I'm unable to connect to my AI services due to network issues.",
          explanation: "There may be connectivity problems or the service is down."
        };
      default:
        return this.responseTemplates.fallback_response;
    }
  }

  /**
   * Get topic-specific response
   */
  getTopicResponse(topic, userInput) {
    const knowledge = this.fallbackKnowledge[topic];
    if (!knowledge) {
      return "I can provide general information while my AI capabilities are restored.";
    }

    // Try to find a specific response for the user's query
    const input = userInput.toLowerCase();
    for (const [key, response] of Object.entries(knowledge.responses)) {
      if (input.includes(key)) {
        return response;
      }
    }

    // Return general topic information
    return `Here's some general information about ${topic}: ${Object.values(knowledge.responses)[0]}`;
  }

  /**
   * Generate helpful links based on topic
   */
  generateHelpLinks(topic) {
    const links = {
      cybersecurity: [
        { text: "Security Best Practices", url: "/docs/security-best-practices" },
        { text: "Incident Response Guide", url: "/docs/incident-response" },
        { text: "Vulnerability Assessment", url: "/docs/vulnerability-assessment" }
      ],
      programming: [
        { text: "Developer Documentation", url: "/docs/developer-guide" },
        { text: "API Reference", url: "/docs/api-reference" },
        { text: "Code Examples", url: "/docs/code-examples" }
      ],
      general: [
        { text: "Help Center", url: "/help" },
        { text: "Troubleshooting Guide", url: "/docs/troubleshooting" },
        { text: "Contact Support", url: "/support" }
      ]
    };

    return links[topic] || links.general;
  }

  /**
   * Generate plain text fallback response
   */
  generatePlainTextResponse(userInput, errorInfo = null) {
    const topicAnalysis = this.analyzeTopic(userInput);
    const topicResponse = this.getTopicResponse(topicAnalysis.topic, userInput);
    const template = this.selectTemplate(errorInfo);

    const plainText = `${template.title}

${template.message}

${template.explanation}

${topicResponse}

${template.suggestions.map(s => `- ${s}`).join('\n')}

For additional help, please visit our documentation or contact support.`;

    return plainText;
  }

  /**
   * Get fallback system statistics
   */
  getFallbackStats() {
    return {
      totalFallbacks: this.fallbackCount,
      lastFallbackTime: new Date(this.lastFallbackTime).toISOString(),
      averageResponseTime: 'N/A', // Would need to track response times
      mostCommonTopics: this.getMostCommonTopics(),
      errorTypesHandled: this.getErrorTypesHandled()
    };
  }

  /**
   * Get most common topics (placeholder implementation)
   */
  getMostCommonTopics() {
    return [
      { topic: 'general', count: Math.floor(this.fallbackCount * 0.4) },
      { topic: 'cybersecurity', count: Math.floor(this.fallbackCount * 0.35) },
      { topic: 'programming', count: Math.floor(this.fallbackCount * 0.25) }
    ];
  }

  /**
   * Get error types handled (placeholder implementation)
   */
  getErrorTypesHandled() {
    return [
      { type: 'auth', count: Math.floor(this.fallbackCount * 0.3) },
      { type: 'network', count: Math.floor(this.fallbackCount * 0.25) },
      { type: 'timeout', count: Math.floor(this.fallbackCount * 0.2) },
      { type: 'rate_limit', count: Math.floor(this.fallbackCount * 0.15) },
      { type: 'unknown', count: Math.floor(this.fallbackCount * 0.1) }
    ];
  }

  /**
   * Reset fallback statistics
   */
  resetStats() {
    this.fallbackCount = 0;
    this.lastFallbackTime = 0;
    logInfo('Reset fallback system statistics');
  }
}

// Create singleton instance
export const fallbackSystem = new FallbackSystem();