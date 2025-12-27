import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityIssue, SecurityVulnerabilityType, SecurityScanResult } from './types';
import { ProjectFileCollector } from './getProjectFiles';

interface VulnerabilityPattern {
	type: SecurityVulnerabilityType;
	severity: 'critical' | 'high' | 'medium' | 'low';
	pattern: RegExp;
	message: string;
	description: string;
	recommendation: string;
	cweId?: string;
	owaspCategory?: string;
	confidence: 'high' | 'medium' | 'low';
}

export class SecurityScanner {
	private outputChannel: vscode.OutputChannel;
	private vulnerabilityPatterns: VulnerabilityPattern[];

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Security Scanner');
		this.vulnerabilityPatterns = this.initializePatterns();
	}

	private initializePatterns(): VulnerabilityPattern[] {
		return [
			// Hardcoded Secrets - CRITICAL
			{
				type: 'hardcoded-secret',
				severity: 'critical',
				pattern: /(password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?token)\s*[=:]\s*['"]((?!(?:process\.env|config\.|CONFIG\.|import\.|require\(|<%=|{{|%{))[^'"\n]{8,})['"]/gi,
				message: 'Hardcoded secret detected',
				description: 'Sensitive credentials found directly in source code',
				recommendation: 'Use environment variables or a secure secret management system',
				cweId: 'CWE-798',
				owaspCategory: 'A02:2021 - Cryptographic Failures',
				confidence: 'high'
			},
			{
				type: 'hardcoded-secret',
				severity: 'critical',
				pattern: /(?:aws_access_key_id|aws_secret_access_key|AKIA[0-9A-Z]{16})/gi,
				message: 'AWS credentials hardcoded',
				description: 'AWS access keys found in source code',
				recommendation: 'Use AWS IAM roles or AWS Secrets Manager',
				cweId: 'CWE-798',
				owaspCategory: 'A02:2021 - Cryptographic Failures',
				confidence: 'high'
			},
			
			// SQL Injection - CRITICAL
			{
				type: 'sql-injection',
				severity: 'critical',
				pattern: /(?:execute|query|exec|executeSql|rawQuery)\s*\(\s*[`'"]?\s*(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)[\s\S]*?\+\s*(?:\w+|req\.(?:body|query|params))/gi,
				message: 'SQL injection vulnerability',
				description: 'SQL query constructed using string concatenation with user input',
				recommendation: 'Use parameterized queries or prepared statements',
				cweId: 'CWE-89',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'high'
			},
			{
				type: 'sql-injection',
				severity: 'critical',
				pattern: /\$\{[^}]*(?:req\.(?:body|query|params)|request\.(?:body|query|params)|input|userInput)[^}]*\}/g,
				message: 'Potential SQL injection via template literals',
				description: 'SQL query uses template literals with user input',
				recommendation: 'Use parameterized queries instead of template literals',
				cweId: 'CWE-89',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'medium'
			},

			// XSS Vulnerabilities - HIGH
			{
				type: 'xss-vulnerability',
				severity: 'high',
				pattern: /\.innerHTML\s*=\s*(?!\s*['""])/g,
				message: 'XSS vulnerability via innerHTML',
				description: 'Setting innerHTML with potentially unsafe content',
				recommendation: 'Use textContent or sanitize HTML with DOMPurify',
				cweId: 'CWE-79',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'medium'
			},
			{
				type: 'xss-vulnerability',
				severity: 'high',
				pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{?\s*__html:/g,
				message: 'React XSS vulnerability',
				description: 'Using dangerouslySetInnerHTML without sanitization',
				recommendation: 'Sanitize HTML content or use safer alternatives',
				cweId: 'CWE-79',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'medium'
			},

			// Command Injection - CRITICAL
			{
				type: 'command-injection',
				severity: 'critical',
				pattern: /(?:exec|execSync|spawn|execFile|child_process)\s*\([^)]*(?:\+|`|\$\{)[^)]*(?:req\.(?:body|query|params)|input|userInput)/gi,
				message: 'Command injection vulnerability',
				description: 'Executing system commands with unsanitized user input',
				recommendation: 'Avoid executing user input; use allowlists or safer alternatives',
				cweId: 'CWE-78',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'high'
			},

			// Path Traversal - HIGH
			{
				type: 'path-traversal',
				severity: 'high',
				pattern: /(?:readFile|readFileSync|writeFile|writeFileSync|createReadStream|createWriteStream)\s*\([^)]*(?:req\.(?:body|query|params)|input|userInput)(?:\.|\+|\[)/gi,
				message: 'Path traversal vulnerability',
				description: 'File operations with unsanitized user-provided paths',
				recommendation: 'Validate and sanitize file paths; use allowlists',
				cweId: 'CWE-22',
				owaspCategory: 'A01:2021 - Broken Access Control',
				confidence: 'high'
			},

			// Unsafe Eval - CRITICAL
			{
				type: 'unsafe-eval',
				severity: 'critical',
				pattern: /\beval\s*\(/g,
				message: 'Unsafe use of eval()',
				description: 'eval() can execute arbitrary code and is extremely dangerous',
				recommendation: 'Remove eval() and use safer alternatives like JSON.parse()',
				cweId: 'CWE-95',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'high'
			},
			{
				type: 'unsafe-eval',
				severity: 'critical',
				pattern: /new\s+Function\s*\(/g,
				message: 'Unsafe use of Function constructor',
				description: 'Function constructor can execute arbitrary code like eval()',
				recommendation: 'Avoid dynamic code execution; use predefined functions',
				cweId: 'CWE-95',
				owaspCategory: 'A03:2021 - Injection',
				confidence: 'high'
			},

			// Insecure Random - MEDIUM
			{
				type: 'insecure-random',
				severity: 'medium',
				pattern: /Math\.random\s*\(\)/g,
				message: 'Insecure random number generation',
				description: 'Math.random() is not cryptographically secure',
				recommendation: 'Use crypto.randomBytes() for security-sensitive operations',
				cweId: 'CWE-330',
				owaspCategory: 'A02:2021 - Cryptographic Failures',
				confidence: 'medium'
			},

			// Weak Crypto - HIGH
			{
				type: 'weak-crypto',
				severity: 'high',
				pattern: /createCipher|createDecipher|createHash\s*\(\s*['"]md5['"]|createHash\s*\(\s*['"]sha1['"]/gi,
				message: 'Weak cryptographic algorithm',
				description: 'Using deprecated or weak cryptographic methods (MD5, SHA1, DES)',
				recommendation: 'Use strong algorithms: AES-256-GCM, SHA-256, or better',
				cweId: 'CWE-327',
				owaspCategory: 'A02:2021 - Cryptographic Failures',
				confidence: 'high'
			},

			// Prototype Pollution - HIGH
			{
				type: 'prototype-pollution',
				severity: 'high',
				pattern: /(?:Object|obj|\w+)\[['"]__proto__['"]\]|\[['"]constructor['"]\]\[['"]prototype['"]\]/g,
				message: 'Potential prototype pollution',
				description: 'Modifying __proto__ or constructor.prototype can lead to security issues',
				recommendation: 'Avoid dynamic property access on objects; use Object.create(null)',
				cweId: 'CWE-1321',
				owaspCategory: 'A08:2021 - Software and Data Integrity Failures',
				confidence: 'high'
			},

			// Open Redirect - MEDIUM
			{
				type: 'open-redirect',
				severity: 'medium',
				pattern: /(?:window\.location|location\.href|location\.replace)\s*=\s*(?:req\.(?:body|query|params)|input|userInput)/gi,
				message: 'Open redirect vulnerability',
				description: 'Redirecting to user-controlled URLs without validation',
				recommendation: 'Validate redirect URLs against an allowlist',
				cweId: 'CWE-601',
				owaspCategory: 'A01:2021 - Broken Access Control',
				confidence: 'medium'
			},

			// Sensitive Data Exposure - HIGH
			{
				type: 'sensitive-data-exposure',
				severity: 'high',
				pattern: /console\.log\s*\([^)]*(?:password|token|secret|creditCard|ssn|apiKey)/gi,
				message: 'Sensitive data in console logs',
				description: 'Logging sensitive information to console',
				recommendation: 'Remove sensitive data from logs or use secure logging',
				cweId: 'CWE-532',
				owaspCategory: 'A04:2021 - Insecure Design',
				confidence: 'high'
			},

			// CORS Misconfiguration - MEDIUM
			{
				type: 'cors-misconfiguration',
				severity: 'medium',
				pattern: /['"]Access-Control-Allow-Origin['"]\s*[,:]?\s*['"]?\*['"]?/gi,
				message: 'Insecure CORS configuration',
				description: 'CORS configured to allow all origins (*)',
				recommendation: 'Specify allowed origins explicitly; avoid wildcard',
				cweId: 'CWE-942',
				owaspCategory: 'A05:2021 - Security Misconfiguration',
				confidence: 'high'
			},

			// Information Disclosure - LOW
			{
				type: 'information-disclosure',
				severity: 'low',
				pattern: /\.stack\s*\)/g,
				message: 'Stack trace exposure',
				description: 'Exposing error stack traces can reveal sensitive information',
				recommendation: 'Log stack traces internally; show generic errors to users',
				cweId: 'CWE-209',
				owaspCategory: 'A05:2021 - Security Misconfiguration',
				confidence: 'low'
			}
		];
	}

	async scanWorkspace(): Promise<SecurityScanResult> {
		const startTime = performance.now();
		const issues: SecurityIssue[] = [];

		try {
			this.outputChannel.clear();
			this.outputChannel.show(true);
			this.log('🛡️ Security Scanner - Starting scan...\n');

			const collector = new ProjectFileCollector();
			const files = await collector.collectProjectFiles();
			
			// Filter for JS/TS files only
			const jstsFiles = files.filter(f => {
				const ext = path.extname(f.filePath).toLowerCase();
				return ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext);
			});

			this.log(`📁 Scanning ${jstsFiles.length} JavaScript/TypeScript files...\n`);

			let filesScanned = 0;
			for (const file of jstsFiles) {
				try {
					const fileIssues = await this.scanFile(file.filePath, file.relativePath);
					issues.push(...fileIssues);
					filesScanned++;
					
					if (fileIssues.length > 0) {
						this.log(`⚠️  ${file.relativePath}: Found ${fileIssues.length} issue(s)`);
					}
				} catch (error) {
					this.log(`❌ Error scanning ${file.relativePath}: ${error}`);
				}
			}

			const endTime = performance.now();
			const duration = endTime - startTime;

			const result: SecurityScanResult = {
				issues,
				filesScanned,
				totalIssues: issues.length,
				criticalCount: issues.filter(i => i.severity === 'critical').length,
				highCount: issues.filter(i => i.severity === 'high').length,
				mediumCount: issues.filter(i => i.severity === 'medium').length,
				lowCount: issues.filter(i => i.severity === 'low').length,
				scanDuration: duration,
				timestamp: new Date()
			};

			this.generateSummary(result);
			return result;

		} catch (error) {
			this.log(`\n❌ Scan failed: ${error}`);
			throw error;
		}
	}

	private async scanFile(filePath: string, relativePath: string): Promise<SecurityIssue[]> {
		const issues: SecurityIssue[] = [];

		try {
			const content = await fs.promises.readFile(filePath, 'utf8');
			const lines = content.split('\n');

			for (const pattern of this.vulnerabilityPatterns) {
				const matches = this.findPatternMatches(content, lines, pattern);
				issues.push(...matches.map(match => ({
					...match,
					filePath,
					relativePath
				})));
			}

		} catch (error) {
			console.error(`Error scanning file ${filePath}:`, error);
		}

		return issues;
	}

	private findPatternMatches(
		content: string,
		lines: string[],
		pattern: VulnerabilityPattern
	): Omit<SecurityIssue, 'filePath' | 'relativePath'>[] {
		const issues: Omit<SecurityIssue, 'filePath' | 'relativePath'>[] = [];
		
		// Reset regex state
		pattern.pattern.lastIndex = 0;

		let match;
		while ((match = pattern.pattern.exec(content)) !== null) {
			// Find line number
			const beforeMatch = content.substring(0, match.index);
			const lineNumber = beforeMatch.split('\n').length;
			const lineContent = lines[lineNumber - 1] || '';
			
			// Calculate column
			const lineStart = beforeMatch.lastIndexOf('\n') + 1;
			const column = match.index - lineStart + 1;

			// Skip if this is in a comment
			if (this.isInComment(lineContent, column)) {
				continue;
			}

			issues.push({
				type: pattern.type,
				severity: pattern.severity,
				line: lineNumber,
				column,
				code: lineContent.trim(),
				message: pattern.message,
				description: pattern.description,
				recommendation: pattern.recommendation,
				cweId: pattern.cweId,
				owaspCategory: pattern.owaspCategory,
				confidence: pattern.confidence
			});
		}

		return issues;
	}

	private isInComment(line: string, column: number): boolean {
		const beforeColumn = line.substring(0, column);
		
		// Check for single-line comments
		const singleCommentIndex = beforeColumn.indexOf('//');
		if (singleCommentIndex !== -1 && singleCommentIndex < column) {
			return true;
		}

		// Check for multi-line comments (simplified)
		const multiCommentStart = beforeColumn.lastIndexOf('/*');
		const multiCommentEnd = beforeColumn.lastIndexOf('*/');
		if (multiCommentStart !== -1 && multiCommentStart > multiCommentEnd) {
			return true;
		}

		return false;
	}

	private generateSummary(result: SecurityScanResult): void {
		this.log('\n' + '='.repeat(80));
		this.log('🛡️ SECURITY SCAN SUMMARY');
		this.log('='.repeat(80));

		this.log(`\n📊 SCAN STATISTICS:`);
		this.log(`   Files Scanned: ${result.filesScanned}`);
		this.log(`   Total Issues: ${result.totalIssues}`);
		this.log(`   Scan Duration: ${(result.scanDuration / 1000).toFixed(2)}s`);

		this.log(`\n⚠️  SEVERITY BREAKDOWN:`);
		this.log(`   🔴 Critical: ${result.criticalCount}`);
		this.log(`   🟠 High: ${result.highCount}`);
		this.log(`   🟡 Medium: ${result.mediumCount}`);
		this.log(`   🔵 Low: ${result.lowCount}`);

		if (result.totalIssues === 0) {
			this.log('\n✅ No security vulnerabilities detected!');
			return;
		}

		// Group by type
		const byType = result.issues.reduce((acc, issue) => {
			acc[issue.type] = (acc[issue.type] || 0) + 1;
			return acc;
		}, {} as Record<string, number>);

		this.log(`\n🔍 ISSUES BY TYPE:`);
		Object.entries(byType)
			.sort(([, a], [, b]) => b - a)
			.forEach(([type, count]) => {
				this.log(`   • ${this.formatVulnerabilityType(type)}: ${count}`);
			});

		// Show top critical issues
		const criticalIssues = result.issues.filter(i => i.severity === 'critical').slice(0, 5);
		if (criticalIssues.length > 0) {
			this.log(`\n🚨 TOP CRITICAL ISSUES:`);
			criticalIssues.forEach((issue, index) => {
				this.log(`\n   ${index + 1}. ${issue.message}`);
				this.log(`      File: ${issue.relativePath}:${issue.line}`);
				this.log(`      Code: ${issue.code}`);
				this.log(`      Fix: ${issue.recommendation}`);
			});
		}

		this.log(`\n💡 NEXT STEPS:`);
		this.log(`   1. Review critical issues first`);
		this.log(`   2. Click on issues in the Security panel to view details`);
		this.log(`   3. Apply recommended fixes`);
		this.log(`   4. Re-scan after fixing to verify`);
	}

	private formatVulnerabilityType(type: string): string {
		return type.split('-').map(word => 
			word.charAt(0).toUpperCase() + word.slice(1)
		).join(' ');
	}

	private log(message: string): void {
		this.outputChannel.appendLine(message);
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}
