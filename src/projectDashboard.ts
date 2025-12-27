import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityScanResult } from './types';
import { ComplexityHeatmapData } from './types';

interface DashboardData {
	projectName: string;
	timestamp: Date;
	security?: SecurityScanResult;
	complexity?: ComplexityHeatmapData;
	overallGrade: string;
	overallScore: number;
	criticalIssues: Array<{
		type: string;
		file: string;
		severity: string;
		message: string;
	}>;
}

export class ProjectDashboardGenerator {
	private outputChannel: vscode.OutputChannel;
	private reportsPath: string;

	constructor() {
		this.outputChannel = vscode.window.createOutputChannel('Project Dashboard');
		
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

	async generateDashboard(
		security?: SecurityScanResult,
		complexity?: ComplexityHeatmapData
	): Promise<string> {
		const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
		const projectName = workspaceFolder ? path.basename(workspaceFolder.uri.fsPath) : 'Unknown Project';

		const data = this.prepareDashboardData(projectName, security, complexity);
		const htmlContent = this.generateHTML(data);
		const fileName = 'Project_Dashboard.html';
		const reportPath = path.join(this.reportsPath, fileName);
		
		fs.writeFileSync(reportPath, htmlContent, 'utf8');
		
		this.outputChannel.appendLine(`📊 Project dashboard generated: ${reportPath}`);
		return reportPath;
	}

	private prepareDashboardData(
		projectName: string,
		security?: SecurityScanResult,
		complexity?: ComplexityHeatmapData
	): DashboardData {
		const criticalIssues: Array<{
			type: string;
			file: string;
			severity: string;
			message: string;
		}> = [];

		// Collect critical security issues
		if (security) {
			security.issues
				.filter(issue => issue.severity === 'critical' || issue.severity === 'high')
				.slice(0, 5)
				.forEach(issue => {
					criticalIssues.push({
						type: 'Security',
						file: issue.filePath,
						severity: issue.severity,
						message: issue.message
					});
				});
		}

		// Collect high complexity files
		if (complexity) {
			complexity.files
				.filter(file => file.complexityScore > 70)
				.slice(0, 5)
				.forEach(file => {
					criticalIssues.push({
						type: 'Complexity',
						file: file.relativePath,
						severity: 'high',
						message: `Complexity score: ${file.complexityScore}/100`
					});
				});
		}

		const { overallGrade, overallScore } = this.calculateOverallHealth(security, complexity);

		return {
			projectName,
			timestamp: new Date(),
			security,
			complexity,
			overallGrade,
			overallScore,
			criticalIssues
		};
	}

	private calculateOverallHealth(
		security?: SecurityScanResult,
		complexity?: ComplexityHeatmapData
	): { overallGrade: string; overallScore: number } {
		let score = 100;

		// Security penalties
		if (security) {
			score -= security.criticalCount * 20;
			score -= security.highCount * 10;
			score -= security.mediumCount * 5;
			score -= security.lowCount * 1;
		}

		// Complexity penalties
		if (complexity) {
			const avgComplexity = complexity.averageComplexity;
			if (avgComplexity > 70) {
				score -= 30;
			} else if (avgComplexity > 50) {
				score -= 15;
			} else if (avgComplexity > 30) {
				score -= 5;
			}

			score -= complexity.highComplexityFiles * 2;
		}

		score = Math.max(0, Math.min(100, score));

		let grade = 'F';
		if (score >= 90) grade = 'A+';
		else if (score >= 85) grade = 'A';
		else if (score >= 80) grade = 'A-';
		else if (score >= 75) grade = 'B+';
		else if (score >= 70) grade = 'B';
		else if (score >= 65) grade = 'B-';
		else if (score >= 60) grade = 'C+';
		else if (score >= 55) grade = 'C';
		else if (score >= 50) grade = 'C-';
		else if (score >= 45) grade = 'D';

		return { overallGrade: grade, overallScore: Math.round(score) };
	}

	private generateHTML(data: DashboardData): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.projectName} - Project Health Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    ${this.getStyles()}
</head>
<body>
    ${this.generateAnimatedBackground()}
    <div class="container">
        ${this.generateHeader(data)}
        ${this.generateOverallHealth(data)}
        ${this.generateMetricsGrid(data)}
        ${this.generateCriticalIssues(data)}
        ${this.generateChartsSection(data)}
        ${this.generateQuickWins(data)}
        ${this.generateFooter()}
    </div>
    ${this.generateScripts(data)}
</body>
</html>`;
	}

	private generateAnimatedBackground(): string {
		return `
		<div class="animated-background">
			<div class="gradient-orb orb-1"></div>
			<div class="gradient-orb orb-2"></div>
			<div class="gradient-orb orb-3"></div>
		</div>`;
	}

	private generateHeader(data: DashboardData): string {
		return `
		<header class="dashboard-header">
			<div class="header-content">
				<div class="header-icon">🚀</div>
				<h1 class="project-name">${this.escapeHtml(data.projectName)}</h1>
				<p class="tagline">Project Health Dashboard</p>
				<p class="timestamp">${data.timestamp.toLocaleString()}</p>
			</div>
		</header>`;
	}

	private generateOverallHealth(data: DashboardData): string {
		const gradeClass = this.getGradeClass(data.overallGrade);
		const gradeEmoji = this.getGradeEmoji(data.overallGrade);

		return `
		<section class="overall-health">
			<div class="health-card">
				<div class="health-icon">${gradeEmoji}</div>
				<div class="health-content">
					<h2>Overall Health Score</h2>
					<div class="health-score">
						<div class="score-circle ${gradeClass}">
							<div class="score-inner">
								<div class="grade">${data.overallGrade}</div>
								<div class="score">${data.overallScore}/100</div>
							</div>
						</div>
					</div>
					<p class="health-message">${this.getHealthMessage(data.overallScore)}</p>
				</div>
			</div>
		</section>`;
	}

	private generateMetricsGrid(data: DashboardData): string {
		return `
		<section class="metrics-grid">
			${this.generateSecurityMetric(data)}
			${this.generateComplexityMetric(data)}
			${this.generateFilesMetric(data)}
			${this.generateIssuesMetric(data)}
		</section>`;
	}

	private generateSecurityMetric(data: DashboardData): string {
		if (!data.security) {
			return `
			<div class="metric-card glass-card">
				<div class="metric-icon security">🛡️</div>
				<h3>Security</h3>
				<div class="metric-value">—</div>
				<p class="metric-label">Not Scanned</p>
				<div class="metric-footer">Run security scan</div>
			</div>`;
		}

		const totalIssues = data.security.totalIssues;
		const status = totalIssues === 0 ? 'Clean' : `${totalIssues} Issues`;
		const statusClass = totalIssues === 0 ? 'good' : totalIssues > 10 ? 'critical' : 'warning';

		return `
		<div class="metric-card glass-card ${statusClass}">
			<div class="metric-icon security">🛡️</div>
			<h3>Security</h3>
			<div class="metric-value">${totalIssues}</div>
			<p class="metric-label">${status}</p>
			<div class="metric-footer">
				<span class="badge critical">${data.security.criticalCount} Critical</span>
				<span class="badge high">${data.security.highCount} High</span>
			</div>
		</div>`;
	}

	private generateComplexityMetric(data: DashboardData): string {
		if (!data.complexity) {
			return `
			<div class="metric-card glass-card">
				<div class="metric-icon complexity">📊</div>
				<h3>Complexity</h3>
				<div class="metric-value">—</div>
				<p class="metric-label">Not Analyzed</p>
				<div class="metric-footer">Run complexity analysis</div>
			</div>`;
		}

		const avgComplexity = data.complexity.averageComplexity;
		const statusClass = avgComplexity < 40 ? 'good' : avgComplexity < 70 ? 'warning' : 'critical';
		const level = avgComplexity < 40 ? 'Low' : avgComplexity < 70 ? 'Medium' : 'High';

		return `
		<div class="metric-card glass-card ${statusClass}">
			<div class="metric-icon complexity">📊</div>
			<h3>Complexity</h3>
			<div class="metric-value">${avgComplexity}</div>
			<p class="metric-label">${level} / 100</p>
			<div class="metric-footer">
				<span class="badge high">${data.complexity.highComplexityFiles} High-Risk</span>
				<span class="badge medium">${data.complexity.mediumComplexityFiles} Medium</span>
			</div>
		</div>`;
	}

	private generateFilesMetric(data: DashboardData): string {
		const filesScanned = (data.security?.filesScanned || 0) + (data.complexity?.totalFiles || 0);
		const uniqueFiles = Math.max(data.security?.filesScanned || 0, data.complexity?.totalFiles || 0);

		return `
		<div class="metric-card glass-card good">
			<div class="metric-icon files">📁</div>
			<h3>Files Analyzed</h3>
			<div class="metric-value">${uniqueFiles}</div>
			<p class="metric-label">Scanned Files</p>
			<div class="metric-footer">Comprehensive coverage</div>
		</div>`;
	}

	private generateIssuesMetric(data: DashboardData): string {
		const totalIssues = data.criticalIssues.length;
		const securityIssues = data.criticalIssues.filter(i => i.type === 'Security').length;
		const complexityIssues = data.criticalIssues.filter(i => i.type === 'Complexity').length;

		return `
		<div class="metric-card glass-card ${totalIssues > 0 ? 'warning' : 'good'}">
			<div class="metric-icon issues">⚠️</div>
			<h3>Critical Issues</h3>
			<div class="metric-value">${totalIssues}</div>
			<p class="metric-label">Need Attention</p>
			<div class="metric-footer">
				${securityIssues > 0 ? `<span class="badge security">${securityIssues} Security</span>` : ''}
				${complexityIssues > 0 ? `<span class="badge complexity">${complexityIssues} Complex</span>` : ''}
			</div>
		</div>`;
	}

	private generateCriticalIssues(data: DashboardData): string {
		if (data.criticalIssues.length === 0) {
			return `
			<section class="critical-issues glass-section">
				<h2>🎉 No Critical Issues</h2>
				<p class="no-issues-message">Excellent! Your project is in great shape.</p>
			</section>`;
		}

		const issuesHTML = data.criticalIssues.map(issue => `
			<div class="issue-item ${issue.severity}">
				<div class="issue-header">
					<span class="issue-type ${issue.type.toLowerCase()}">${issue.type}</span>
					<span class="issue-severity">${issue.severity.toUpperCase()}</span>
				</div>
				<div class="issue-file">${this.escapeHtml(issue.file)}</div>
				<div class="issue-message">${this.escapeHtml(issue.message)}</div>
			</div>
		`).join('');

		return `
		<section class="critical-issues glass-section">
			<h2>⚠️ Critical Issues (${data.criticalIssues.length})</h2>
			<div class="issues-container">
				${issuesHTML}
			</div>
		</section>`;
	}

	private generateChartsSection(data: DashboardData): string {
		return `
		<section class="charts-section">
			<div class="chart-container glass-card">
				<h3>📊 Security Overview</h3>
				<canvas id="securityChart"></canvas>
			</div>
			<div class="chart-container glass-card">
				<h3>📈 Complexity Distribution</h3>
				<canvas id="complexityChart"></canvas>
			</div>
		</section>`;
	}

	private generateQuickWins(data: DashboardData): string {
		const wins: string[] = [];

		if (data.security && data.security.lowCount > 0) {
			wins.push(`Fix ${data.security.lowCount} low-severity security issues for quick improvements`);
		}

		if (data.complexity && data.complexity.mediumComplexityFiles > 0) {
			wins.push(`Refactor ${Math.min(3, data.complexity.mediumComplexityFiles)} medium-complexity files`);
		}

		if (wins.length === 0) {
			wins.push('Keep maintaining code quality standards');
			wins.push('Add more comprehensive tests');
			wins.push('Document complex functions');
		}

		const winsHTML = wins.map((win, idx) => `
			<div class="quick-win-item">
				<div class="win-number">${idx + 1}</div>
				<div class="win-text">${win}</div>
			</div>
		`).join('');

		return `
		<section class="quick-wins glass-section">
			<h2>💡 Quick Wins</h2>
			<div class="wins-container">
				${winsHTML}
			</div>
		</section>`;
	}

	private generateFooter(): string {
		return `
		<footer class="dashboard-footer">
			<p>Generated by <strong>TraceMap</strong> • Your Code Quality Companion</p>
			<p class="footer-note">Keep building amazing things! 🚀</p>
		</footer>`;
	}

	private generateScripts(data: DashboardData): string {
		return `
		<script>
			// Security Chart
			const securityCtx = document.getElementById('securityChart');
			if (securityCtx) {
				new Chart(securityCtx, {
					type: 'doughnut',
					data: {
						labels: ['Critical', 'High', 'Medium', 'Low'],
						datasets: [{
							data: [
								${data.security?.criticalCount || 0},
								${data.security?.highCount || 0},
								${data.security?.mediumCount || 0},
								${data.security?.lowCount || 0}
							],
							backgroundColor: [
								'rgba(239, 68, 68, 0.8)',
								'rgba(249, 115, 22, 0.8)',
								'rgba(234, 179, 8, 0.8)',
								'rgba(59, 130, 246, 0.8)'
							],
							borderWidth: 0
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: true,
						plugins: {
							legend: {
								position: 'bottom',
								labels: { color: '#fff', font: { size: 14 } }
							}
						}
					}
				});
			}

			// Complexity Chart
			const complexityCtx = document.getElementById('complexityChart');
			if (complexityCtx) {
				new Chart(complexityCtx, {
					type: 'bar',
					data: {
						labels: ['High (>70)', 'Medium (40-70)', 'Low (<40)'],
						datasets: [{
							label: 'Files',
							data: [
								${data.complexity?.highComplexityFiles || 0},
								${data.complexity?.mediumComplexityFiles || 0},
								${data.complexity?.lowComplexityFiles || 0}
							],
							backgroundColor: [
								'rgba(239, 68, 68, 0.8)',
								'rgba(234, 179, 8, 0.8)',
								'rgba(34, 197, 94, 0.8)'
							],
							borderRadius: 8,
							borderWidth: 0
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: true,
						scales: {
							y: {
								beginAtZero: true,
								ticks: { color: '#fff' },
								grid: { color: 'rgba(255, 255, 255, 0.1)' }
							},
							x: {
								ticks: { color: '#fff' },
								grid: { display: false }
							}
						},
						plugins: {
							legend: { display: false }
						}
					}
				});
			}
		</script>`;
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
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
				min-height: 100vh;
				background: #0a0e27;
				color: #fff;
				overflow-x: hidden;
				position: relative;
			}

			.animated-background {
				position: fixed;
				top: 0;
				left: 0;
				width: 100%;
				height: 100%;
				overflow: hidden;
				z-index: 0;
			}

			.gradient-orb {
				position: absolute;
				border-radius: 50%;
				filter: blur(80px);
				opacity: 0.6;
				animation: float 20s infinite ease-in-out;
			}

			.orb-1 {
				width: 500px;
				height: 500px;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				top: -10%;
				left: -10%;
				animation-delay: 0s;
			}

			.orb-2 {
				width: 400px;
				height: 400px;
				background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
				bottom: -10%;
				right: -10%;
				animation-delay: 5s;
			}

			.orb-3 {
				width: 450px;
				height: 450px;
				background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				animation-delay: 10s;
			}

			@keyframes float {
				0%, 100% { transform: translate(0, 0) rotate(0deg); }
				25% { transform: translate(50px, -50px) rotate(90deg); }
				50% { transform: translate(0, -100px) rotate(180deg); }
				75% { transform: translate(-50px, -50px) rotate(270deg); }
			}

			.container {
				position: relative;
				z-index: 1;
				max-width: 1400px;
				margin: 0 auto;
				padding: 40px 20px;
			}

			.glass-card, .glass-section {
				background: rgba(255, 255, 255, 0.05);
				backdrop-filter: blur(20px);
				border-radius: 20px;
				border: 1px solid rgba(255, 255, 255, 0.1);
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
			}

			.dashboard-header {
				text-align: center;
				margin-bottom: 50px;
				animation: fadeInDown 0.8s ease-out;
			}

			@keyframes fadeInDown {
				from {
					opacity: 0;
					transform: translateY(-30px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.header-content {
				background: rgba(255, 255, 255, 0.05);
				backdrop-filter: blur(20px);
				border-radius: 25px;
				padding: 50px 40px;
				border: 1px solid rgba(255, 255, 255, 0.1);
			}

			.header-icon {
				font-size: 4rem;
				margin-bottom: 20px;
				animation: pulse 2s infinite;
			}

			@keyframes pulse {
				0%, 100% { transform: scale(1); }
				50% { transform: scale(1.1); }
			}

			.project-name {
				font-size: 3rem;
				font-weight: 700;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
				-webkit-background-clip: text;
				-webkit-text-fill-color: transparent;
				background-clip: text;
				margin-bottom: 10px;
			}

			.tagline {
				font-size: 1.2rem;
				opacity: 0.8;
				margin-bottom: 15px;
			}

			.timestamp {
				opacity: 0.6;
				font-size: 0.9rem;
			}

			.overall-health {
				margin-bottom: 50px;
				animation: fadeInUp 0.8s ease-out 0.2s both;
			}

			@keyframes fadeInUp {
				from {
					opacity: 0;
					transform: translateY(30px);
				}
				to {
					opacity: 1;
					transform: translateY(0);
				}
			}

			.health-card {
				background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
				backdrop-filter: blur(20px);
				border-radius: 30px;
				padding: 60px;
				text-align: center;
				border: 2px solid rgba(255, 255, 255, 0.1);
				position: relative;
				overflow: hidden;
			}

			.health-card::before {
				content: '';
				position: absolute;
				top: -50%;
				left: -50%;
				width: 200%;
				height: 200%;
				background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.05), transparent);
				transform: rotate(45deg);
				animation: shimmer 3s infinite;
			}

			@keyframes shimmer {
				0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
				100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
			}

			.health-icon {
				font-size: 5rem;
				margin-bottom: 20px;
			}

			.health-content h2 {
				font-size: 2rem;
				margin-bottom: 30px;
				opacity: 0.9;
			}

			.score-circle {
				width: 250px;
				height: 250px;
				border-radius: 50%;
				margin: 0 auto 30px;
				display: flex;
				align-items: center;
				justify-content: center;
				position: relative;
				background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05));
				border: 3px solid rgba(255, 255, 255, 0.2);
				box-shadow: 0 0 60px rgba(102, 126, 234, 0.3);
			}

			.score-circle.grade-a, .score-circle.grade-a\\+ {
				border-color: #10b981;
				box-shadow: 0 0 60px rgba(16, 185, 129, 0.5);
			}

			.score-circle.grade-b {
				border-color: #3b82f6;
				box-shadow: 0 0 60px rgba(59, 130, 246, 0.5);
			}

			.score-circle.grade-c {
				border-color: #f59e0b;
				box-shadow: 0 0 60px rgba(245, 158, 11, 0.5);
			}

			.score-circle.grade-d, .score-circle.grade-f {
				border-color: #ef4444;
				box-shadow: 0 0 60px rgba(239, 68, 68, 0.5);
			}

			.score-inner {
				text-align: center;
			}

			.grade {
				font-size: 4rem;
				font-weight: 900;
				margin-bottom: 10px;
			}

			.score {
				font-size: 1.5rem;
				opacity: 0.8;
			}

			.health-message {
				font-size: 1.2rem;
				opacity: 0.8;
			}

			.metrics-grid {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
				gap: 30px;
				margin-bottom: 50px;
			}

			.metric-card {
				padding: 40px 30px;
				text-align: center;
				transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
				position: relative;
				overflow: hidden;
			}

			.metric-card:hover {
				transform: translateY(-10px);
				box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
			}

			.metric-card.good {
				background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(5, 150, 105, 0.15));
			}

			.metric-card.warning {
				background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(217, 119, 6, 0.15));
			}

			.metric-card.critical {
				background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.15));
			}

			.metric-icon {
				font-size: 3.5rem;
				margin-bottom: 20px;
			}

			.metric-card h3 {
				font-size: 1.1rem;
				margin-bottom: 15px;
				opacity: 0.9;
				text-transform: uppercase;
				letter-spacing: 1px;
			}

			.metric-value {
				font-size: 3.5rem;
				font-weight: 800;
				margin-bottom: 10px;
			}

			.metric-label {
				font-size: 1rem;
				opacity: 0.7;
				margin-bottom: 20px;
			}

			.metric-footer {
				display: flex;
				justify-content: center;
				gap: 10px;
				flex-wrap: wrap;
			}

			.badge {
				padding: 6px 14px;
				border-radius: 20px;
				font-size: 0.8rem;
				font-weight: 600;
			}

			.badge.critical {
				background: rgba(239, 68, 68, 0.2);
				color: #fca5a5;
			}

			.badge.high {
				background: rgba(249, 115, 22, 0.2);
				color: #fdba74;
			}

			.badge.medium {
				background: rgba(234, 179, 8, 0.2);
				color: #fde047;
			}

			.badge.security {
				background: rgba(239, 68, 68, 0.2);
				color: #fca5a5;
			}

			.badge.complexity {
				background: rgba(59, 130, 246, 0.2);
				color: #93c5fd;
			}

			.critical-issues {
				padding: 40px;
				margin-bottom: 50px;
			}

			.critical-issues h2 {
				font-size: 2rem;
				margin-bottom: 30px;
			}

			.no-issues-message {
				font-size: 1.2rem;
				opacity: 0.8;
				text-align: center;
				padding: 40px;
			}

			.issues-container {
				display: grid;
				gap: 20px;
			}

			.issue-item {
				background: rgba(255, 255, 255, 0.03);
				border-left: 4px solid;
				padding: 20px;
				border-radius: 12px;
				transition: all 0.3s;
			}

			.issue-item:hover {
				background: rgba(255, 255, 255, 0.08);
				transform: translateX(5px);
			}

			.issue-item.critical {
				border-left-color: #ef4444;
			}

			.issue-item.high {
				border-left-color: #f97316;
			}

			.issue-header {
				display: flex;
				justify-content: space-between;
				margin-bottom: 12px;
			}

			.issue-type {
				padding: 4px 12px;
				border-radius: 12px;
				font-size: 0.8rem;
				font-weight: 600;
			}

			.issue-type.security {
				background: rgba(239, 68, 68, 0.2);
				color: #fca5a5;
			}

			.issue-type.complexity {
				background: rgba(59, 130, 246, 0.2);
				color: #93c5fd;
			}

			.issue-severity {
				font-size: 0.8rem;
				font-weight: 700;
				opacity: 0.8;
			}

			.issue-file {
				font-family: 'Courier New', monospace;
				font-size: 0.9rem;
				opacity: 0.9;
				margin-bottom: 8px;
			}

			.issue-message {
				opacity: 0.7;
				font-size: 0.95rem;
			}

			.charts-section {
				display: grid;
				grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
				gap: 30px;
				margin-bottom: 50px;
			}

			.chart-container {
				padding: 40px;
			}

			.chart-container h3 {
				font-size: 1.5rem;
				margin-bottom: 30px;
				text-align: center;
			}

			.quick-wins {
				padding: 40px;
				margin-bottom: 50px;
			}

			.quick-wins h2 {
				font-size: 2rem;
				margin-bottom: 30px;
			}

			.wins-container {
				display: grid;
				gap: 20px;
			}

			.quick-win-item {
				display: flex;
				align-items: center;
				gap: 20px;
				background: rgba(255, 255, 255, 0.03);
				padding: 25px;
				border-radius: 15px;
				transition: all 0.3s;
			}

			.quick-win-item:hover {
				background: rgba(255, 255, 255, 0.08);
				transform: translateX(10px);
			}

			.win-number {
				width: 50px;
				height: 50px;
				border-radius: 50%;
				background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 1.5rem;
				font-weight: 700;
				flex-shrink: 0;
			}

			.win-text {
				font-size: 1.1rem;
				opacity: 0.9;
			}

			.dashboard-footer {
				text-align: center;
				padding: 40px 20px;
				opacity: 0.6;
			}

			.dashboard-footer p {
				margin: 5px 0;
			}

			.footer-note {
				font-size: 1.1rem;
			}

			@media (max-width: 768px) {
				.metrics-grid {
					grid-template-columns: 1fr;
				}

				.charts-section {
					grid-template-columns: 1fr;
				}

				.project-name {
					font-size: 2rem;
				}

				.score-circle {
					width: 200px;
					height: 200px;
				}

				.grade {
					font-size: 3rem;
				}
			}
		</style>`;
	}

	private getGradeClass(grade: string): string {
		if (grade.startsWith('A')) return 'grade-a';
		if (grade.startsWith('B')) return 'grade-b';
		if (grade.startsWith('C')) return 'grade-c';
		if (grade.startsWith('D')) return 'grade-d';
		return 'grade-f';
	}

	private getGradeEmoji(grade: string): string {
		if (grade.startsWith('A')) return '🌟';
		if (grade.startsWith('B')) return '👍';
		if (grade.startsWith('C')) return '😐';
		if (grade.startsWith('D')) return '😟';
		return '😱';
	}

	private getHealthMessage(score: number): string {
		if (score >= 90) return 'Outstanding! Your code is in excellent shape.';
		if (score >= 75) return 'Great work! Keep maintaining these standards.';
		if (score >= 60) return 'Good progress. Some areas need attention.';
		if (score >= 45) return 'Needs improvement. Focus on critical issues.';
		return 'Critical state. Immediate action required.';
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	async openDashboard(reportPath: string): Promise<void> {
		const uri = vscode.Uri.file(reportPath);
		await vscode.env.openExternal(uri);
	}

	getReportsPath(): string {
		return this.reportsPath;
	}
}
