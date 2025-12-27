import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ComplexityHeatmapData, FileComplexity } from './types';

export class ComplexityHeatmapGenerator {
	private outputChannel: vscode.OutputChannel;
	private reportsPath: string;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Complexity Heatmap');
		
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

	async generateHeatmap(data: ComplexityHeatmapData): Promise<string> {
		const htmlContent = this.generateHTML(data);
		const fileName = this.generateReportFileName();
		const reportPath = path.join(this.reportsPath, fileName);
		
		fs.writeFileSync(reportPath, htmlContent, 'utf8');
		
		this.outputChannel.appendLine(`📊 Complexity heatmap generated: ${reportPath}`);
		return reportPath;
	}

	private generateHTML(data: ComplexityHeatmapData): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complexity Heatmap</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    ${this.getStyles()}
</head>
<body>
    <div class="container">
        ${this.generateHeader(data)}
        ${this.generateSummary(data)}
        ${this.generateCharts(data)}
        ${this.generateHeatmapGrid(data)}
        ${this.generateFilesList(data)}
        ${this.generateFooter()}
    </div>
    ${this.generateScripts(data)}
</body>
</html>`;
	}

	private generateHeader(data: ComplexityHeatmapData): string {
		return `
		<header class="report-header">
			<div class="header-content">
				<h1>📊 Complexity Heatmap</h1>
				<h2>Code Complexity Analysis</h2>
				<p class="timestamp">Generated on ${data.timestamp.toLocaleString()}</p>
			</div>
		</header>`;
	}

	private generateSummary(data: ComplexityHeatmapData): string {
		const complexityLevel = this.getComplexityLevel(data.averageComplexity);
		const complexityClass = complexityLevel.toLowerCase();

		return `
		<section class="summary-section">
			<div class="summary-grid">
				<div class="summary-card">
					<h3>📁 Total Files</h3>
					<div class="count">${data.totalFiles}</div>
				</div>
				<div class="summary-card">
					<h3>📊 Average Complexity</h3>
					<div class="count ${complexityClass}">${data.averageComplexity}/100</div>
				</div>
				<div class="summary-card">
					<h3>⏱️ Scan Duration</h3>
					<div class="count">${(data.scanDuration / 1000).toFixed(2)}s</div>
				</div>
				<div class="summary-card">
					<h3>🎯 Complexity Level</h3>
					<div class="level ${complexityClass}">${complexityLevel}</div>
				</div>
			</div>
			
			<div class="complexity-breakdown">
				<div class="breakdown-item high">
					<div class="breakdown-icon">🔴</div>
					<div class="breakdown-label">High Complexity</div>
					<div class="breakdown-count">${data.highComplexityFiles}</div>
					<div class="breakdown-desc">Score > 70</div>
				</div>
				<div class="breakdown-item medium">
					<div class="breakdown-icon">🟡</div>
					<div class="breakdown-label">Medium Complexity</div>
					<div class="breakdown-count">${data.mediumComplexityFiles}</div>
					<div class="breakdown-desc">Score 40-70</div>
				</div>
				<div class="breakdown-item low">
					<div class="breakdown-icon">🟢</div>
					<div class="breakdown-label">Low Complexity</div>
					<div class="breakdown-count">${data.lowComplexityFiles}</div>
					<div class="breakdown-desc">Score < 40</div>
				</div>
			</div>
			
			${data.mostComplexFile ? `
			<div class="most-complex-alert">
				<strong>⚠️ Most Complex File:</strong> 
				<span class="file-name">${data.mostComplexFile.relativePath}</span>
				<span class="complexity-badge high">${data.mostComplexFile.complexityScore}/100</span>
			</div>
			` : ''}
		</section>`;
	}

	private generateCharts(data: ComplexityHeatmapData): string {
		return `
		<section class="charts-section">
			<h2>📈 Complexity Distribution</h2>
			<div class="charts-grid">
				<div class="chart-container">
					<h3>Complexity by Category</h3>
					<canvas id="categoryChart"></canvas>
				</div>
				<div class="chart-container">
					<h3>Top 10 Most Complex Files</h3>
					<canvas id="topFilesChart"></canvas>
				</div>
			</div>
		</section>`;
	}

	private generateHeatmapGrid(data: ComplexityHeatmapData): string {
		const files = [...data.files].sort((a, b) => b.complexityScore - a.complexityScore);
		
		return `
		<section class="heatmap-section">
			<h2>🗺️ Complexity Heatmap</h2>
			<div class="heatmap-legend">
				<span class="legend-item"><span class="color-box low"></span> Low (0-40)</span>
				<span class="legend-item"><span class="color-box medium"></span> Medium (40-70)</span>
				<span class="legend-item"><span class="color-box high"></span> High (70-100)</span>
			</div>
			<div class="heatmap-grid">
				${files.map(file => this.generateHeatmapCell(file)).join('')}
			</div>
		</section>`;
	}

	private generateHeatmapCell(file: FileComplexity): string {
		const complexityClass = this.getComplexityClass(file.complexityScore);
		const fileName = file.relativePath.split('/').pop() || file.relativePath;
		
		return `
		<div class="heatmap-cell ${complexityClass}" 
		     data-file="${file.relativePath}"
		     data-score="${file.complexityScore}"
		     title="${file.relativePath} - Complexity: ${file.complexityScore}/100">
			<div class="cell-name">${fileName}</div>
			<div class="cell-score">${file.complexityScore}</div>
		</div>`;
	}

	private generateFilesList(data: ComplexityHeatmapData): string {
		const sortedFiles = [...data.files].sort((a, b) => b.complexityScore - a.complexityScore);
		
		return `
		<section class="files-section">
			<h2>📋 Detailed File Analysis</h2>
			<div class="files-list">
				${sortedFiles.map(file => this.generateFileCard(file)).join('')}
			</div>
		</section>`;
	}

	private generateFileCard(file: FileComplexity): string {
		const complexityClass = this.getComplexityClass(file.complexityScore);
		const topFunctions = [...file.functions]
			.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity)
			.slice(0, 5);

		return `
		<div class="file-card ${complexityClass}">
			<div class="file-header">
				<div class="file-info">
					<h3 class="file-path">${file.relativePath}</h3>
					<div class="file-stats">
						<span>📝 ${file.totalLines} lines</span>
						<span>⚙️ ${file.functions.length} functions</span>
						<span>📊 ${file.codeLines} code / ${file.commentLines} comments</span>
					</div>
				</div>
				<div class="file-score-badge ${complexityClass}">
					<div class="score-number">${file.complexityScore}</div>
					<div class="score-label">Complexity</div>
				</div>
			</div>
			
			<div class="file-metrics">
				<div class="metric">
					<span class="metric-label">Avg Cyclomatic:</span>
					<span class="metric-value">${file.averageCyclomaticComplexity.toFixed(1)}</span>
				</div>
				<div class="metric">
					<span class="metric-label">Max Cyclomatic:</span>
					<span class="metric-value">${file.maxCyclomaticComplexity}</span>
				</div>
				<div class="metric">
					<span class="metric-label">Avg Cognitive:</span>
					<span class="metric-value">${file.averageCognitiveComplexity.toFixed(1)}</span>
				</div>
				<div class="metric">
					<span class="metric-label">Max Nested Depth:</span>
					<span class="metric-value">${file.maxNestedDepth}</span>
				</div>
				<div class="metric">
					<span class="metric-label">Maintainability:</span>
					<span class="metric-value">${file.maintainabilityIndex.toFixed(0)}%</span>
				</div>
			</div>
			
			${topFunctions.length > 0 ? `
			<div class="file-functions">
				<h4>Most Complex Functions:</h4>
				<div class="functions-list">
					${topFunctions.map(func => `
						<div class="function-item">
							<span class="function-name">${func.name}()</span>
							<span class="function-line">Line ${func.line}</span>
							<span class="function-complexity">CC: ${func.cyclomaticComplexity}</span>
						</div>
					`).join('')}
				</div>
			</div>
			` : ''}
		</div>`;
	}

	private generateFooter(): string {
		return `
		<footer class="report-footer">
			<p>Generated by <strong>What-The-Code</strong> Complexity Analyzer</p>
			<p class="disclaimer">
				Complexity metrics are calculated using cyclomatic complexity, cognitive complexity, 
				and maintainability index formulas. Use this as a guide for refactoring priorities.
			</p>
		</footer>`;
	}

	private generateScripts(data: ComplexityHeatmapData): string {
		const categoryData = {
			labels: ['Low Complexity', 'Medium Complexity', 'High Complexity'],
			data: [data.lowComplexityFiles, data.mediumComplexityFiles, data.highComplexityFiles]
		};

		const topFiles = [...data.files]
			.sort((a, b) => b.complexityScore - a.complexityScore)
			.slice(0, 10)
			.map(f => ({
				label: f.relativePath.split('/').pop() || f.relativePath,
				score: f.complexityScore
			}));

		return `
		<script>
			// Category Chart
			const categoryCtx = document.getElementById('categoryChart').getContext('2d');
			new Chart(categoryCtx, {
				type: 'doughnut',
				data: {
					labels: ${JSON.stringify(categoryData.labels)},
					datasets: [{
						data: ${JSON.stringify(categoryData.data)},
						backgroundColor: [
							'rgba(76, 175, 80, 0.8)',
							'rgba(255, 193, 7, 0.8)',
							'rgba(244, 67, 54, 0.8)'
						],
						borderColor: [
							'rgba(76, 175, 80, 1)',
							'rgba(255, 193, 7, 1)',
							'rgba(244, 67, 54, 1)'
						],
						borderWidth: 2
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: true,
					plugins: {
						legend: {
							position: 'bottom',
							labels: {
								font: {
									size: 14
								}
							}
						}
					}
				}
			});

			// Top Files Chart
			const topFilesCtx = document.getElementById('topFilesChart').getContext('2d');
			new Chart(topFilesCtx, {
				type: 'bar',
				data: {
					labels: ${JSON.stringify(topFiles.map(f => f.label))},
					datasets: [{
						label: 'Complexity Score',
						data: ${JSON.stringify(topFiles.map(f => f.score))},
						backgroundColor: ${JSON.stringify(topFiles.map(f => 
							f.score > 70 ? 'rgba(244, 67, 54, 0.8)' : 
							f.score >= 40 ? 'rgba(255, 193, 7, 0.8)' : 
							'rgba(76, 175, 80, 0.8)'
						))},
						borderColor: ${JSON.stringify(topFiles.map(f => 
							f.score > 70 ? 'rgba(244, 67, 54, 1)' : 
							f.score >= 40 ? 'rgba(255, 193, 7, 1)' : 
							'rgba(76, 175, 80, 1)'
						))},
						borderWidth: 2
					}]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: true,
					plugins: {
						legend: {
							display: false
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							max: 100,
							title: {
								display: true,
								text: 'Complexity Score'
							}
						}
					}
				}
			});

			// Heatmap cell click handlers
			document.querySelectorAll('.heatmap-cell').forEach(cell => {
				cell.addEventListener('click', function() {
					const fileName = this.dataset.file;
					const score = this.dataset.score;
					alert('File: ' + fileName + '\\nComplexity Score: ' + score + '/100');
				});
			});
		</script>`;
	}

	private getComplexityLevel(score: number): string {
		if (score > 70) {
			return 'HIGH';
		}
		if (score >= 40) {
			return 'MEDIUM';
		}
		return 'LOW';
	}

	private getComplexityClass(score: number): string {
		if (score > 70) {
			return 'high';
		}
		if (score >= 40) {
			return 'medium';
		}
		return 'low';
	}

	private generateReportFileName(): string {
		const now = new Date();
		const dateStr = now.toISOString().split('T')[0];
		const timeStr = now.toTimeString().split(' ')[0].substring(0, 5).replace(':', '-');
		return `Complexity_Heatmap_${dateStr}_${timeStr}.html`;
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
				max-width: 1600px;
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
			
			.summary-section, .charts-section, .heatmap-section, .files-section {
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
				margin-bottom: 30px;
			}
			
			.summary-card {
				background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
				padding: 25px;
				border-radius: 12px;
				text-align: center;
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
			
			.count.high, .level.high {
				color: #f44336;
			}
			
			.count.medium, .level.medium {
				color: #ff9800;
			}
			
			.count.low, .level.low {
				color: #4caf50;
			}
			
			.level {
				font-size: 2rem;
				font-weight: bold;
				padding: 10px;
				border-radius: 8px;
			}
			
			.complexity-breakdown {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 20px;
				margin-bottom: 20px;
			}
			
			.breakdown-item {
				padding: 20px;
				border-radius: 12px;
				text-align: center;
				border: 3px solid;
			}
			
			.breakdown-item.high {
				background: #ffebee;
				border-color: #f44336;
			}
			
			.breakdown-item.medium {
				background: #fff3e0;
				border-color: #ff9800;
			}
			
			.breakdown-item.low {
				background: #e8f5e9;
				border-color: #4caf50;
			}
			
			.breakdown-icon {
				font-size: 2.5rem;
				margin-bottom: 10px;
			}
			
			.breakdown-label {
				font-weight: bold;
				margin-bottom: 10px;
			}
			
			.breakdown-count {
				font-size: 2rem;
				font-weight: bold;
				margin-bottom: 5px;
			}
			
			.breakdown-desc {
				font-size: 0.9rem;
				opacity: 0.8;
			}
			
			.most-complex-alert {
				background: #fff3e0;
				border: 2px solid #ff9800;
				border-radius: 8px;
				padding: 15px;
				text-align: center;
			}
			
			.file-name {
				font-family: 'Consolas', monospace;
				margin: 0 10px;
			}
			
			.complexity-badge {
				padding: 5px 12px;
				border-radius: 20px;
				font-weight: bold;
				color: white;
			}
			
			.complexity-badge.high {
				background: #f44336;
			}
			
			.charts-section h2, .heatmap-section h2, .files-section h2 {
				margin-bottom: 25px;
				color: #333;
			}
			
			.charts-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
				gap: 30px;
			}
			
			.chart-container {
				background: white;
				padding: 20px;
				border-radius: 12px;
				box-shadow: 0 4px 15px rgba(0,0,0,0.1);
			}
			
			.chart-container h3 {
				margin-bottom: 20px;
				text-align: center;
				color: #666;
			}
			
			canvas {
				max-height: 300px;
			}
			
			.heatmap-legend {
				display: flex;
				justify-content: center;
				gap: 30px;
				margin-bottom: 20px;
				font-size: 0.9rem;
			}
			
			.legend-item {
				display: flex;
				align-items: center;
				gap: 8px;
			}
			
			.color-box {
				width: 20px;
				height: 20px;
				border-radius: 4px;
				border: 2px solid rgba(0,0,0,0.2);
			}
			
			.color-box.low {
				background: #4caf50;
			}
			
			.color-box.medium {
				background: #ff9800;
			}
			
			.color-box.high {
				background: #f44336;
			}
			
			.heatmap-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
				gap: 10px;
			}
			
			.heatmap-cell {
				aspect-ratio: 1;
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				border-radius: 8px;
				cursor: pointer;
				transition: all 0.3s ease;
				padding: 10px;
				border: 2px solid rgba(0,0,0,0.1);
			}
			
			.heatmap-cell:hover {
				transform: scale(1.05);
				box-shadow: 0 6px 20px rgba(0,0,0,0.2);
				z-index: 10;
			}
			
			.heatmap-cell.low {
				background: linear-gradient(135deg, #4caf50, #66bb6a);
				color: white;
			}
			
			.heatmap-cell.medium {
				background: linear-gradient(135deg, #ff9800, #ffa726);
				color: white;
			}
			
			.heatmap-cell.high {
				background: linear-gradient(135deg, #f44336, #e57373);
				color: white;
			}
			
			.cell-name {
				font-size: 0.75rem;
				text-align: center;
				margin-bottom: 5px;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				max-width: 100%;
			}
			
			.cell-score {
				font-size: 1.2rem;
				font-weight: bold;
			}
			
			.files-list {
				display: flex;
				flex-direction: column;
				gap: 20px;
			}
			
			.file-card {
				background: white;
				border-radius: 12px;
				padding: 25px;
				border-left: 5px solid;
				box-shadow: 0 4px 15px rgba(0,0,0,0.1);
				transition: all 0.3s ease;
			}
			
			.file-card:hover {
				transform: translateX(5px);
				box-shadow: 0 6px 20px rgba(0,0,0,0.15);
			}
			
			.file-card.low {
				border-color: #4caf50;
			}
			
			.file-card.medium {
				border-color: #ff9800;
			}
			
			.file-card.high {
				border-color: #f44336;
			}
			
			.file-header {
				display: flex;
				justify-content: space-between;
				align-items: start;
				margin-bottom: 20px;
			}
			
			.file-path {
				color: #333;
				font-size: 1.1rem;
				margin-bottom: 10px;
				font-family: 'Consolas', monospace;
			}
			
			.file-stats {
				display: flex;
				gap: 15px;
				flex-wrap: wrap;
				font-size: 0.9rem;
				color: #666;
			}
			
			.file-score-badge {
				text-align: center;
				padding: 15px 20px;
				border-radius: 12px;
				min-width: 100px;
			}
			
			.file-score-badge.low {
				background: #e8f5e9;
				color: #2e7d32;
			}
			
			.file-score-badge.medium {
				background: #fff3e0;
				color: #ef6c00;
			}
			
			.file-score-badge.high {
				background: #ffebee;
				color: #c62828;
			}
			
			.score-number {
				font-size: 2rem;
				font-weight: bold;
			}
			
			.score-label {
				font-size: 0.8rem;
				opacity: 0.8;
			}
			
			.file-metrics {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
				gap: 15px;
				margin-bottom: 20px;
			}
			
			.metric {
				display: flex;
				justify-content: space-between;
				padding: 10px;
				background: #f5f5f5;
				border-radius: 6px;
			}
			
			.metric-label {
				color: #666;
			}
			
			.metric-value {
				font-weight: bold;
				color: #333;
			}
			
			.file-functions {
				margin-top: 20px;
				padding-top: 20px;
				border-top: 1px solid #e0e0e0;
			}
			
			.file-functions h4 {
				margin-bottom: 15px;
				color: #666;
			}
			
			.functions-list {
				display: flex;
				flex-direction: column;
				gap: 10px;
			}
			
			.function-item {
				display: flex;
				align-items: center;
				gap: 15px;
				padding: 10px;
				background: #f5f5f5;
				border-radius: 6px;
				font-family: 'Consolas', monospace;
				font-size: 0.9rem;
			}
			
			.function-name {
				flex: 1;
				color: #333;
				font-weight: bold;
			}
			
			.function-line {
				color: #666;
			}
			
			.function-complexity {
				color: #f44336;
				font-weight: bold;
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
				.summary-grid, .charts-grid, .complexity-breakdown, .file-metrics {
					grid-template-columns: 1fr;
				}
				
				.heatmap-grid {
					grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
				}
			}
		</style>`;
	}

	async openHeatmap(reportPath: string): Promise<void> {
		try {
			const uri = vscode.Uri.file(reportPath);
			await vscode.env.openExternal(uri);
			this.outputChannel.appendLine(`📖 Opened complexity heatmap: ${reportPath}`);
		} catch (error) {
			this.outputChannel.appendLine(`❌ Failed to open heatmap: ${error}`);
			vscode.window.showErrorMessage(`Failed to open complexity heatmap: ${error}`);
		}
	}

	getReportsPath(): string {
		return this.reportsPath;
	}

	dispose(): void {
		this.outputChannel.dispose();
	}
}
