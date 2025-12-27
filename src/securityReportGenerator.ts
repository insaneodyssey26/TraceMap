import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityScanResult, SecurityIssue } from './types';

export class SecurityReportGenerator {
	private outputChannel: vscode.OutputChannel;
	private reportsPath: string;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Security Reports');
		
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const reportsBasePath = workspaceFolder 
			? path.join(workspaceFolder.uri.fsPath)
			: path.join(require('os').homedir());
			
		this.reportsPath = path.join(reportsBasePath, '.what-the-code-reports');
		this.ensureReportsDirectory();
	}

	private ensureReportsDirectory(): void {
		if (!fs.existsSync(this.reportsPath)) {
			fs.mkdirSync(this.reportsPath, { recursive: true });
		}
	}

	async generateSecurityReport(result: SecurityScanResult): Promise<string> {
		const htmlContent = this.generateHTML(result);
		const fileName = this.generateReportFileName();
		const reportPath = path.join(this.reportsPath, fileName);
		
		fs.writeFileSync(reportPath, htmlContent, 'utf8');
		
		this.outputChannel.appendLine(`🛡️ Security report generated: ${reportPath}`);
		return reportPath;
	}

	private generateHTML(result: SecurityScanResult): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Scan Report</title>
    ${this.getStyles()}
</head>
<body>
    <div class="container">
        ${this.generateHeader(result)}
        ${this.generateSummary(result)}
        ${this.generateSeveritySection(result)}
        ${this.generateIssuesSection(result)}
        ${this.generateFooter()}
    </div>
</body>
</html>`;
	}

	private generateHeader(result: SecurityScanResult): string {
		return `
		<header class="report-header">
			<div class="header-content">
				<h1>🛡️ Security Scan Report</h1>
				<h2>Vulnerability Assessment</h2>
				<p class="timestamp">Generated on ${result.timestamp.toLocaleString()}</p>
			</div>
		</header>`;
	}

	private generateSummary(result: SecurityScanResult): string {
		const riskLevel = this.calculateRiskLevel(result);
		const riskClass = riskLevel.toLowerCase().replace(' ', '-');

		return `
		<section class="summary-section">
			<div class="summary-grid">
				<div class="summary-card">
					<h3>📊 Files Scanned</h3>
					<div class="count">${result.filesScanned}</div>
				</div>
				<div class="summary-card">
					<h3>⚠️ Total Issues</h3>
					<div class="count ${result.totalIssues > 0 ? 'has-issues' : 'no-issues'}">${result.totalIssues}</div>
				</div>
				<div class="summary-card">
					<h3>⏱️ Scan Duration</h3>
					<div class="count">${(result.scanDuration / 1000).toFixed(2)}s</div>
				</div>
				<div class="summary-card">
					<h3>🎯 Risk Level</h3>
					<div class="risk ${riskClass}">${riskLevel}</div>
				</div>
			</div>
		</section>`;
	}

	private generateSeveritySection(result: SecurityScanResult): string {
		return `
		<section class="severity-section">
			<h2>📊 Issues by Severity</h2>
			<div class="severity-grid">
				<div class="severity-card critical">
					<div class="severity-icon">🔴</div>
					<div class="severity-label">Critical</div>
					<div class="severity-count">${result.criticalCount}</div>
					<div class="severity-description">Immediate action required</div>
				</div>
				<div class="severity-card high">
					<div class="severity-icon">🟠</div>
					<div class="severity-label">High</div>
					<div class="severity-count">${result.highCount}</div>
					<div class="severity-description">Should be fixed soon</div>
				</div>
				<div class="severity-card medium">
					<div class="severity-icon">🟡</div>
					<div class="severity-label">Medium</div>
					<div class="severity-count">${result.mediumCount}</div>
					<div class="severity-description">Fix when possible</div>
				</div>
				<div class="severity-card low">
					<div class="severity-icon">🔵</div>
					<div class="severity-label">Low</div>
					<div class="severity-count">${result.lowCount}</div>
					<div class="severity-description">Minor issues</div>
				</div>
			</div>
		</section>`;
	}

	private generateIssuesSection(result: SecurityScanResult): string {
		if (result.totalIssues === 0) {
			return `
			<section class="issues-section">
				<h2>✅ Security Issues</h2>
				<div class="no-issues">
					<div class="success-icon">✅</div>
					<h3>No Security Vulnerabilities Detected!</h3>
					<p>Your codebase appears to be free of common security issues.</p>
				</div>
			</section>`;
		}

		// Group issues by severity
		const critical = result.issues.filter(i => i.severity === 'critical');
		const high = result.issues.filter(i => i.severity === 'high');
		const medium = result.issues.filter(i => i.severity === 'medium');
		const low = result.issues.filter(i => i.severity === 'low');

		let html = `<section class="issues-section"><h2>🔍 Detailed Findings</h2>`;

		if (critical.length > 0) {
			html += this.generateIssueGroup('Critical Issues', critical, 'critical');
		}
		if (high.length > 0) {
			html += this.generateIssueGroup('High Severity Issues', high, 'high');
		}
		if (medium.length > 0) {
			html += this.generateIssueGroup('Medium Severity Issues', medium, 'medium');
		}
		if (low.length > 0) {
			html += this.generateIssueGroup('Low Severity Issues', low, 'low');
		}

		html += `</section>`;
		return html;
	}

	private generateIssueGroup(title: string, issues: SecurityIssue[], severity: string): string {
		const issuesHTML = issues.map(issue => `
			<div class="issue-card ${severity}">
				<div class="issue-header">
					<div class="issue-title">
						<span class="issue-icon">${this.getVulnerabilityIcon(issue.type)}</span>
						<span class="issue-message">${issue.message}</span>
					</div>
					<span class="severity-badge ${severity}">${severity.toUpperCase()}</span>
				</div>
				<div class="issue-body">
					<div class="issue-location">
						<strong>📁 Location:</strong> ${issue.relativePath}:${issue.line}:${issue.column}
					</div>
					<div class="issue-code">
						<strong>💻 Code:</strong>
						<pre><code>${this.escapeHtml(issue.code)}</code></pre>
					</div>
					<div class="issue-description">
						<strong>📝 Description:</strong> ${issue.description}
					</div>
					<div class="issue-recommendation">
						<strong>💡 Recommendation:</strong> ${issue.recommendation}
					</div>
					${issue.cweId ? `<div class="issue-meta"><strong>CWE:</strong> ${issue.cweId}</div>` : ''}
					${issue.owaspCategory ? `<div class="issue-meta"><strong>OWASP:</strong> ${issue.owaspCategory}</div>` : ''}
				</div>
			</div>
		`).join('');

		return `
			<div class="issue-group">
				<h3 class="group-title ${severity}">${title} (${issues.length})</h3>
				<div class="issues-list">
					${issuesHTML}
				</div>
			</div>
		`;
	}

	private generateFooter(): string {
		return `
		<footer class="report-footer">
			<p>Generated by <strong>What-The-Code</strong> Security Scanner</p>
			<p class="disclaimer">
				This report is based on static code analysis and may contain false positives.
				Always review findings in context and test fixes thoroughly.
			</p>
		</footer>`;
	}

	private getVulnerabilityIcon(type: string): string {
		const icons: Record<string, string> = {
			'hardcoded-secret': '🔑',
			'sql-injection': '💉',
			'xss-vulnerability': '🌐',
			'command-injection': '⚙️',
			'path-traversal': '📁',
			'insecure-random': '🎲',
			'weak-crypto': '🔓',
			'unsafe-eval': '⚠️',
			'prototype-pollution': '🧬',
			'xxe-vulnerability': '📄',
			'open-redirect': '↗️',
			'insecure-deserialization': '📦',
			'sensitive-data-exposure': '👁️',
			'cors-misconfiguration': '🌍',
			'csrf-vulnerability': '🔀',
			'information-disclosure': 'ℹ️'
		};
		return icons[type] || '⚠️';
	}

	private calculateRiskLevel(result: SecurityScanResult): string {
		if (result.criticalCount > 0) {
			return 'CRITICAL';
		}
		if (result.highCount >= 5) {
			return 'HIGH';
		}
		if (result.highCount > 0 || result.mediumCount >= 10) {
			return 'MEDIUM';
		}
		if (result.mediumCount > 0 || result.lowCount > 0) {
			return 'LOW';
		}
		return 'CLEAN';
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	private generateReportFileName(): string {
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		const timeStr = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-');
		return `Security_Report_${dateStr}_${timeStr}.html`;
	}

	private getStyles(): string {
		return `
		<style>
			* {
				margin: 0;
				padding: 0;
				box-sizing: border-box;
			}
			
			body {
				font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
				line-height: 1.6;
				color: #333;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				min-height: 100vh;
				padding: 20px;
			}
			
			.container {
				max-width: 1400px;
				margin: 0 auto;
			}
			
			.report-header {
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(10px);
				color: #333;
				padding: 40px;
				border-radius: 15px;
				margin-bottom: 30px;
				text-align: center;
				box-shadow: 0 8px 32px rgba(0,0,0,0.1);
			}
			
			.report-header h1 {
				font-size: 2.5rem;
				margin-bottom: 10px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
			}
			
			.report-header h2 {
				font-size: 1.2rem;
				opacity: 0.8;
				margin-bottom: 15px;
			}
			
			.timestamp {
				opacity: 0.7;
				font-size: 0.9rem;
			}
			
			.summary-section, .severity-section, .issues-section {
				background: rgba(255, 255, 255, 0.95);
				backdrop-filter: blur(10px);
				padding: 30px;
				border-radius: 15px;
				margin-bottom: 30px;
				box-shadow: 0 8px 32px rgba(0,0,0,0.1);
			}
			
			.summary-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 20px;
			}
			
			.summary-card {
				background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
				padding: 25px;
				border-radius: 12px;
				text-align: center;
				border: 2px solid transparent;
				transition: all 0.3s ease;
			}
			
			.summary-card:hover {
				transform: translateY(-5px);
				box-shadow: 0 10px 25px rgba(0,0,0,0.15);
			}
			
			.summary-card h3 {
				font-size: 0.9rem;
				color: #666;
				margin-bottom: 15px;
			}
			
			.summary-card .count {
				font-size: 2.5rem;
				font-weight: bold;
				color: #333;
			}
			
			.count.has-issues {
				color: #dc3545;
			}
			
			.count.no-issues {
				color: #28a745;
			}
			
			.risk {
				font-size: 2rem;
				font-weight: bold;
				padding: 10px;
				border-radius: 8px;
			}
			
			.risk.critical {
				background: #ffebee;
				color: #c62828;
			}
			
			.risk.high {
				background: #fff3e0;
				color: #ef6c00;
			}
			
			.risk.medium {
				background: #fff9c4;
				color: #f57f17;
			}
			
			.risk.low {
				background: #e3f2fd;
				color: #1565c0;
			}
			
			.risk.clean {
				background: #e8f5e9;
				color: #2e7d32;
			}
			
			.severity-section h2, .issues-section h2 {
				margin-bottom: 25px;
				color: #333;
			}
			
			.severity-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 20px;
			}
			
			.severity-card {
				padding: 25px;
				border-radius: 12px;
				text-align: center;
				border: 3px solid;
				transition: all 0.3s ease;
			}
			
			.severity-card:hover {
				transform: translateY(-5px);
				box-shadow: 0 10px 25px rgba(0,0,0,0.2);
			}
			
			.severity-card.critical {
				background: #ffebee;
				border-color: #c62828;
			}
			
			.severity-card.high {
				background: #fff3e0;
				border-color: #ef6c00;
			}
			
			.severity-card.medium {
				background: #fff9c4;
				border-color: #f57f17;
			}
			
			.severity-card.low {
				background: #e3f2fd;
				border-color: #1565c0;
			}
			
			.severity-icon {
				font-size: 3rem;
				margin-bottom: 10px;
			}
			
			.severity-label {
				font-size: 1.2rem;
				font-weight: bold;
				margin-bottom: 10px;
			}
			
			.severity-count {
				font-size: 2.5rem;
				font-weight: bold;
				margin-bottom: 10px;
			}
			
			.severity-description {
				font-size: 0.9rem;
				opacity: 0.8;
			}
			
			.no-issues {
				text-align: center;
				padding: 60px 20px;
			}
			
			.success-icon {
				font-size: 5rem;
				margin-bottom: 20px;
			}
			
			.no-issues h3 {
				color: #28a745;
				margin-bottom: 10px;
			}
			
			.issue-group {
				margin-bottom: 40px;
			}
			
			.group-title {
				font-size: 1.5rem;
				margin-bottom: 20px;
				padding: 15px;
				border-radius: 8px;
				border-left: 5px solid;
			}
			
			.group-title.critical {
				background: #ffebee;
				border-color: #c62828;
				color: #c62828;
			}
			
			.group-title.high {
				background: #fff3e0;
				border-color: #ef6c00;
				color: #ef6c00;
			}
			
			.group-title.medium {
				background: #fff9c4;
				border-color: #f57f17;
				color: #f57f17;
			}
			
			.group-title.low {
				background: #e3f2fd;
				border-color: #1565c0;
				color: #1565c0;
			}
			
			.issues-list {
				display: flex;
				flex-direction: column;
				gap: 20px;
			}
			
			.issue-card {
				background: white;
				border-radius: 10px;
				padding: 20px;
				border-left: 5px solid;
				box-shadow: 0 4px 15px rgba(0,0,0,0.1);
				transition: all 0.3s ease;
			}
			
			.issue-card:hover {
				transform: translateX(5px);
				box-shadow: 0 6px 20px rgba(0,0,0,0.15);
			}
			
			.issue-card.critical {
				border-color: #c62828;
			}
			
			.issue-card.high {
				border-color: #ef6c00;
			}
			
			.issue-card.medium {
				border-color: #f57f17;
			}
			
			.issue-card.low {
				border-color: #1565c0;
			}
			
			.issue-header {
				display: flex;
				justify-content: space-between;
				align-items: start;
				margin-bottom: 15px;
			}
			
			.issue-title {
				display: flex;
				align-items: center;
				gap: 10px;
			}
			
			.issue-icon {
				font-size: 1.5rem;
			}
			
			.issue-message {
				font-size: 1.1rem;
				font-weight: bold;
				color: #333;
			}
			
			.severity-badge {
				padding: 5px 12px;
				border-radius: 20px;
				font-size: 0.75rem;
				font-weight: bold;
				text-transform: uppercase;
			}
			
			.severity-badge.critical {
				background: #c62828;
				color: white;
			}
			
			.severity-badge.high {
				background: #ef6c00;
				color: white;
			}
			
			.severity-badge.medium {
				background: #f57f17;
				color: white;
			}
			
			.severity-badge.low {
				background: #1565c0;
				color: white;
			}
			
			.issue-body > div {
				margin-bottom: 12px;
			}
			
			.issue-location {
				color: #666;
				font-size: 0.9rem;
			}
			
			.issue-code {
				margin: 15px 0;
			}
			
			.issue-code pre {
				background: #f5f5f5;
				padding: 15px;
				border-radius: 6px;
				border-left: 3px solid #007acc;
				overflow-x: auto;
			}
			
			.issue-code code {
				font-family: 'Consolas', 'Monaco', monospace;
				font-size: 0.9rem;
				color: #333;
			}
			
			.issue-description {
				color: #555;
				line-height: 1.6;
			}
			
			.issue-recommendation {
				background: #e8f5e9;
				padding: 12px;
				border-radius: 6px;
				border-left: 3px solid #2e7d32;
				color: #2e7d32;
			}
			
			.issue-meta {
				color: #666;
				font-size: 0.85rem;
			}
			
			.report-footer {
				background: rgba(255, 255, 255, 0.1);
				backdrop-filter: blur(10px);
				color: white;
				text-align: center;
				padding: 30px;
				border-radius: 10px;
			}
			
			.disclaimer {
				font-size: 0.9rem;
				margin-top: 15px;
				opacity: 0.9;
				font-style: italic;
			}
			
			@media (max-width: 768px) {
				.summary-grid, .severity-grid {
					grid-template-columns: 1fr;
				}
				
				.issue-header {
					flex-direction: column;
					gap: 10px;
				}
			}
		</style>`;
	}

	async openReport(reportPath: string): Promise<void> {
		try {
			const uri = vscode.Uri.file(reportPath);
			await vscode.env.openExternal(uri);
			this.outputChannel.appendLine(`📖 Opened security report: ${reportPath}`);
		} catch (error) {
			this.outputChannel.appendLine(`❌ Failed to open report: ${error}`);
			vscode.window.showErrorMessage(`Failed to open security report: ${error}`);
		}
	}

	getReportsPath(): string {
		return this.reportsPath;
	}
6
	dispose(): void {
		this.outputChannel.dispose();
	}
}
