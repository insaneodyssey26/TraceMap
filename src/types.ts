export interface CodeFile {
	path: string;
	content: string;
	language: string;
	size: number;
}

export interface SearchResult {
	file: string;
	line: number;
	content: string;
	explanation: string;
	confidence?: number;
}

export interface AIProvider {
	name: string;
	query(prompt: string): Promise<string>;
}

export interface SearchOptions {
	maxFiles?: number;
	maxFileSize?: number;
	includedExtensions?: string[];
	excludePatterns?: string[];
}

export interface LLMResponse {
	results: SearchResult[];
}

export interface CodeSnapshot {
	id: string;
	timestamp: Date;
	filePath: string;
	fileName: string;
	content: string;
	language: string;
}

export interface SecurityIssue {
	type: SecurityVulnerabilityType;
	severity: 'critical' | 'high' | 'medium' | 'low';
	filePath: string;
	relativePath: string;
	line: number;
	column: number;
	code: string;
	message: string;
	description: string;
	recommendation: string;
	cweId?: string;
	owaspCategory?: string;
	confidence: 'high' | 'medium' | 'low';
}

export type SecurityVulnerabilityType = 
	| 'hardcoded-secret'
	| 'sql-injection'
	| 'xss-vulnerability'
	| 'command-injection'
	| 'path-traversal'
	| 'insecure-random'
	| 'weak-crypto'
	| 'unsafe-eval'
	| 'prototype-pollution'
	| 'xxe-vulnerability'
	| 'open-redirect'
	| 'insecure-deserialization'
	| 'sensitive-data-exposure'
	| 'cors-misconfiguration'
	| 'csrf-vulnerability'
	| 'information-disclosure';

export interface SecurityScanResult {
	issues: SecurityIssue[];
	filesScanned: number;
	totalIssues: number;
	criticalCount: number;
	highCount: number;
	mediumCount: number;
	lowCount: number;
	scanDuration: number;
	timestamp: Date;
}
export interface FunctionComplexity {
	name: string;
	line: number;
	endLine: number;
	cyclomaticComplexity: number;
	cognitiveComplexity: number;
	nestedDepth: number;
	linesOfCode: number;
	parameters: number;
}

export interface FileComplexity {
	filePath: string;
	relativePath: string;
	language: string;
	totalLines: number;
	codeLines: number;
	commentLines: number;
	blankLines: number;
	functions: FunctionComplexity[];
	averageCyclomaticComplexity: number;
	averageCognitiveComplexity: number;
	maxCyclomaticComplexity: number;
	maxCognitiveComplexity: number;
	maxNestedDepth: number;
	maintainabilityIndex: number;
	complexityScore: number; // 0-100, higher is more complex
}

export interface ComplexityHeatmapData {
	files: FileComplexity[];
	totalFiles: number;
	averageComplexity: number;
	highComplexityFiles: number; // score > 70
	mediumComplexityFiles: number; // score 40-70
	lowComplexityFiles: number; // score < 40
	mostComplexFile: FileComplexity | null;
	timestamp: Date;
	scanDuration: number;
}