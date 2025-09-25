import { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolResponse } from '../types/index.js';
import { createSafeResult } from '../types/schemas.js';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { spawn } from 'child_process';

// Types for security audit
interface SecurityIssue {
  type: 'secret' | 'dangerous_function' | 'vulnerability';
  file: string;
  line?: number;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

interface SecurityAuditResult {
  issues: SecurityIssue[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  directory: string;
  timestamp: string;
  packageManager?: string;
}

// Types for dependency analysis
interface Dependency {
  name: string;
  version: string;
  type: 'runtime' | 'dev';
}

interface DependencyAnalysisResult {
  manager: string;
  dependencies: Dependency[];
  total: number;
  runtime: number;
  dev: number;
  directory: string;
  timestamp: string;
  files: string[];
}

// Types for vulnerability checking
interface Vulnerability {
  name: string;
  version: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  advisory: string;
  source: string;
}

interface VulnerabilityCheckResult {
  vulnerabilities: Vulnerability[];
  summary: {
    total: number;
    bySeverity: Record<string, number>;
  };
  manager: string;
  directory: string;
  timestamp: string;
  toolAvailable: boolean;
  warnings?: string[];
}

// Types for dependency tree analysis
interface DependencyTreeNode {
  name: string;
  version: string;
  type: 'runtime' | 'dev';
  dependencies?: DependencyTreeNode[];
}

interface DependencyTreeResult {
  manager: string;
  tree: DependencyTreeNode[];
  total: number;
  maxDepth: number;
  directory: string;
  timestamp: string;
  toolAvailable: boolean;
  warnings?: string[];
}

// Types for license compliance checking
interface LicenseCompliance {
  name: string;
  version: string;
  license: string;
  status: 'allowed' | 'denied' | 'unknown';
}

interface LicenseComplianceResult {
  manager: string;
  compliance: LicenseCompliance[];
  summary: {
    total: number;
    allowed: number;
    denied: number;
    unknown: number;
  };
  directory: string;
  timestamp: string;
  toolAvailable: boolean;
  allowedLicenses?: string[];
  deniedLicenses?: string[];
  warnings?: string[];
}

/**
 * Create Security & Dependency tools
 */
export function createSecurityTools(): Tool[] {
  return [
    {
      name: 'security_audit',
      description: 'Perform comprehensive security audit of the codebase',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to audit (default: current directory)',
            default: '.'
          },
          includeDevDependencies: {
            type: 'boolean',
            description: 'Include development dependencies in audit',
            default: true
          },
          severity: {
            type: 'string',
            description: 'Minimum severity level to report',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
          },
          outputFormat: {
            type: 'string',
            description: 'Output format for audit results',
            enum: ['json', 'table', 'summary'],
            default: 'json'
          }
        },
        required: []
      }
    },
    {
      name: 'analyze_dependencies',
      description: 'Analyze project dependencies and their relationships',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          packageManager: {
            type: 'string',
            description: 'Package manager to use for analysis',
            enum: ['auto', 'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'maven', 'gradle'],
            default: 'auto'
          },
          includeDevDependencies: {
            type: 'boolean',
            description: 'Include development dependencies in analysis',
            default: true
          },
          depth: {
            type: 'number',
            description: 'Maximum depth for dependency tree analysis',
            default: 3
          }
        },
        required: []
      }
    },
    {
      name: 'check_vulnerabilities',
      description: 'Check for known security vulnerabilities in dependencies',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to check (default: current directory)',
            default: '.'
          },
          packageManager: {
            type: 'string',
            description: 'Package manager to use for vulnerability check',
            enum: ['auto', 'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'maven', 'gradle'],
            default: 'auto'
          },
          severity: {
            type: 'string',
            description: 'Minimum severity level to report',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
          },
          includeDevDependencies: {
            type: 'boolean',
            description: 'Include development dependencies in vulnerability check',
            default: true
          },
          outputFormat: {
            type: 'string',
            description: 'Output format for vulnerability results',
            enum: ['json', 'table', 'summary'],
            default: 'json'
          }
        },
        required: []
      }
    },
    {
      name: 'dependency_tree_analysis',
      description: 'Analyze dependency tree structure and relationships',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to analyze (default: current directory)',
            default: '.'
          },
          packageManager: {
            type: 'string',
            description: 'Package manager to use for tree analysis',
            enum: ['auto', 'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'maven', 'gradle'],
            default: 'auto'
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum depth for tree analysis',
            default: 5
          },
          includeDevDependencies: {
            type: 'boolean',
            description: 'Include development dependencies in tree analysis',
            default: true
          },
          outputFormat: {
            type: 'string',
            description: 'Output format for tree analysis',
            enum: ['json', 'tree', 'graph', 'summary'],
            default: 'json'
          }
        },
        required: []
      }
    },
    {
      name: 'license_compliance_check',
      description: 'Check license compliance and compatibility',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory to check (default: current directory)',
            default: '.'
          },
          packageManager: {
            type: 'string',
            description: 'Package manager to use for license check',
            enum: ['auto', 'npm', 'yarn', 'pnpm', 'pip', 'poetry', 'cargo', 'maven', 'gradle'],
            default: 'auto'
          },
          allowedLicenses: {
            type: 'array',
            description: 'List of allowed licenses',
            items: {
              type: 'string'
            },
            default: ['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC', 'Unlicense']
          },
          deniedLicenses: {
            type: 'array',
            description: 'List of denied licenses',
            items: {
              type: 'string'
            },
            default: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0']
          },
          includeDevDependencies: {
            type: 'boolean',
            description: 'Include development dependencies in license check',
            default: true
          },
          outputFormat: {
            type: 'string',
            description: 'Output format for license compliance results',
            enum: ['json', 'table', 'summary'],
            default: 'json'
          }
        },
        required: []
      }
    }
  ];
}

/**
 * Scan for secrets in .env files
 */
function scanForSecrets(directory: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  const secretPatterns = [
    { pattern: /API_KEY\s*=\s*['"][^'"]+['"]/i, message: 'API key found in environment file' },
    { pattern: /SECRET\s*=\s*['"][^'"]+['"]/i, message: 'Secret found in environment file' },
    { pattern: /PASSWORD\s*=\s*['"][^'"]+['"]/i, message: 'Password found in environment file' },
    { pattern: /TOKEN\s*=\s*['"][^'"]+['"]/i, message: 'Token found in environment file' },
    { pattern: /PRIVATE_KEY\s*=\s*['"][^'"]+['"]/i, message: 'Private key found in environment file' }
  ];

  try {
    const envFiles = findEnvFiles(directory);
    
    for (const filePath of envFiles) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          for (const { pattern, message } of secretPatterns) {
            if (pattern.test(line)) {
              issues.push({
                type: 'secret',
                file: filePath,
                line: i + 1,
                message,
                severity: 'high'
              });
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  } catch (error) {
    // Continue with other checks if file scanning fails
  }

  return issues;
}

/**
 * Find all .env files in directory
 */
function findEnvFiles(directory: string): string[] {
  const envFiles: string[] = [];
  
  try {
    const items = readdirSync(directory);
    
    for (const item of items) {
      const fullPath = join(directory, item);
      
      if (statSync(fullPath).isDirectory()) {
        // Recursively search subdirectories (with depth limit)
        if (item !== 'node_modules' && item !== '.git') {
          envFiles.push(...findEnvFiles(fullPath));
        }
      } else if (item.startsWith('.env')) {
        envFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return envFiles;
}

/**
 * Scan for dangerous functions in code files
 */
function scanForDangerousFunctions(directory: string): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  
  // Node.js dangerous patterns
  const nodePatterns = [
    { pattern: /eval\s*\(/g, message: 'Use of eval() function detected', severity: 'critical' as const },
    { pattern: /child_process\.exec\s*\(/g, message: 'Use of child_process.exec() detected', severity: 'high' as const },
    { pattern: /child_process\.spawn\s*\(/g, message: 'Use of child_process.spawn() detected', severity: 'medium' as const },
    { pattern: /fs\.writeFileSync\s*\(/g, message: 'Use of fs.writeFileSync() detected', severity: 'medium' as const },
    { pattern: /require\s*\(\s*['"][^'"]*['"]\s*\)/g, message: 'Dynamic require() detected', severity: 'medium' as const }
  ];
  
  // Python dangerous patterns
  const pythonPatterns = [
    { pattern: /os\.system\s*\(/g, message: 'Use of os.system() detected', severity: 'critical' as const },
    { pattern: /subprocess\.Popen\s*\(/g, message: 'Use of subprocess.Popen() detected', severity: 'high' as const },
    { pattern: /subprocess\.call\s*\(/g, message: 'Use of subprocess.call() detected', severity: 'high' as const },
    { pattern: /exec\s*\(/g, message: 'Use of exec() function detected', severity: 'critical' as const },
    { pattern: /eval\s*\(/g, message: 'Use of eval() function detected', severity: 'critical' as const }
  ];
  
  try {
    const codeFiles = findCodeFiles(directory);
    
    for (const filePath of codeFiles) {
      try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check Node.js patterns
          if (filePath.endsWith('.js') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.tsx')) {
            for (const { pattern, message, severity } of nodePatterns) {
              if (pattern.test(line)) {
                issues.push({
                  type: 'dangerous_function',
                  file: filePath,
                  line: i + 1,
                  message,
                  severity
                });
              }
            }
          }
          
          // Check Python patterns
          if (filePath.endsWith('.py')) {
            for (const { pattern, message, severity } of pythonPatterns) {
              if (pattern.test(line)) {
                issues.push({
                  type: 'dangerous_function',
                  file: filePath,
                  line: i + 1,
                  message,
                  severity
                });
              }
            }
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
  } catch (error) {
    // Continue with other checks if file scanning fails
  }
  
  return issues;
}

/**
 * Find code files in directory
 */
function findCodeFiles(directory: string): string[] {
  const codeFiles: string[] = [];
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.c', '.cpp', '.cs', '.php', '.rb', '.go'];
  
  try {
    const items = readdirSync(directory);
    
    for (const item of items) {
      const fullPath = join(directory, item);
      
      if (statSync(fullPath).isDirectory()) {
        // Recursively search subdirectories (with depth limit)
        if (item !== 'node_modules' && item !== '.git' && item !== 'dist' && item !== 'build') {
          codeFiles.push(...findCodeFiles(fullPath));
        }
      } else if (extensions.some(ext => item.endsWith(ext))) {
        codeFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories that can't be read
  }
  
  return codeFiles;
}


/**
 * Convert vulnerabilities to security issues
 */
function convertVulnerabilitiesToIssues(vulnerabilities: Vulnerability[]): SecurityIssue[] {
  return vulnerabilities.map(vuln => ({
    type: 'vulnerability' as const,
    file: 'package.json',
    message: `${vuln.name}: ${vuln.advisory || 'Security vulnerability'}`,
    severity: vuln.severity
  }));
}

/**
 * Filter issues by severity
 */
function filterBySeverity(issues: SecurityIssue[], minSeverity: string): SecurityIssue[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 0;
  
  return issues.filter(issue => 
    severityOrder[issue.severity] >= minLevel
  );
}

/**
 * Generate summary statistics
 */
function generateSummary(issues: SecurityIssue[]): { total: number; bySeverity: Record<string, number> } {
  const summary = {
    total: issues.length,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
  };
  
  for (const issue of issues) {
    summary.bySeverity[issue.severity]++;
  }
  
  return summary;
}

/**
 * Detect package manager based on files in directory
 */
function detectPackageManager(directory: string): string {
  const files = readdirSync(directory);
  
  if (files.includes('package.json')) {
    return 'npm';
  } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
    return 'pip';
  } else if (files.includes('Cargo.toml')) {
    return 'cargo';
  } else if (files.includes('pom.xml')) {
    return 'maven';
  } else if (files.includes('build.gradle')) {
    return 'gradle';
  }
  
  return 'unknown';
}

/**
 * Parse npm dependencies from package.json
 */
function parseNpmDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const packageJsonPath = join(directory, 'package.json');
  
  try {
    const content = readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(content);
    
    // Parse runtime dependencies
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'runtime'
        });
      }
    }
    
    // Parse dev dependencies if requested
    if (includeDevDependencies && packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        dependencies.push({
          name,
          version: version as string,
          type: 'dev'
        });
      }
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing package.json: ${error}`);
  }
  
  return dependencies;
}

/**
 * Parse Python dependencies from requirements.txt
 */
function parsePipDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const requirementsPath = join(directory, 'requirements.txt');
  
  try {
    const content = readFileSync(requirementsPath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        // Parse package name and version
        const parts = trimmedLine.split(/[>=<!=]/);
        const name = parts[0].trim();
        const version = trimmedLine.replace(name, '').trim() || '*';
        
        dependencies.push({
          name,
          version,
          type: 'runtime'
        });
      }
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing requirements.txt: ${error}`);
  }
  
  return dependencies;
}

/**
 * Parse Python dependencies from pyproject.toml
 */
function parsePoetryDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const pyprojectPath = join(directory, 'pyproject.toml');
  
  try {
    const content = readFileSync(pyprojectPath, 'utf8');
    const lines = content.split('\n');
    let inDependencies = false;
    let inDevDependencies = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '[tool.poetry.dependencies]') {
        inDependencies = true;
        inDevDependencies = false;
      } else if (trimmedLine === '[tool.poetry.group.dev.dependencies]') {
        inDependencies = false;
        inDevDependencies = true;
      } else if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        inDependencies = false;
        inDevDependencies = false;
      } else if (inDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
        const [name, version] = trimmedLine.split('=');
        if (name && version) {
          dependencies.push({
            name: name.trim().replace(/"/g, ''),
            version: version.trim().replace(/"/g, ''),
            type: 'runtime'
          });
        }
      } else if (inDevDependencies && includeDevDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
        const [name, version] = trimmedLine.split('=');
        if (name && version) {
          dependencies.push({
            name: name.trim().replace(/"/g, ''),
            version: version.trim().replace(/"/g, ''),
            type: 'dev'
          });
        }
      }
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing pyproject.toml: ${error}`);
  }
  
  return dependencies;
}

/**
 * Parse Rust dependencies from Cargo.toml
 */
function parseCargoDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const cargoPath = join(directory, 'Cargo.toml');
  
  try {
    const content = readFileSync(cargoPath, 'utf8');
    const lines = content.split('\n');
    let inDependencies = false;
    let inDevDependencies = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '[dependencies]') {
        inDependencies = true;
        inDevDependencies = false;
      } else if (trimmedLine === '[dev-dependencies]') {
        inDependencies = false;
        inDevDependencies = true;
      } else if (trimmedLine.startsWith('[') && trimmedLine.endsWith(']')) {
        inDependencies = false;
        inDevDependencies = false;
      } else if (inDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
        const [name, version] = trimmedLine.split('=');
        if (name && version) {
          dependencies.push({
            name: name.trim(),
            version: version.trim().replace(/"/g, ''),
            type: 'runtime'
          });
        }
      } else if (inDevDependencies && includeDevDependencies && trimmedLine && !trimmedLine.startsWith('#')) {
        const [name, version] = trimmedLine.split('=');
        if (name && version) {
          dependencies.push({
            name: name.trim(),
            version: version.trim().replace(/"/g, ''),
            type: 'dev'
          });
        }
      }
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing Cargo.toml: ${error}`);
  }
  
  return dependencies;
}

/**
 * Parse Maven dependencies from pom.xml
 */
function parseMavenDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const pomPath = join(directory, 'pom.xml');
  
  try {
    const content = readFileSync(pomPath, 'utf8');
    
    // Simple XML parsing for dependencies
    const dependencyRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*<version>([^<]+)<\/version>\s*<\/dependency>/g;
    let match;
    
    while ((match = dependencyRegex.exec(content)) !== null) {
      const [, groupId, artifactId, version] = match;
      dependencies.push({
        name: `${groupId}:${artifactId}`,
        version,
        type: 'runtime'
      });
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing pom.xml: ${error}`);
  }
  
  return dependencies;
}

/**
 * Parse Gradle dependencies from build.gradle
 */
function parseGradleDependencies(directory: string, includeDevDependencies: boolean): Dependency[] {
  const dependencies: Dependency[] = [];
  const gradlePath = join(directory, 'build.gradle');
  
  try {
    const content = readFileSync(gradlePath, 'utf8');
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Parse implementation dependencies
      if (trimmedLine.includes('implementation') || trimmedLine.includes('compile')) {
        const match = trimmedLine.match(/['"]([^'"]+)['"]/);
        if (match) {
          const dependency = match[1];
          const [name, version] = dependency.split(':');
          if (name && version) {
            dependencies.push({
              name,
              version,
              type: 'runtime'
            });
          }
        }
      }
      
      // Parse testImplementation dependencies if requested
      if (includeDevDependencies && (trimmedLine.includes('testImplementation') || trimmedLine.includes('testCompile'))) {
        const match = trimmedLine.match(/['"]([^'"]+)['"]/);
        if (match) {
          const dependency = match[1];
          const [name, version] = dependency.split(':');
          if (name && version) {
            dependencies.push({
              name,
              version,
              type: 'dev'
            });
          }
        }
      }
    }
  } catch (error) {
    console.error(`[DEPENDENCY_ANALYSIS] Error parsing build.gradle: ${error}`);
  }
  
  return dependencies;
}

/**
 * Analyze dependencies for a specific package manager
 */
function analyzeDependenciesForManager(
  directory: string,
  manager: string,
  includeDevDependencies: boolean
): Dependency[] {
  switch (manager) {
    case 'npm':
      return parseNpmDependencies(directory, includeDevDependencies);
    case 'pip':
      return parsePipDependencies(directory, includeDevDependencies);
    case 'poetry':
      return parsePoetryDependencies(directory, includeDevDependencies);
    case 'cargo':
      return parseCargoDependencies(directory, includeDevDependencies);
    case 'maven':
      return parseMavenDependencies(directory, includeDevDependencies);
    case 'gradle':
      return parseGradleDependencies(directory, includeDevDependencies);
    default:
      return [];
  }
}

/**
 * Get dependency files for a package manager
 */
function getDependencyFiles(directory: string, manager: string): string[] {
  const files: string[] = [];
  
  switch (manager) {
    case 'npm':
      if (existsSync(join(directory, 'package.json'))) {
        files.push('package.json');
      }
      break;
    case 'pip':
      if (existsSync(join(directory, 'requirements.txt'))) {
        files.push('requirements.txt');
      }
      break;
    case 'poetry':
      if (existsSync(join(directory, 'pyproject.toml'))) {
        files.push('pyproject.toml');
      }
      break;
    case 'cargo':
      if (existsSync(join(directory, 'Cargo.toml'))) {
        files.push('Cargo.toml');
      }
      break;
    case 'maven':
      if (existsSync(join(directory, 'pom.xml'))) {
        files.push('pom.xml');
      }
      break;
    case 'gradle':
      if (existsSync(join(directory, 'build.gradle'))) {
        files.push('build.gradle');
      }
      break;
  }
  
  return files;
}

/**
 * Run npm audit and parse vulnerabilities
 */
async function runNpmAudit(directory: string): Promise<Vulnerability[]> {
  return new Promise((resolve) => {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      const child = spawn('npm', ['audit', '--json'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const auditResult = JSON.parse(stdout);
            
            if (auditResult.vulnerabilities) {
              for (const [packageName, vuln] of Object.entries(auditResult.vulnerabilities)) {
                const vulnerability = vuln as any;
                
                let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
                if (vulnerability.severity === 'critical') severity = 'critical';
                else if (vulnerability.severity === 'high') severity = 'high';
                else if (vulnerability.severity === 'moderate') severity = 'medium';
                
                vulnerabilities.push({
                  name: packageName,
                  version: vulnerability.version || 'unknown',
                  severity,
                  advisory: vulnerability.title || vulnerability.description || 'Security vulnerability',
                  source: 'npm-audit'
                });
              }
            }
          } catch (parseError) {
            console.error(`[VULNERABILITY_CHECK] Error parsing npm audit output: ${parseError}`);
          }
        }
        
        resolve(vulnerabilities);
      });
      
      child.on('error', () => {
        resolve(vulnerabilities);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(vulnerabilities);
      }, 30000);
      
    } catch (error) {
      resolve(vulnerabilities);
    }
  });
}

/**
 * Run pip-audit and parse vulnerabilities
 */
async function runPipAudit(directory: string): Promise<Vulnerability[]> {
  return new Promise((resolve) => {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      const child = spawn('pip-audit', ['-r', 'requirements.txt', '--format', 'json'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const auditResult = JSON.parse(stdout);
            
            if (auditResult.vulnerabilities) {
              for (const vuln of auditResult.vulnerabilities) {
                let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
                if (vuln.severity === 'CRITICAL') severity = 'critical';
                else if (vuln.severity === 'HIGH') severity = 'high';
                else if (vuln.severity === 'MEDIUM') severity = 'medium';
                
                vulnerabilities.push({
                  name: vuln.package || vuln.name || 'unknown',
                  version: vuln.version || 'unknown',
                  severity,
                  advisory: vuln.description || vuln.advisory || 'Security vulnerability',
                  source: 'pip-audit'
                });
              }
            }
          } catch (parseError) {
            console.error(`[VULNERABILITY_CHECK] Error parsing pip-audit output: ${parseError}`);
          }
        }
        
        resolve(vulnerabilities);
      });
      
      child.on('error', () => {
        resolve(vulnerabilities);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(vulnerabilities);
      }, 30000);
      
    } catch (error) {
      resolve(vulnerabilities);
    }
  });
}

/**
 * Run cargo audit and parse vulnerabilities
 */
async function runCargoAudit(directory: string): Promise<Vulnerability[]> {
  return new Promise((resolve) => {
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      const child = spawn('cargo', ['audit', '--json'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const auditResult = JSON.parse(stdout);
            
            if (auditResult.vulnerabilities) {
              for (const vuln of auditResult.vulnerabilities) {
                let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
                if (vuln.severity === 'critical') severity = 'critical';
                else if (vuln.severity === 'high') severity = 'high';
                else if (vuln.severity === 'medium') severity = 'medium';
                
                vulnerabilities.push({
                  name: vuln.package || vuln.name || 'unknown',
                  version: vuln.version || 'unknown',
                  severity,
                  advisory: vuln.description || vuln.advisory || 'Security vulnerability',
                  source: 'cargo-audit'
                });
              }
            }
          } catch (parseError) {
            console.error(`[VULNERABILITY_CHECK] Error parsing cargo audit output: ${parseError}`);
          }
        }
        
        resolve(vulnerabilities);
      });
      
      child.on('error', () => {
        resolve(vulnerabilities);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(vulnerabilities);
      }, 30000);
      
    } catch (error) {
      resolve(vulnerabilities);
    }
  });
}

/**
 * Check if vulnerability tool is available
 */
async function checkToolAvailability(tool: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const child = spawn(tool, ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(false);
      }, 5000);
      
    } catch (error) {
      resolve(false);
    }
  });
}

/**
 * Filter vulnerabilities by severity
 */
function filterVulnerabilitiesBySeverity(vulnerabilities: Vulnerability[], minSeverity: string): Vulnerability[] {
  const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
  const minLevel = severityOrder[minSeverity as keyof typeof severityOrder] || 0;
  
  return vulnerabilities.filter(vuln => 
    severityOrder[vuln.severity] >= minLevel
  );
}

/**
 * Generate vulnerability summary
 */
function generateVulnerabilitySummary(vulnerabilities: Vulnerability[]): { total: number; bySeverity: Record<string, number> } {
  const summary = {
    total: vulnerabilities.length,
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
  };
  
  for (const vuln of vulnerabilities) {
    summary.bySeverity[vuln.severity]++;
  }
  
  return summary;
}

/**
 * Run npm ls and parse dependency tree
 */
async function runNpmTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  return new Promise((resolve) => {
    const tree: DependencyTreeNode[] = [];
    
    try {
      const args = ['ls', '--json', '--depth', maxDepth.toString()];
      if (!includeDevDependencies) {
        args.push('--production');
      }
      
      const child = spawn('npm', args, {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const lsResult = JSON.parse(stdout);
            
            if (lsResult.dependencies) {
              for (const [name, dep] of Object.entries(lsResult.dependencies)) {
                const dependency = dep as any;
                const node = parseNpmDependencyNode(name, dependency, includeDevDependencies);
                if (node) {
                  tree.push(node);
                }
              }
            }
          } catch (parseError) {
            console.error(`[DEPENDENCY_TREE] Error parsing npm ls output: ${parseError}`);
          }
        }
        
        resolve(tree);
      });
      
      child.on('error', () => {
        resolve(tree);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(tree);
      }, 30000);
      
    } catch (error) {
      resolve(tree);
    }
  });
}

/**
 * Parse npm dependency node
 */
function parseNpmDependencyNode(name: string, dependency: any, includeDevDependencies: boolean): DependencyTreeNode | null {
  if (!dependency || !dependency.version) {
    return null;
  }
  
  const type = dependency.dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const node: DependencyTreeNode = {
    name,
    version: dependency.version,
    type
  };
  
  if (dependency.dependencies) {
    const childDependencies: DependencyTreeNode[] = [];
    for (const [childName, childDep] of Object.entries(dependency.dependencies)) {
      const childNode = parseNpmDependencyNode(childName, childDep, includeDevDependencies);
      if (childNode) {
        childDependencies.push(childNode);
      }
    }
    if (childDependencies.length > 0) {
      node.dependencies = childDependencies;
    }
  }
  
  return node;
}

/**
 * Run pipdeptree and parse dependency tree
 */
async function runPipTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  return new Promise((resolve) => {
    const tree: DependencyTreeNode[] = [];
    
    try {
      const child = spawn('pipdeptree', ['--json-tree'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const deptreeResult = JSON.parse(stdout);
            
            if (Array.isArray(deptreeResult)) {
              for (const item of deptreeResult) {
                const node = parsePipDependencyNode(item, maxDepth, includeDevDependencies);
                if (node) {
                  tree.push(node);
                }
              }
            }
          } catch (parseError) {
            console.error(`[DEPENDENCY_TREE] Error parsing pipdeptree output: ${parseError}`);
          }
        }
        
        resolve(tree);
      });
      
      child.on('error', () => {
        resolve(tree);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(tree);
      }, 30000);
      
    } catch (error) {
      resolve(tree);
    }
  });
}

/**
 * Parse pip dependency node
 */
function parsePipDependencyNode(item: any, maxDepth: number, includeDevDependencies: boolean, currentDepth: number = 0): DependencyTreeNode | null {
  if (currentDepth >= maxDepth) {
    return null;
  }
  
  const type = item.dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const node: DependencyTreeNode = {
    name: item.package_name || item.name || 'unknown',
    version: item.installed_version || item.version || 'unknown',
    type
  };
  
  if (item.dependencies && Array.isArray(item.dependencies)) {
    const childDependencies: DependencyTreeNode[] = [];
    for (const child of item.dependencies) {
      const childNode = parsePipDependencyNode(child, maxDepth, includeDevDependencies, currentDepth + 1);
      if (childNode) {
        childDependencies.push(childNode);
      }
    }
    if (childDependencies.length > 0) {
      node.dependencies = childDependencies;
    }
  }
  
  return node;
}

/**
 * Run cargo tree and parse dependency tree
 */
async function runCargoTree(directory: string, maxDepth: number, includeDevDependencies: boolean): Promise<DependencyTreeNode[]> {
  return new Promise((resolve) => {
    const tree: DependencyTreeNode[] = [];
    
    try {
      const args = ['tree', '--prefix', 'none', '--depth', maxDepth.toString(), '--format', 'json'];
      if (!includeDevDependencies) {
        args.push('--no-dev-dependencies');
      }
      
      const child = spawn('cargo', args, {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const lines = stdout.trim().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const treeItem = JSON.parse(line);
                const node = parseCargoDependencyNode(treeItem, maxDepth, includeDevDependencies);
                if (node) {
                  tree.push(node);
                }
              }
            }
          } catch (parseError) {
            console.error(`[DEPENDENCY_TREE] Error parsing cargo tree output: ${parseError}`);
          }
        }
        
        resolve(tree);
      });
      
      child.on('error', () => {
        resolve(tree);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(tree);
      }, 30000);
      
    } catch (error) {
      resolve(tree);
    }
  });
}

/**
 * Parse cargo dependency node
 */
function parseCargoDependencyNode(item: any, maxDepth: number, includeDevDependencies: boolean, currentDepth: number = 0): DependencyTreeNode | null {
  if (currentDepth >= maxDepth) {
    return null;
  }
  
  const type = item.dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const node: DependencyTreeNode = {
    name: item.name || 'unknown',
    version: item.version || 'unknown',
    type
  };
  
  if (item.deps && Array.isArray(item.deps)) {
    const childDependencies: DependencyTreeNode[] = [];
    for (const child of item.deps) {
      const childNode = parseCargoDependencyNode(child, maxDepth, includeDevDependencies, currentDepth + 1);
      if (childNode) {
        childDependencies.push(childNode);
      }
    }
    if (childDependencies.length > 0) {
      node.dependencies = childDependencies;
    }
  }
  
  return node;
}

/**
 * Count total dependencies in tree
 */
function countDependencies(tree: DependencyTreeNode[]): number {
  let count = 0;
  
  for (const node of tree) {
    count++;
    if (node.dependencies) {
      count += countDependencies(node.dependencies);
    }
  }
  
  return count;
}

/**
 * Run npm ls and parse license information
 */
async function runNpmLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  return new Promise((resolve) => {
    const compliance: LicenseCompliance[] = [];
    
    try {
      const args = ['ls', '--json', '--long'];
      if (!includeDevDependencies) {
        args.push('--production');
      }
      
      const child = spawn('npm', args, {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const lsResult = JSON.parse(stdout);
            
            if (lsResult.dependencies) {
              for (const [name, dep] of Object.entries(lsResult.dependencies)) {
                const dependency = dep as any;
                const licenseInfo = parseNpmLicenseInfo(name, dependency, includeDevDependencies);
                if (licenseInfo) {
                  compliance.push(licenseInfo);
                }
              }
            }
          } catch (parseError) {
            console.error(`[LICENSE_COMPLIANCE] Error parsing npm ls output: ${parseError}`);
          }
        }
        
        resolve(compliance);
      });
      
      child.on('error', () => {
        resolve(compliance);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(compliance);
      }, 30000);
      
    } catch (error) {
      resolve(compliance);
    }
  });
}

/**
 * Parse npm license information
 */
function parseNpmLicenseInfo(name: string, dependency: any, includeDevDependencies: boolean): LicenseCompliance | null {
  if (!dependency || !dependency.version) {
    return null;
  }
  
  const type = dependency.dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const license = dependency.license || 'unknown';
  
  return {
    name,
    version: dependency.version,
    license,
    status: 'unknown' // Will be determined later based on allowed/denied lists
  };
}

/**
 * Run pip-licenses and parse license information
 */
async function runPipLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  return new Promise((resolve) => {
    const compliance: LicenseCompliance[] = [];
    
    try {
      const child = spawn('pip-licenses', ['--format=json'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const licensesResult = JSON.parse(stdout);
            
            if (Array.isArray(licensesResult)) {
              for (const item of licensesResult) {
                const licenseInfo = parsePipLicenseInfo(item, includeDevDependencies);
                if (licenseInfo) {
                  compliance.push(licenseInfo);
                }
              }
            }
          } catch (parseError) {
            console.error(`[LICENSE_COMPLIANCE] Error parsing pip-licenses output: ${parseError}`);
          }
        }
        
        resolve(compliance);
      });
      
      child.on('error', () => {
        resolve(compliance);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(compliance);
      }, 30000);
      
    } catch (error) {
      resolve(compliance);
    }
  });
}

/**
 * Parse pip license information
 */
function parsePipLicenseInfo(item: any, includeDevDependencies: boolean): LicenseCompliance | null {
  if (!item || !item.Name || !item.Version) {
    return null;
  }
  
  const type = item.Dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const license = item.License || 'unknown';
  
  return {
    name: item.Name,
    version: item.Version,
    license,
    status: 'unknown' // Will be determined later based on allowed/denied lists
  };
}

/**
 * Run cargo metadata and parse license information
 */
async function runCargoLicenseCheck(directory: string, includeDevDependencies: boolean): Promise<LicenseCompliance[]> {
  return new Promise((resolve) => {
    const compliance: LicenseCompliance[] = [];
    
    try {
      const child = spawn('cargo', ['metadata', '--format-version', '1'], {
        cwd: directory,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      
      let stdout = '';
      let stderr = '';
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const metadataResult = JSON.parse(stdout);
            
            if (metadataResult.packages && Array.isArray(metadataResult.packages)) {
              for (const pkg of metadataResult.packages) {
                const licenseInfo = parseCargoLicenseInfo(pkg, includeDevDependencies);
                if (licenseInfo) {
                  compliance.push(licenseInfo);
                }
              }
            }
          } catch (parseError) {
            console.error(`[LICENSE_COMPLIANCE] Error parsing cargo metadata output: ${parseError}`);
          }
        }
        
        resolve(compliance);
      });
      
      child.on('error', () => {
        resolve(compliance);
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        child.kill('SIGTERM');
        resolve(compliance);
      }, 30000);
      
    } catch (error) {
      resolve(compliance);
    }
  });
}

/**
 * Parse cargo license information
 */
function parseCargoLicenseInfo(pkg: any, includeDevDependencies: boolean): LicenseCompliance | null {
  if (!pkg || !pkg.name || !pkg.version) {
    return null;
  }
  
  const type = pkg.dev ? 'dev' : 'runtime';
  if (!includeDevDependencies && type === 'dev') {
    return null;
  }
  
  const license = pkg.license || 'unknown';
  
  return {
    name: pkg.name,
    version: pkg.version,
    license,
    status: 'unknown' // Will be determined later based on allowed/denied lists
  };
}

/**
 * Check license compliance status
 */
function checkLicenseCompliance(compliance: LicenseCompliance[], allowedLicenses: string[], deniedLicenses: string[]): LicenseCompliance[] {
  return compliance.map(item => {
    let status: 'allowed' | 'denied' | 'unknown' = 'unknown';
    
    if (allowedLicenses.length > 0 && allowedLicenses.includes(item.license)) {
      status = 'allowed';
    } else if (deniedLicenses.length > 0 && deniedLicenses.includes(item.license)) {
      status = 'denied';
    } else if (allowedLicenses.length === 0 && deniedLicenses.length === 0) {
      status = 'unknown';
    }
    
    return {
      ...item,
      status
    };
  });
}

/**
 * Generate license compliance summary
 */
function generateLicenseComplianceSummary(compliance: LicenseCompliance[]): { total: number; allowed: number; denied: number; unknown: number } {
  const summary = {
    total: compliance.length,
    allowed: 0,
    denied: 0,
    unknown: 0
  };
  
  for (const item of compliance) {
    summary[item.status]++;
  }
  
  return summary;
}

/**
 * Handle Security & Dependency tool calls
 */
export async function handleSecurityTool(
  toolName: string,
  args: unknown
): Promise<ToolResponse> {
  switch (toolName) {
    case 'security_audit': {
      const auditArgs = args as any;
      const directory = auditArgs.directory || '.';
      const includeDevDependencies = auditArgs.includeDevDependencies !== false;
      const severity = auditArgs.severity || 'medium';
      const outputFormat = auditArgs.outputFormat || 'json';

      try {
        console.log(`[SECURITY_AUDIT] Starting security audit for ${directory}`);
        
        // Resolve directory path
        const auditDir = resolve(directory);
        
        if (!existsSync(auditDir)) {
          return createSafeResult('security_audit', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            directory,
          }, 'Directory not found');
        }

        // Collect all security issues
        const allIssues: SecurityIssue[] = [];
        
        // 1. Scan for secrets in .env files
        console.log('[SECURITY_AUDIT] Scanning for secrets in .env files...');
        const secretIssues = scanForSecrets(auditDir);
        allIssues.push(...secretIssues);
        console.log(`[SECURITY_AUDIT] Found ${secretIssues.length} secret issues`);
        
        // 2. Scan for dangerous functions in code files
        console.log('[SECURITY_AUDIT] Scanning for dangerous functions...');
        const functionIssues = scanForDangerousFunctions(auditDir);
        allIssues.push(...functionIssues);
        console.log(`[SECURITY_AUDIT] Found ${functionIssues.length} dangerous function issues`);
        
        // 3. Run npm audit if package.json exists
        let npmIssues: SecurityIssue[] = [];
        const packageJsonPath = join(auditDir, 'package.json');
        if (existsSync(packageJsonPath)) {
          console.log('[SECURITY_AUDIT] Running npm audit...');
          const vulnerabilities = await runNpmAudit(auditDir);
          npmIssues = convertVulnerabilitiesToIssues(vulnerabilities);
          allIssues.push(...npmIssues);
          console.log(`[SECURITY_AUDIT] Found ${npmIssues.length} npm vulnerability issues`);
        } else {
          console.log('[SECURITY_AUDIT] No package.json found, skipping npm audit');
        }
        
        // 4. Filter by severity
        const filteredIssues = filterBySeverity(allIssues, severity);
        
        // 5. Generate summary
        const summary = generateSummary(filteredIssues);
        
        // 6. Create result
        const result: SecurityAuditResult = {
          issues: filteredIssues,
          summary,
          directory: auditDir,
          timestamp: new Date().toISOString(),
          packageManager: existsSync(packageJsonPath) ? 'npm' : undefined
        };
        
        console.log(`[SECURITY_AUDIT] Audit completed: ${summary.total} issues found`);
        
        return createSafeResult('security_audit', {
          ...result,
          message: `Security audit completed: ${summary.total} issues found (${summary.bySeverity.critical} critical, ${summary.bySeverity.high} high, ${summary.bySeverity.medium} medium, ${summary.bySeverity.low} low)`,
          outputFormat,
          includeDevDependencies
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SECURITY_AUDIT] Error: ${errorMessage}`);
        
        return createSafeResult('security_audit', {
          error: 'Security audit failed',
          message: `Security audit failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'analyze_dependencies': {
      const depArgs = args as any;
      const directory = depArgs.directory || '.';
      const packageManager = depArgs.packageManager || 'auto';
      const includeDevDependencies = depArgs.includeDevDependencies !== false;

      try {
        console.log(`[DEPENDENCY_ANALYSIS] Starting dependency analysis for ${directory}`);
        
        // Resolve directory path
        const analysisDir = resolve(directory);
        
        if (!existsSync(analysisDir)) {
          return createSafeResult('analyze_dependencies', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            directory,
          }, 'Directory not found');
        }

        // Detect package manager if auto
        let detectedManager = packageManager;
        if (packageManager === 'auto') {
          detectedManager = detectPackageManager(analysisDir);
          console.log(`[DEPENDENCY_ANALYSIS] Auto-detected package manager: ${detectedManager}`);
        }

        // Check if package manager is supported
        const supportedManagers = ['npm', 'pip', 'poetry', 'cargo', 'maven', 'gradle'];
        if (detectedManager === 'unknown' || !supportedManagers.includes(detectedManager)) {
          return createSafeResult('analyze_dependencies', {
            error: 'Unsupported package manager',
            message: `Package manager ${detectedManager} is not supported or no dependency files found`,
            directory: analysisDir,
            detectedManager,
            supportedManagers
          }, 'Unsupported package manager');
        }

        // Check if dependency files exist
        const dependencyFiles = getDependencyFiles(analysisDir, detectedManager);
        if (dependencyFiles.length === 0) {
          return createSafeResult('analyze_dependencies', {
            error: 'Dependency file not found',
            message: `No dependency files found for ${detectedManager} in ${analysisDir}`,
            directory: analysisDir,
            packageManager: detectedManager
          }, 'Dependency file not found');
        }

        // Analyze dependencies
        console.log(`[DEPENDENCY_ANALYSIS] Analyzing dependencies for ${detectedManager}...`);
        const dependencies = analyzeDependenciesForManager(analysisDir, detectedManager, includeDevDependencies);
        
        // Calculate statistics
        const runtimeCount = dependencies.filter(dep => dep.type === 'runtime').length;
        const devCount = dependencies.filter(dep => dep.type === 'dev').length;
        
        console.log(`[DEPENDENCY_ANALYSIS] Found ${dependencies.length} dependencies (${runtimeCount} runtime, ${devCount} dev)`);
        
        // Create result
        const result: DependencyAnalysisResult = {
          manager: detectedManager,
          dependencies,
          total: dependencies.length,
          runtime: runtimeCount,
          dev: devCount,
          directory: analysisDir,
          timestamp: new Date().toISOString(),
          files: dependencyFiles
        };
        
        return createSafeResult('analyze_dependencies', {
          ...result,
          message: `Dependency analysis completed: ${dependencies.length} dependencies found (${runtimeCount} runtime, ${devCount} dev) using ${detectedManager}`,
          includeDevDependencies
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DEPENDENCY_ANALYSIS] Error: ${errorMessage}`);
        
        return createSafeResult('analyze_dependencies', {
          error: 'Dependency analysis failed',
          message: `Dependency analysis failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'check_vulnerabilities': {
      const vulnArgs = args as any;
      const directory = vulnArgs.directory || '.';
      const packageManager = vulnArgs.packageManager || 'auto';
      const severity = vulnArgs.severity || 'medium';
      const includeDevDependencies = vulnArgs.includeDevDependencies !== false;
      const outputFormat = vulnArgs.outputFormat || 'json';

      try {
        console.log(`[VULNERABILITY_CHECK] Starting vulnerability check for ${directory}`);
        
        // Resolve directory path
        const checkDir = resolve(directory);
        
        if (!existsSync(checkDir)) {
          return createSafeResult('check_vulnerabilities', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            directory,
          }, 'Directory not found');
        }

        // Detect package manager if auto
        let detectedManager = packageManager;
        if (packageManager === 'auto') {
          detectedManager = detectPackageManager(checkDir);
          console.log(`[VULNERABILITY_CHECK] Auto-detected package manager: ${detectedManager}`);
        }

        // Check if package manager is supported
        const supportedManagers = ['npm', 'pip', 'cargo'];
        const unsupportedManagers = ['maven', 'gradle'];
        
        if (unsupportedManagers.includes(detectedManager)) {
          return createSafeResult('check_vulnerabilities', {
            warning: 'Vulnerability check not yet supported',
            message: `Vulnerability checking for ${detectedManager} is not yet supported`,
            directory: checkDir,
            manager: detectedManager,
            supportedManagers
          });
        }
        
        if (!supportedManagers.includes(detectedManager)) {
          return createSafeResult('check_vulnerabilities', {
            error: 'Vulnerability checker not available for manager',
            message: `Vulnerability checker not available for ${detectedManager}`,
            directory: checkDir,
            manager: detectedManager,
            supportedManagers
          }, 'Vulnerability checker not available');
        }

        // Check if vulnerability tool is available
        let toolName = '';
        switch (detectedManager) {
          case 'npm':
            toolName = 'npm';
            break;
          case 'pip':
            toolName = 'pip-audit';
            break;
          case 'cargo':
            toolName = 'cargo';
            break;
        }

        const toolAvailable = await checkToolAvailability(toolName);
        if (!toolAvailable) {
          return createSafeResult('check_vulnerabilities', {
            error: 'Vulnerability checker not available for manager',
            message: `Vulnerability checker ${toolName} is not available for ${detectedManager}`,
            directory: checkDir,
            manager: detectedManager,
            toolName
          }, 'Vulnerability checker not available');
        }

        // Run vulnerability check
        console.log(`[VULNERABILITY_CHECK] Running vulnerability check for ${detectedManager}...`);
        let vulnerabilities: Vulnerability[] = [];
        
        switch (detectedManager) {
          case 'npm':
            vulnerabilities = await runNpmAudit(checkDir);
            break;
          case 'pip':
            vulnerabilities = await runPipAudit(checkDir);
            break;
          case 'cargo':
            vulnerabilities = await runCargoAudit(checkDir);
            break;
        }
        
        // Filter by severity
        const filteredVulnerabilities = filterVulnerabilitiesBySeverity(vulnerabilities, severity);
        
        // Generate summary
        const summary = generateVulnerabilitySummary(filteredVulnerabilities);
        
        console.log(`[VULNERABILITY_CHECK] Found ${filteredVulnerabilities.length} vulnerabilities (${summary.bySeverity.critical} critical, ${summary.bySeverity.high} high, ${summary.bySeverity.medium} medium, ${summary.bySeverity.low} low)`);
        
        // Create result
        const result: VulnerabilityCheckResult = {
          vulnerabilities: filteredVulnerabilities,
          summary,
          manager: detectedManager,
          directory: checkDir,
          timestamp: new Date().toISOString(),
          toolAvailable: true
        };
        
        return createSafeResult('check_vulnerabilities', {
          ...result,
          message: `Vulnerability check completed: ${filteredVulnerabilities.length} vulnerabilities found (${summary.bySeverity.critical} critical, ${summary.bySeverity.high} high, ${summary.bySeverity.medium} medium, ${summary.bySeverity.low} low) using ${detectedManager}`,
          outputFormat,
          includeDevDependencies
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[VULNERABILITY_CHECK] Error: ${errorMessage}`);
        
        return createSafeResult('check_vulnerabilities', {
          error: 'Vulnerability check failed',
          message: `Vulnerability check failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'dependency_tree_analysis': {
      const treeArgs = args as any;
      const directory = treeArgs.directory || '.';
      const packageManager = treeArgs.packageManager || 'auto';
      const maxDepth = treeArgs.maxDepth || 3;
      const includeDevDependencies = treeArgs.includeDevDependencies !== false;
      const outputFormat = treeArgs.outputFormat || 'json';

      try {
        console.log(`[DEPENDENCY_TREE] Starting dependency tree analysis for ${directory}`);
        
        // Resolve directory path
        const treeDir = resolve(directory);
        
        if (!existsSync(treeDir)) {
          return createSafeResult('dependency_tree_analysis', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            directory,
          }, 'Directory not found');
        }

        // Detect package manager if auto
        let detectedManager = packageManager;
        if (packageManager === 'auto') {
          detectedManager = detectPackageManager(treeDir);
          console.log(`[DEPENDENCY_TREE] Auto-detected package manager: ${detectedManager}`);
        }

        // Check if package manager is supported
        const supportedManagers = ['npm', 'pip', 'cargo'];
        const unsupportedManagers = ['maven', 'gradle'];
        
        if (unsupportedManagers.includes(detectedManager)) {
          return createSafeResult('dependency_tree_analysis', {
            warning: 'Dependency tree not yet supported',
            message: `Dependency tree analysis for ${detectedManager} is not yet supported`,
            directory: treeDir,
            manager: detectedManager,
            supportedManagers
          });
        }
        
        if (!supportedManagers.includes(detectedManager)) {
          return createSafeResult('dependency_tree_analysis', {
            error: 'Dependency tree tool not available',
            message: `Dependency tree tool not available for ${detectedManager}`,
            directory: treeDir,
            manager: detectedManager,
            supportedManagers
          }, 'Dependency tree tool not available');
        }

        // Check if dependency tree tool is available
        let toolName = '';
        switch (detectedManager) {
          case 'npm':
            toolName = 'npm';
            break;
          case 'pip':
            toolName = 'pipdeptree';
            break;
          case 'cargo':
            toolName = 'cargo';
            break;
        }

        const toolAvailable = await checkToolAvailability(toolName);
        if (!toolAvailable) {
          return createSafeResult('dependency_tree_analysis', {
            error: 'Dependency tree tool not available',
            message: `Dependency tree tool ${toolName} is not available for ${detectedManager}`,
            directory: treeDir,
            manager: detectedManager,
            toolName
          }, 'Dependency tree tool not available');
        }

        // Run dependency tree analysis
        console.log(`[DEPENDENCY_TREE] Running dependency tree analysis for ${detectedManager}...`);
        let tree: DependencyTreeNode[] = [];
        
        switch (detectedManager) {
          case 'npm':
            tree = await runNpmTree(treeDir, maxDepth, includeDevDependencies);
            break;
          case 'pip':
            tree = await runPipTree(treeDir, maxDepth, includeDevDependencies);
            break;
          case 'cargo':
            tree = await runCargoTree(treeDir, maxDepth, includeDevDependencies);
            break;
        }
        
        // Count total dependencies
        const total = countDependencies(tree);
        
        console.log(`[DEPENDENCY_TREE] Found ${total} dependencies in tree (max depth: ${maxDepth})`);
        
        // Create result
        const result: DependencyTreeResult = {
          manager: detectedManager,
          tree,
          total,
          maxDepth,
          directory: treeDir,
          timestamp: new Date().toISOString(),
          toolAvailable: true
        };
        
        return createSafeResult('dependency_tree_analysis', {
          ...result,
          message: `Dependency tree analysis completed: ${total} dependencies found (max depth: ${maxDepth}) using ${detectedManager}`,
          outputFormat,
          includeDevDependencies
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[DEPENDENCY_TREE] Error: ${errorMessage}`);
        
        return createSafeResult('dependency_tree_analysis', {
          error: 'Dependency tree analysis failed',
          message: `Dependency tree analysis failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    case 'license_compliance_check': {
      const licenseArgs = args as any;
      const directory = licenseArgs.directory || '.';
      const packageManager = licenseArgs.packageManager || 'auto';
      const allowedLicenses = licenseArgs.allowedLicenses || [];
      const deniedLicenses = licenseArgs.deniedLicenses || [];
      const includeDevDependencies = licenseArgs.includeDevDependencies !== false;
      const outputFormat = licenseArgs.outputFormat || 'json';

      try {
        console.log(`[LICENSE_COMPLIANCE] Starting license compliance check for ${directory}`);
        
        // Resolve directory path
        const licenseDir = resolve(directory);
        
        if (!existsSync(licenseDir)) {
          return createSafeResult('license_compliance_check', {
            error: 'Directory not found',
            message: `Directory ${directory} does not exist`,
            directory,
          }, 'Directory not found');
        }

        // Detect package manager if auto
        let detectedManager = packageManager;
        if (packageManager === 'auto') {
          detectedManager = detectPackageManager(licenseDir);
          console.log(`[LICENSE_COMPLIANCE] Auto-detected package manager: ${detectedManager}`);
        }

        // Check if package manager is supported
        const supportedManagers = ['npm', 'pip', 'cargo'];
        const unsupportedManagers = ['maven', 'gradle'];
        
        if (unsupportedManagers.includes(detectedManager)) {
          return createSafeResult('license_compliance_check', {
            warning: 'License compliance not yet supported',
            message: `License compliance checking for ${detectedManager} is not yet supported`,
            directory: licenseDir,
            manager: detectedManager,
            supportedManagers
          });
        }
        
        if (!supportedManagers.includes(detectedManager)) {
          return createSafeResult('license_compliance_check', {
            error: 'License tool not available',
            message: `License tool not available for ${detectedManager}`,
            directory: licenseDir,
            manager: detectedManager,
            supportedManagers
          }, 'License tool not available');
        }

        // Check if license tool is available
        let toolName = '';
        switch (detectedManager) {
          case 'npm':
            toolName = 'npm';
            break;
          case 'pip':
            toolName = 'pip-licenses';
            break;
          case 'cargo':
            toolName = 'cargo';
            break;
        }

        const toolAvailable = await checkToolAvailability(toolName);
        if (!toolAvailable) {
          return createSafeResult('license_compliance_check', {
            error: 'License tool not available',
            message: `License tool ${toolName} is not available for ${detectedManager}`,
            directory: licenseDir,
            manager: detectedManager,
            toolName
          }, 'License tool not available');
        }

        // Run license compliance check
        console.log(`[LICENSE_COMPLIANCE] Running license compliance check for ${detectedManager}...`);
        let compliance: LicenseCompliance[] = [];
        
        switch (detectedManager) {
          case 'npm':
            compliance = await runNpmLicenseCheck(licenseDir, includeDevDependencies);
            break;
          case 'pip':
            compliance = await runPipLicenseCheck(licenseDir, includeDevDependencies);
            break;
          case 'cargo':
            compliance = await runCargoLicenseCheck(licenseDir, includeDevDependencies);
            break;
        }
        
        // Check license compliance status
        const complianceWithStatus = checkLicenseCompliance(compliance, allowedLicenses, deniedLicenses);
        
        // Generate summary
        const summary = generateLicenseComplianceSummary(complianceWithStatus);
        
        console.log(`[LICENSE_COMPLIANCE] Found ${complianceWithStatus.length} dependencies with license information (${summary.allowed} allowed, ${summary.denied} denied, ${summary.unknown} unknown)`);
        
        // Create result
        const result: LicenseComplianceResult = {
          manager: detectedManager,
          compliance: complianceWithStatus,
          summary,
          directory: licenseDir,
          timestamp: new Date().toISOString(),
          toolAvailable: true,
          allowedLicenses: allowedLicenses.length > 0 ? allowedLicenses : undefined,
          deniedLicenses: deniedLicenses.length > 0 ? deniedLicenses : undefined
        };
        
        return createSafeResult('license_compliance_check', {
          ...result,
          message: `License compliance check completed: ${complianceWithStatus.length} dependencies checked (${summary.allowed} allowed, ${summary.denied} denied, ${summary.unknown} unknown) using ${detectedManager}`,
          outputFormat,
          includeDevDependencies
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[LICENSE_COMPLIANCE] Error: ${errorMessage}`);
        
        return createSafeResult('license_compliance_check', {
          error: 'License compliance check failed',
          message: `License compliance check failed: ${errorMessage}`,
          directory: directory,
        }, errorMessage);
      }
    }

    default:
      return createSafeResult(toolName, undefined, `Unknown Security tool: ${toolName}`);
  }
}
