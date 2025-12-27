import * as vscode from 'vscode';
import { SecurityIssue, SecurityScanResult } from './types';

export class SecurityActionsProvider implements vscode.TreeDataProvider<SecurityTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<SecurityTreeItem | undefined | null | void> = 
		new vscode.EventEmitter<SecurityTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<SecurityTreeItem | undefined | null | void> = 
		this._onDidChangeTreeData.event;

	private scanResult: SecurityScanResult | null = null;

	constructor() {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateResults(result: SecurityScanResult): void {
		this.scanResult = result;
		this.refresh();
	}

	clearResults(): void {
		this.scanResult = null;
		this.refresh();
	}

	getResults(): SecurityScanResult | null {
		return this.scanResult;
	}
	
	dispose(): void {
		// Cleanup if needed
	}

	getTreeItem(element: SecurityTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: SecurityTreeItem): Thenable<SecurityTreeItem[]> {
		if (!this.scanResult || this.scanResult.totalIssues === 0) {
			return Promise.resolve([
				new SecurityTreeItem(
					'No security scan results',
					'Click "Scan for Vulnerabilities" to start',
					vscode.TreeItemCollapsibleState.None,
					'info',
					{
						command: 'what-the-code.scanSecurity',
						title: 'Scan Now',
						arguments: []
					}
				)
			]);
		}

		if (!element) {
			// Root level - show summary and severity groups
			const items: SecurityTreeItem[] = [];

			// Summary item
			items.push(new SecurityTreeItem(
				`📊 ${this.scanResult.totalIssues} Total Issues`,
				`${this.scanResult.filesScanned} files scanned`,
				vscode.TreeItemCollapsibleState.None,
				'summary'
			));

			// Severity groups
			if (this.scanResult.criticalCount > 0) {
				items.push(new SecurityTreeItem(
					`🔴 Critical (${this.scanResult.criticalCount})`,
					'Immediate action required',
					vscode.TreeItemCollapsibleState.Expanded,
					'critical-group'
				));
			}

			if (this.scanResult.highCount > 0) {
				items.push(new SecurityTreeItem(
					`🟠 High (${this.scanResult.highCount})`,
					'Should be fixed soon',
					vscode.TreeItemCollapsibleState.Collapsed,
					'high-group'
				));
			}

			if (this.scanResult.mediumCount > 0) {
				items.push(new SecurityTreeItem(
					`🟡 Medium (${this.scanResult.mediumCount})`,
					'Fix when possible',
					vscode.TreeItemCollapsibleState.Collapsed,
					'medium-group'
				));
			}

			if (this.scanResult.lowCount > 0) {
				items.push(new SecurityTreeItem(
					`🔵 Low (${this.scanResult.lowCount})`,
					'Minor issues',
					vscode.TreeItemCollapsibleState.Collapsed,
					'low-group'
				));
			}

			return Promise.resolve(items);
		}

		// Children of severity groups - show individual issues
		if (element.contextValue?.endsWith('-group')) {
			const severity = element.contextValue.replace('-group', '') as 'critical' | 'high' | 'medium' | 'low';
			const issues = this.scanResult.issues.filter(i => i.severity === severity);
			
			return Promise.resolve(issues.map(issue => {
				const item = new SecurityTreeItem(
					`${this.getVulnerabilityIcon(issue.type)} ${issue.message}`,
					`Line ${issue.line}`,
					vscode.TreeItemCollapsibleState.None,
					'issue',
					{
						command: 'what-the-code.openSecurityIssue',
						title: 'Open Issue',
						arguments: [issue]
					}
				);
				
				item.tooltip = this.createTooltip(issue);
				
				return item;
			}));
		}

		return Promise.resolve([]);
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

	private createTooltip(issue: SecurityIssue): vscode.MarkdownString {
		const tooltip = new vscode.MarkdownString();
		tooltip.supportHtml = true;
		tooltip.isTrusted = true;

		tooltip.appendMarkdown(`### ${issue.message}\n\n`);
		tooltip.appendMarkdown(`**Severity:** ${this.getSeverityBadge(issue.severity)}\n\n`);
		tooltip.appendMarkdown(`**File:** \`${issue.relativePath}:${issue.line}\`\n\n`);
		tooltip.appendMarkdown(`**Description:** ${issue.description}\n\n`);
		tooltip.appendMarkdown(`**Code:**\n\`\`\`javascript\n${issue.code}\n\`\`\`\n\n`);
		tooltip.appendMarkdown(`**Recommendation:** ${issue.recommendation}\n\n`);
		
		if (issue.cweId) {
			tooltip.appendMarkdown(`**CWE:** ${issue.cweId}\n\n`);
		}
		
		if (issue.owaspCategory) {
			tooltip.appendMarkdown(`**OWASP:** ${issue.owaspCategory}\n\n`);
		}

		return tooltip;
	}

	private getSeverityBadge(severity: string): string {
		const badges: Record<string, string> = {
			'critical': '🔴 CRITICAL',
			'high': '🟠 HIGH',
			'medium': '🟡 MEDIUM',
			'low': '🔵 LOW'
		};
		return badges[severity] || severity.toUpperCase();
	}
}

export class SecurityTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly description: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly contextValue: string,
		public readonly command?: vscode.Command
	) {
		super(label, collapsibleState);
		this.description = description;
		this.contextValue = contextValue;
		
		if (command) {
			this.command = command;
		}

		// Set icons based on context
		if (contextValue === 'critical-group') {
			this.iconPath = new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
		} else if (contextValue === 'high-group') {
			this.iconPath = new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
		} else if (contextValue === 'medium-group') {
			this.iconPath = new vscode.ThemeIcon('info', new vscode.ThemeColor('editorInfo.foreground'));
		} else if (contextValue === 'low-group') {
			this.iconPath = new vscode.ThemeIcon('circle-outline');
		} else if (contextValue === 'summary') {
			this.iconPath = new vscode.ThemeIcon('graph');
		} else if (contextValue === 'info') {
			this.iconPath = new vscode.ThemeIcon('lightbulb');
		} else if (contextValue === 'issue') {
			this.iconPath = new vscode.ThemeIcon('bug');
		}
	}
}
