import * as vscode from 'vscode';
import * as path from 'path';
import { FileComplexity, FunctionComplexity } from './types';

export class ComplexityActionsProvider implements vscode.TreeDataProvider<ComplexityTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ComplexityTreeItem | undefined | null | void> = 
		new vscode.EventEmitter<ComplexityTreeItem | undefined | null | void>();
	readonly onDidChangeTreeData: vscode.Event<ComplexityTreeItem | undefined | null | void> = 
		this._onDidChangeTreeData.event;

	private fileComplexities: FileComplexity[] = [];
	private workspaceRoot: string = '';

	constructor() {}

	refresh(): void {
		this._onDidChangeTreeData.fire();
	}

	updateComplexityData(files: FileComplexity[], workspaceRoot: string): void {
		this.fileComplexities = files.sort((a, b) => b.complexityScore - a.complexityScore);
		this.workspaceRoot = workspaceRoot;
		this.refresh();
	}

	clear(): void {
		this.fileComplexities = [];
		this.refresh();
	}

	getTreeItem(element: ComplexityTreeItem): vscode.TreeItem {
		return element;
	}

	async getChildren(element?: ComplexityTreeItem): Promise<ComplexityTreeItem[]> {
		if (!element) {
			// Root level - show summary and files
			if (this.fileComplexities.length === 0) {
				return [new ComplexityTreeItem(
					'No complexity analysis available',
					'',
					'info',
					vscode.TreeItemCollapsibleState.None
				)];
			}

			const items: ComplexityTreeItem[] = [];

			// Add summary item
			const totalFiles = this.fileComplexities.length;
			const avgComplexity = Math.round(
				this.fileComplexities.reduce((sum, f) => sum + f.complexityScore, 0) / totalFiles
			);
			const highComplexityFiles = this.fileComplexities.filter(f => f.complexityScore > 70).length;
			const mediumComplexityFiles = this.fileComplexities.filter(f => f.complexityScore >= 40 && f.complexityScore <= 70).length;
			const lowComplexityFiles = this.fileComplexities.filter(f => f.complexityScore < 40).length;

			items.push(new ComplexityTreeItem(
				`📊 Analyzed ${totalFiles} files`,
				`Avg: ${avgComplexity}/100`,
				'summary',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`🔴 High: ${highComplexityFiles}`,
				'Complexity > 70',
				'category',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`🟡 Medium: ${mediumComplexityFiles}`,
				'Complexity 40-70',
				'category',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`🟢 Low: ${lowComplexityFiles}`,
				'Complexity < 40',
				'category',
				vscode.TreeItemCollapsibleState.None
			));

			// Add separator
			items.push(new ComplexityTreeItem(
				'─────────────────',
				'',
				'separator',
				vscode.TreeItemCollapsibleState.None
			));

			// Add file items (top 20 most complex files)
			const topFiles = this.fileComplexities.slice(0, 20);
			for (const fileComplexity of topFiles) {
				const relativePath = path.relative(this.workspaceRoot, fileComplexity.filePath);
				const icon = this.getComplexityIcon(fileComplexity.complexityScore);
				
				items.push(new ComplexityTreeItem(
					`${icon} ${path.basename(fileComplexity.filePath)}`,
					`${fileComplexity.complexityScore}/100 • ${relativePath}`,
					'file',
					vscode.TreeItemCollapsibleState.Collapsed,
					fileComplexity
				));
			}

			return items;
		} else if (element.contextValue === 'file' && element.fileComplexity) {
			// Show functions in the file
			const items: ComplexityTreeItem[] = [];
			const file = element.fileComplexity;

			// Add file metrics
			items.push(new ComplexityTreeItem(
				`📏 Lines: ${file.totalLines}`,
				`Code: ${file.codeLines} | Comments: ${file.commentLines}`,
				'metric',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`📊 Cyclomatic: ${file.averageCyclomaticComplexity.toFixed(1)}`,
				'Average per function',
				'metric',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`🧠 Cognitive: ${file.averageCognitiveComplexity.toFixed(1)}`,
				'Average per function',
				'metric',
				vscode.TreeItemCollapsibleState.None
			));

			items.push(new ComplexityTreeItem(
				`🔧 Maintainability: ${file.maintainabilityIndex.toFixed(1)}/100`,
				'Higher is better',
				'metric',
				vscode.TreeItemCollapsibleState.None
			));

			if (file.functions.length > 0) {
				items.push(new ComplexityTreeItem(
					'─────────────────',
					'',
					'separator',
					vscode.TreeItemCollapsibleState.None
				));

				items.push(new ComplexityTreeItem(
					`🔢 ${file.functions.length} Functions`,
					'Top 10 most complex',
					'section',
					vscode.TreeItemCollapsibleState.None
				));

				// Show top 10 most complex functions
				const topFunctions = [...file.functions]
					.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
					.slice(0, 10);

				for (const func of topFunctions) {
					const icon = this.getComplexityIcon(func.cyclomaticComplexity * 10); // Scale for display
					items.push(new ComplexityTreeItem(
						`${icon} ${func.name}`,
						`Cyclomatic: ${func.cyclomaticComplexity} | Cognitive: ${func.cognitiveComplexity} | ${func.linesOfCode} lines`,
						'function',
						vscode.TreeItemCollapsibleState.None,
						undefined,
						file.filePath,
						1 // Line number not stored in type
					));
				}
			}

			return items;
		}

		return [];
	}

	private getComplexityIcon(score: number): string {
		if (score > 70) {
			return '🔴';
		} else if (score >= 40) {
			return '🟡';
		} else {
			return '🟢';
		}
	}
}

export class ComplexityTreeItem extends vscode.TreeItem {
	constructor(
		public readonly label: string,
		public readonly description: string,
		public readonly contextValue: string,
		public readonly collapsibleState: vscode.TreeItemCollapsibleState,
		public readonly fileComplexity?: FileComplexity,
		public readonly filePath?: string,
		public readonly line?: number
	) {
		super(label, collapsibleState);
		
		this.description = description;
		this.contextValue = contextValue;

		// Make files and functions clickable
		if (contextValue === 'file' && fileComplexity) {
			this.command = {
				command: 'vscode.open',
				title: 'Open File',
				arguments: [vscode.Uri.file(fileComplexity.filePath)]
			};
			this.resourceUri = vscode.Uri.file(fileComplexity.filePath);
		} else if (contextValue === 'function' && filePath && line) {
			this.command = {
				command: 'vscode.open',
				title: 'Open Function',
				arguments: [
					vscode.Uri.file(filePath),
					{ selection: new vscode.Range(line - 1, 0, line - 1, 0) }
				]
			};
			this.resourceUri = vscode.Uri.file(filePath);
		}

		// Set tooltip
		if (contextValue === 'file' && fileComplexity) {
			this.tooltip = new vscode.MarkdownString(
				`**Complexity Analysis**\n\n` +
				`**Score:** ${fileComplexity.complexityScore}/100\n\n` +
				`**Metrics:**\n` +
				`- Lines of Code: ${fileComplexity.totalLines}\n` +
				`- Functions: ${fileComplexity.functions.length}\n` +
				`- Avg Cyclomatic: ${fileComplexity.averageCyclomaticComplexity.toFixed(1)}\n` +
				`- Avg Cognitive: ${fileComplexity.averageCognitiveComplexity.toFixed(1)}\n` +
				`- Maintainability: ${fileComplexity.maintainabilityIndex.toFixed(1)}/100\n\n` +
				`Click to open file`
			);
		} else if (contextValue === 'function') {
			this.tooltip = `Click to view function in file`;
		}
	}
}
