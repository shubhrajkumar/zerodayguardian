const NO_VERIFIED_DATA = "No verified data.";

export interface SandboxSession {
  id: string;
  name: string;
  type: 'command' | 'script' | 'tool' | 'lab';
  status: 'running' | 'completed' | 'failed' | 'terminated';
  startTime: Date;
  endTime?: Date;
  output: SandboxOutput[];
  environment: SandboxEnvironment;
  resources: SandboxResources;
  metadata?: {
    labId?: string;
    currentStep?: number;
    score?: number;
    [key: string]: unknown;
  };
}

export interface SandboxOutput {
  id: string;
  type: 'stdout' | 'stderr' | 'info' | 'warning' | 'error';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SandboxEnvironment {
  id: string;
  name: string;
  os: 'linux' | 'windows' | 'macos';
  architecture: 'x64' | 'arm64';
  memory: number; // MB
  storage: number; // GB
  network: boolean;
  isolation: 'full' | 'partial' | 'none';
  preInstalledTools: string[];
}

export interface SandboxResources {
  cpuUsage: number; // percentage
  memoryUsage: number; // MB
  diskUsage: number; // MB
  networkUsage: number; // bytes
  maxCpu: number;
  maxMemory: number;
  maxDisk: number;
  maxNetwork: number;
}

export interface LabDefinition {
  id: string;
  title: string;
  description: string;
  category: 'sqli' | 'xss' | 'phishing' | 'malware' | 'network' | 'forensics';
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  estimatedTime: number; // minutes
  objectives: string[];
  steps: LabStep[];
  hints: string[];
  solutions: string[];
  prerequisites: string[];
}

export interface LabStep {
  id: string;
  title: string;
  description: string;
  commands: string[];
  expectedOutput: string;
  validation?: (output: string) => boolean;
}

export interface PreBuiltLab extends LabDefinition {
  type: 'interactive' | 'simulation' | 'challenge';
  autoGrading: boolean;
  scoring: {
    maxScore: number;
    timeBonus: number;
    accuracyBonus: number;
  };
}

export class CyberSandbox {
  private static sessions: Map<string, SandboxSession> = new Map();
  private static environments: SandboxEnvironment[] = [];
  private static labs: PreBuiltLab[] = [];

  // Initialize sandbox environments
  static initializeEnvironments(): void {
    this.environments = [
      {
        id: 'env-linux-basic',
        name: 'Linux Basic Environment',
        os: 'linux',
        architecture: 'x64',
        memory: 2048,
        storage: 10,
        network: true,
        isolation: 'full',
        preInstalledTools: ['bash', 'python3', 'curl', 'wget', 'git', 'vim', 'nano']
      },
      {
        id: 'env-windows-dev',
        name: 'Windows Development Environment',
        os: 'windows',
        architecture: 'x64',
        memory: 4096,
        storage: 20,
        network: true,
        isolation: 'full',
        preInstalledTools: ['powershell', 'cmd', 'python', 'git', 'notepad++']
      },
      {
        id: 'env-macos-secure',
        name: 'macOS Security Lab',
        os: 'macos',
        architecture: 'arm64',
        memory: 8192,
        storage: 50,
        network: true,
        isolation: 'full',
        preInstalledTools: ['zsh', 'python3', 'brew', 'git', 'vim', 'xcode']
      }
    ];
  }

  // Create a new sandbox session
  static async createSession(
    name: string,
    type: SandboxSession['type'],
    environmentId: string
  ): Promise<SandboxSession> {
    const environment = this.environments.find(env => env.id === environmentId);
    if (!environment) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    const session: SandboxSession = {
      id: crypto.randomUUID(),
      name,
      type,
      status: 'running',
      startTime: new Date(),
      output: [],
      environment,
      resources: {
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        networkUsage: 0,
        maxCpu: 100,
        maxMemory: environment.memory,
        maxDisk: environment.storage * 1024, // Convert GB to MB
        maxNetwork: 1000000 // 1GB
      }
    };

    this.sessions.set(session.id, session);
    this.logOutput(session.id, 'warning', NO_VERIFIED_DATA);
    this.logOutput(session.id, 'info', `Sandbox session requested: ${name}`);
    this.logOutput(session.id, 'info', `Environment: ${environment.name}`);
    this.logOutput(session.id, 'info', `Type: ${type}`);

    return session;
  }

  // Execute command in sandbox
  static async executeCommand(
    sessionId: string,
    command: string,
    timeout: number = 30000
  ): Promise<SandboxOutput> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== 'running') {
      throw new Error(`Session ${sessionId} is not running`);
    }

    this.logOutput(sessionId, 'warning', NO_VERIFIED_DATA);
    const output: SandboxOutput = {
      id: crypto.randomUUID(),
      type: 'warning',
      content: NO_VERIFIED_DATA,
      timestamp: new Date(),
      metadata: { command, timeout }
    };
    this.logOutput(sessionId, output.type, output.content, output.metadata);

    return output;
  }

  // Run script in sandbox
  static async runScript(
    sessionId: string,
    scriptContent: string,
    scriptType: 'bash' | 'python' | 'powershell'
  ): Promise<SandboxOutput[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const outputs: SandboxOutput[] = [];
    
    // Split script into commands and execute
    const commands = this.parseScript(scriptContent, scriptType);
    
    for (const command of commands) {
      try {
        const output = await this.executeCommand(sessionId, command);
        outputs.push(output);
      } catch (error) {
        outputs.push({
          id: crypto.randomUUID(),
          type: 'error',
          content: `Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        });
        break;
      }
    }

    return outputs;
  }

  // Start pre-built lab
  static async startLab(labId: string, sessionId?: string): Promise<SandboxSession> {
    void sessionId;
    const lab = this.labs.find(l => l.id === labId);
    if (!lab) {
      throw new Error(`Lab ${labId} not found`);
    }

    const session = await this.createSession(
      lab.title,
      'lab',
      'env-linux-basic'
    );

    this.logOutput(session.id, 'warning', NO_VERIFIED_DATA);
    this.logOutput(session.id, 'info', `Lab requested: ${lab.title}`);

    // Initialize lab steps
    session.metadata = { labId, currentStep: 0, score: 0 };

    return session;
  }

  // Complete lab step
  static async completeLabStep(
    sessionId: string,
    stepId: string,
    userOutput: string
  ): Promise<{ success: boolean; feedback: string; score: number }> {
    void sessionId;
    void stepId;
    void userOutput;
    return { success: false, feedback: NO_VERIFIED_DATA, score: 0 };
  }

  // Get session status
  static getSession(sessionId: string): SandboxSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // Get session output
  static getSessionOutput(sessionId: string): SandboxOutput[] {
    const session = this.sessions.get(sessionId);
    return session ? session.output : [];
  }

  // Terminate session
  static async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'terminated';
    session.endTime = new Date();
    this.logOutput(sessionId, 'info', 'Session terminated by user');

    // Stop resource monitoring
    this.stopResourceMonitoring(sessionId);
  }

  // Get available environments
  static getEnvironments(): SandboxEnvironment[] {
    return this.environments;
  }

  // Get available labs
  static getLabs(): PreBuiltLab[] {
    return this.labs;
  }

  // Initialize pre-built labs
  static initializeLabs(): void {
    this.labs = [
      {
        id: 'lab-sqli-1',
        title: 'SQL Injection Basics',
        description: 'Learn the fundamentals of SQL injection attacks',
        category: 'sqli',
        difficulty: 'beginner',
        estimatedTime: 30,
        type: 'interactive',
        autoGrading: true,
        scoring: { maxScore: 100, timeBonus: 20, accuracyBonus: 30 },
        objectives: [
          'Understand SQL injection vulnerabilities',
          'Learn basic injection techniques',
          'Practice with real-world scenarios'
        ],
        steps: [
          {
            id: 'step-1',
            title: 'Identify vulnerable parameter',
            description: 'Find the input field that accepts user input',
            commands: ['curl -X GET "http://vulnerable-app.com/search?q=test"'],
            expectedOutput: 'Search results for: test',
            validation: (output) => output.includes('Search results')
          },
          {
            id: 'step-2',
            title: 'Test for SQL injection',
            description: 'Try basic SQL injection payload',
            commands: ['curl -X GET "http://vulnerable-app.com/search?q=\' OR 1=1--"'],
            expectedOutput: 'All database records',
            validation: (output) => output.includes('All database records')
          }
        ],
        hints: [
          'Look for input fields that interact with databases',
          'Try common SQL injection payloads',
          'Check for error messages that reveal database structure'
        ],
        solutions: [
          'Use single quotes to break out of SQL strings',
          'Use OR 1=1 to bypass authentication',
          'Use -- to comment out the rest of the query'
        ],
        prerequisites: ['Basic understanding of SQL', 'HTTP request knowledge']
      },
      {
        id: 'lab-xss-1',
        title: 'Cross-Site Scripting (XSS) Fundamentals',
        description: 'Learn to identify and exploit XSS vulnerabilities',
        category: 'xss',
        difficulty: 'beginner',
        estimatedTime: 25,
        type: 'interactive',
        autoGrading: true,
        scoring: { maxScore: 100, timeBonus: 20, accuracyBonus: 30 },
        objectives: [
          'Understand XSS attack vectors',
          'Learn to craft malicious scripts',
          'Practice defensive techniques'
        ],
        steps: [
          {
            id: 'step-1',
            title: 'Find input field',
            description: 'Locate user input that gets reflected in output',
            commands: ['curl -X POST -d "comment=Hello" http://vulnerable-app.com/comment'],
            expectedOutput: 'Your comment: Hello',
            validation: (output) => output.includes('Your comment: Hello')
          },
          {
            id: 'step-2',
            title: 'Test for XSS',
            description: 'Inject JavaScript code',
            commands: ['curl -X POST -d "comment=<script>alert(\'XSS\')</script>" http://vulnerable-app.com/comment'],
            expectedOutput: 'JavaScript executed',
            validation: (output) => output.includes('<script>alert(\'XSS\')</script>')
          }
        ],
        hints: [
          'Look for user input that appears in HTML output',
          'Try basic script tags',
          'Check for input sanitization'
        ],
        solutions: [
          'Use <script> tags to execute JavaScript',
          'Try event handlers like onclick',
          'Use HTML encoding to bypass filters'
        ],
        prerequisites: ['HTML basics', 'JavaScript knowledge']
      }
    ];
  }

  // Private methods
  private static logOutput(
    sessionId: string,
    type: SandboxOutput['type'],
    content: string,
    metadata?: Record<string, unknown>
  ): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const output: SandboxOutput = {
        id: crypto.randomUUID(),
        type,
        content,
        timestamp: new Date(),
        metadata
      };
      session.output.push(output);
    }
  }

  private static parseScript(scriptContent: string, scriptType: string): string[] {
    // Simple script parsing - in real implementation, this would be more sophisticated
    switch (scriptType) {
      case 'bash':
        return scriptContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
      case 'python':
        return ['python3 -c "' + scriptContent.replace(/"/g, '\\"') + '"'];
      case 'powershell':
        return ['powershell -Command "' + scriptContent.replace(/"/g, '\\"') + '"'];
      default:
        return [scriptContent];
    }
  }

  private static stopResourceMonitoring(sessionId: string): void {
    void sessionId;
    // In real implementation, this would clean up monitoring resources
  }
}

// Initialize sandbox on module load
CyberSandbox.initializeEnvironments();
CyberSandbox.initializeLabs();

// Export for use in components
export default CyberSandbox;
