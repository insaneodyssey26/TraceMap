import * as vscode from 'vscode';
import * as fs from 'fs';
import { FileComplexity, FunctionComplexity, ComplexityHeatmapData } from './types';
import { ProjectFileCollector } from './getProjectFiles';

export class ComplexityAnalyzer {
	private outputChannel: vscode.OutputChannel;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Complexity Analyzer');
	}

	async analyzeWorkspace(): Promise<ComplexityHeatmapData> {
		const startTime = Date.now();
		this.log('🔍 Starting complexity analysis...');

		const fileCollector = new ProjectFileCollector();
		const projectFiles = await fileCollector.collectProjectFiles();

		this.log(`📁 Found ${projectFiles.length} files to analyze`);

		const fileComplexities: FileComplexity[] = [];

		for (const file of projectFiles) {
			try {
				const complexity = await this.analyzeFile(file.filePath, file.relativePath);
				if (complexity) {
					fileComplexities.push(complexity);
				}
			} catch (error) {
				console.error(`Error analyzing ${file.filePath}:`, error);
			}
		}

		const scanDuration = Date.now() - startTime;

		const heatmapData: ComplexityHeatmapData = {
			files: fileComplexities,
			totalFiles: fileComplexities.length,
			averageComplexity: this.calculateAverageComplexity(fileComplexities),
			highComplexityFiles: fileComplexities.filter(f => f.complexityScore > 70).length,
			mediumComplexityFiles: fileComplexities.filter(f => f.complexityScore >= 40 && f.complexityScore <= 70).length,
			lowComplexityFiles: fileComplexities.filter(f => f.complexityScore < 40).length,
			mostComplexFile: this.getMostComplexFile(fileComplexities),
			timestamp: new Date(),
			scanDuration
		};

		this.log(`✅ Analysis complete! Found ${heatmapData.totalFiles} files`);
		this.log(`   High complexity: ${heatmapData.highComplexityFiles}`);
		this.log(`   Medium complexity: ${heatmapData.mediumComplexityFiles}`);
		this.log(`   Low complexity: ${heatmapData.lowComplexityFiles}`);

		return heatmapData;
	}

	async analyzeFile(filePath: string, relativePath: string): Promise<FileComplexity | null> {
		try {
			const content = await fs.promises.readFile(filePath, 'utf8');
			const language = this.detectLanguage(filePath);

			// Skip non-JS/TS files
			if (!['javascript', 'typescript'].includes(language)) {
				return null;
			}

			const lines = content.split('\n');
			const { codeLines, commentLines, blankLines } = this.countLines(lines);
			const functions = this.analyzeFunctions(content, lines);

			const averageCyclomaticComplexity = functions.length > 0
				? functions.reduce((sum, f) => sum + f.cyclomaticComplexity, 0) / functions.length
				: 0;

			const averageCognitiveComplexity = functions.length > 0
				? functions.reduce((sum, f) => sum + f.cognitiveComplexity, 0) / functions.length
				: 0;

			const maxCyclomaticComplexity = functions.length > 0
				? Math.max(...functions.map(f => f.cyclomaticComplexity))
				: 0;

			const maxCognitiveComplexity = functions.length > 0
				? Math.max(...functions.map(f => f.cognitiveComplexity))
				: 0;

			const maxNestedDepth = functions.length > 0
				? Math.max(...functions.map(f => f.nestedDepth))
				: 0;

			const maintainabilityIndex = this.calculateMaintainabilityIndex(
				codeLines,
				averageCyclomaticComplexity,
				commentLines
			);

			const complexityScore = this.calculateComplexityScore(
				averageCyclomaticComplexity,
				averageCognitiveComplexity,
				maxNestedDepth,
				codeLines,
				maintainabilityIndex
			);

			return {
				filePath,
				relativePath,
				language,
				totalLines: lines.length,
				codeLines,
				commentLines,
				blankLines,
				functions,
				averageCyclomaticComplexity,
				averageCognitiveComplexity,
				maxCyclomaticComplexity,
				maxCognitiveComplexity,
				maxNestedDepth,
				maintainabilityIndex,
				complexityScore
			};

		} catch (error) {
			console.error(`Error analyzing file ${filePath}:`, error);
			return null;
		}
	}

	private analyzeFunctions(content: string, lines: string[]): FunctionComplexity[] {
		const functions: FunctionComplexity[] = [];

		// Regex patterns for function detection
		const functionPatterns = [
			// Regular function: function name() {}
			/function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\((.*?)\)/g,
			// Arrow function: const name = () => {}
			/(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\((.*?)\)\s*=>/g,
			// Method: name() {}
			/([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\((.*?)\)\s*\{/g,
			// Async function: async function name() {}
			/async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\((.*?)\)/g
		];

		for (const pattern of functionPatterns) {
			let match;
			pattern.lastIndex = 0;

			while ((match = pattern.exec(content)) !== null) {
				const functionName = match[1];
				const parameters = match[2] || '';
				const paramCount = parameters.trim() ? parameters.split(',').length : 0;

				// Find the line number
				const beforeMatch = content.substring(0, match.index);
				const lineNumber = beforeMatch.split('\n').length;

				// Extract function body
				const functionBody = this.extractFunctionBody(content, match.index);
				const functionLines = functionBody.split('\n');
				const endLine = lineNumber + functionLines.length - 1;

				// Calculate complexities
				const cyclomaticComplexity = this.calculateCyclomaticComplexity(functionBody);
				const cognitiveComplexity = this.calculateCognitiveComplexity(functionBody);
				const nestedDepth = this.calculateNestedDepth(functionBody);

				functions.push({
					name: functionName,
					line: lineNumber,
					endLine,
					cyclomaticComplexity,
					cognitiveComplexity,
					nestedDepth,
					linesOfCode: functionLines.length,
					parameters: paramCount
				});
			}
		}

		// Remove duplicates (same function detected by multiple patterns)
		const uniqueFunctions = functions.filter((func, index, self) =>
			index === self.findIndex(f => f.name === func.name && f.line === func.line)
		);

		return uniqueFunctions;
	}

	private extractFunctionBody(content: string, startIndex: number): string {
		let braceCount = 0;
		let inFunction = false;
		let body = '';

		for (let i = startIndex; i < content.length; i++) {
			const char = content[i];

			if (char === '{') {
				braceCount++;
				inFunction = true;
			}

			if (inFunction) {
				body += char;
			}

			if (char === '}') {
				braceCount--;
				if (braceCount === 0 && inFunction) {
					break;
				}
			}
		}

		return body;
	}

	private calculateCyclomaticComplexity(code: string): number {
		// Base complexity is 1
		let complexity = 1;

		// Decision points that increase complexity
		const decisionPatterns = [
			/\bif\s*\(/g,          // if statements
			/\belse\s+if\s*\(/g,   // else if
			/\bfor\s*\(/g,         // for loops
			/\bwhile\s*\(/g,       // while loops
			/\bcase\s+/g,          // switch cases
			/\bcatch\s*\(/g,       // catch blocks
			/\?\s*.*?\s*:/g,       // ternary operators
			/&&/g,                 // logical AND
			/\|\|/g                // logical OR
		];

		for (const pattern of decisionPatterns) {
			const matches = code.match(pattern);
			if (matches) {
				complexity += matches.length;
			}
		}

		return complexity;
	}

	private calculateCognitiveComplexity(code: string): number {
		let complexity = 0;
		let nestingLevel = 0;
		const lines = code.split('\n');

		for (const line of lines) {
			const trimmed = line.trim();

			// Increase nesting level
			if (trimmed.match(/\{$/)) {
				nestingLevel++;
			}

			// Complexity increments with nesting
			if (trimmed.match(/\b(if|for|while|switch|catch)\b/)) {
				complexity += 1 + nestingLevel;
			}

			// Logical operators add complexity
			const andMatches = trimmed.match(/&&/g);
			const orMatches = trimmed.match(/\|\|/g);
			if (andMatches) {
				complexity += andMatches.length;
			}
			if (orMatches) {
				complexity += orMatches.length;
			}

			// Decrease nesting level
			if (trimmed.match(/^\}/)) {
				nestingLevel = Math.max(0, nestingLevel - 1);
			}
		}

		return complexity;
	}

	private calculateNestedDepth(code: string): number {
		let maxDepth = 0;
		let currentDepth = 0;

		for (const char of code) {
			if (char === '{') {
				currentDepth++;
				maxDepth = Math.max(maxDepth, currentDepth);
			} else if (char === '}') {
				currentDepth = Math.max(0, currentDepth - 1);
			}
		}

		return maxDepth;
	}

	private countLines(lines: string[]): { codeLines: number; commentLines: number; blankLines: number } {
		let codeLines = 0;
		let commentLines = 0;
		let blankLines = 0;
		let inBlockComment = false;

		for (const line of lines) {
			const trimmed = line.trim();

			if (trimmed === '') {
				blankLines++;
			} else if (trimmed.startsWith('//')) {
				commentLines++;
			} else if (trimmed.startsWith('/*')) {
				commentLines++;
				inBlockComment = true;
			} else if (inBlockComment) {
				commentLines++;
				if (trimmed.includes('*/')) {
					inBlockComment = false;
				}
			} else {
				codeLines++;
			}
		}

		return { codeLines, commentLines, blankLines };
	}

	private calculateMaintainabilityIndex(
		linesOfCode: number,
		avgComplexity: number,
		commentLines: number
	): number {
		// Microsoft's Maintainability Index formula (simplified)
		// MI = MAX(0, (171 - 5.2 * ln(HV) - 0.23 * CC - 16.2 * ln(LOC)) * 100 / 171)
		// HV = Halstead Volume (approximated), CC = Cyclomatic Complexity, LOC = Lines of Code

		const halsteadVolume = Math.log(linesOfCode + 1) * 10; // Simplified approximation
		const commentRatio = linesOfCode > 0 ? commentLines / linesOfCode : 0;

		let mi = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * avgComplexity - 16.2 * Math.log(linesOfCode + 1);
		mi = (mi * 100) / 171;
		
		// Adjust for comments (good comments improve maintainability)
		mi += commentRatio * 10;

		return Math.max(0, Math.min(100, mi));
	}

	private calculateComplexityScore(
		avgCyclomatic: number,
		avgCognitive: number,
		maxDepth: number,
		linesOfCode: number,
		maintainabilityIndex: number
	): number {
		// Calculate a 0-100 complexity score (higher = more complex)
		let score = 0;

		// Cyclomatic complexity contribution (0-30 points)
		score += Math.min(30, avgCyclomatic * 2);

		// Cognitive complexity contribution (0-30 points)
		score += Math.min(30, avgCognitive * 1.5);

		// Nesting depth contribution (0-20 points)
		score += Math.min(20, maxDepth * 3);

		// Lines of code contribution (0-10 points)
		score += Math.min(10, linesOfCode / 50);

		// Maintainability index (inverse, 0-10 points)
		score += (100 - maintainabilityIndex) / 10;

		return Math.min(100, Math.round(score));
	}

	private detectLanguage(filePath: string): string {
		const ext = filePath.split('.').pop()?.toLowerCase();
		const langMap: Record<string, string> = {
			'js': 'javascript',
			'jsx': 'javascript',
			'mjs': 'javascript',
			'cjs': 'javascript',
			'ts': 'typescript',
			'tsx': 'typescript'
		};
		return langMap[ext || ''] || 'unknown';
	}

	private calculateAverageComplexity(files: FileComplexity[]): number {
		if (files.length === 0) {
			return 0;
		}
		const total = files.reduce((sum, f) => sum + f.complexityScore, 0);
		return Math.round(total / files.length);
	}

	private getMostComplexFile(files: FileComplexity[]): FileComplexity | null {
		if (files.length === 0) {
			return null;
		}
		return files.reduce((max, file) => 
			file.complexityScore > max.complexityScore ? file : max
		);
	}

	private log(message: string): void {
		this.outputChannel.appendLine(message);
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}
