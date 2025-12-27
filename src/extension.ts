import * as vscode from 'vscode';
import { CodeCollector } from './codeCollector';
import { GeminiProvider, PromptBuilder } from './aiProviders';
import { LocalSearchProvider } from './localSearchProvider';
import { SearchResult, AIProvider } from './types';
import { SearchResultsProvider } from './searchResultsProvider';
import { SnapshotProvider } from './snapshotProvider';
import { DeadCodeFinder } from './deadCodeFinder';
import { DeadCodeRemover, RemovalOptions } from './deadCodeRemover';
import { MainActionsProvider } from './mainActionsProvider';
import { DeadCodeActionsProvider } from './deadCodeActionsProvider';
import { runAnalyzerTests } from './testAnalyzer';
import { CodeQualityAnalyzer } from './codeQualityAnalyzer';
import { HTMLReportGenerator } from './htmlReportGenerator';
import { ReportsProvider } from './reportsProvider';
import { DeadCodeAnalyzer } from './analyzeDeadCode';
import { ProjectFileCollector } from './getProjectFiles';
import { CodeVisualizerProvider } from './codeVisualizer';
import { VisualizerActionsProvider } from './visualizerActionsProvider';
import { SecurityScanner } from './securityScanner';
import { SecurityActionsProvider } from './securityActionsProvider';
import { SecurityReportGenerator } from './securityReportGenerator';
import { ComplexityAnalyzer } from './complexityAnalyzer';
import { ComplexityHeatmapGenerator } from './complexityHeatmapGenerator';
import { ComplexityActionsProvider } from './complexityActionsProvider';

function updateStatusBar(statusBarItem: vscode.StatusBarItem) {
	const config = vscode.workspace.getConfiguration('whatTheCode');
	const privacyMode = config.get<boolean>('privacyMode', false);
	
	if (privacyMode) {
		statusBarItem.text = '$(shield) Code Quality (Private)';
		statusBarItem.tooltip = 'Privacy Mode: All analysis runs locally. Click to analyze current file.';
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
	} else {
		statusBarItem.text = '$(pulse) Code Quality';
		statusBarItem.tooltip = 'Click to analyze current file quality';
		statusBarItem.backgroundColor = undefined;
	}
}

function updatePrivacyModeStatusBar(statusBarItem: vscode.StatusBarItem) {
	const config = vscode.workspace.getConfiguration('whatTheCode');
	const privacyMode = config.get<boolean>('privacyMode', false);
	
	if (privacyMode) {
		statusBarItem.text = '$(shield-check) Private';
		statusBarItem.tooltip = '🔒 Privacy Mode: ON\nAll features run locally, no external API calls.\nClick to disable Privacy Mode.';
		statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.prominentBackground');
		statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
	} else {
		statusBarItem.text = '$(globe) Public';
		statusBarItem.tooltip = '🌐 Privacy Mode: OFF\nAI features are available.\nClick to enable Privacy Mode.';
		statusBarItem.backgroundColor = undefined;
		statusBarItem.color = undefined;
	}
}

function updateSearchStatusBar(statusBarItem: vscode.StatusBarItem) {
	const config = vscode.workspace.getConfiguration('whatTheCode');
	const privacyMode = config.get<boolean>('privacyMode', false);
	
	statusBarItem.command = 'what-the-code.searchCode';
	
	if (privacyMode) {
		statusBarItem.text = '$(search) Local Search';
		statusBarItem.tooltip = 'Search code locally (Privacy Mode) - Ctrl+Shift+Alt+K';
	} else {
		statusBarItem.text = '$(search) Ask Code';
		statusBarItem.tooltip = 'Search your code with AI (Ctrl+Shift+Alt+K)';
	}
}

function isPrivacyModeEnabled(): boolean {
	const config = vscode.workspace.getConfiguration('whatTheCode');
	return config.get<boolean>('privacyMode', false);
}


async function displayResults(query: string, results: SearchResult[], resultsProvider: SearchResultsProvider) {
	resultsProvider.updateResults(query, results);
	const items = results.map((result, index) => ({
		label: `$(file-code) ${vscode.workspace.asRelativePath(result.file)} [Line ${result.line}]`,
		description: `${index + 1}. ${result.explanation}`,
		detail: `📍 Line ${result.line} | ${result.content.trim()}`,
		result: result
	}));
	const selected = await vscode.window.showQuickPick(items, {
		matchOnDescription: true,
		matchOnDetail: true,
		placeHolder: `${results.length} results for "${query}" (also shown in sidebar)`
	});
	if (selected) {
		await openSearchResult(selected.result);
	}
}

async function openSearchResult(result: SearchResult) {
try {
		const { file, line } = result;
		let fileUri: vscode.Uri;
		if (typeof file === 'string') {
			if (file.includes(':') || file.startsWith('/')) {
				fileUri = vscode.Uri.file(file);
			} else {
				const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
				if (workspaceFolder) {
					fileUri = vscode.Uri.joinPath(workspaceFolder.uri, file);
				} else {
					throw new Error('No workspace folder found');
				}
			}
		} else {
			fileUri = file as vscode.Uri;
		}
		console.log(`Opening file: ${fileUri.fsPath} at line ${line}`);
		const document = await vscode.workspace.openTextDocument(fileUri);
		const editor = await vscode.window.showTextDocument(document);
		const range = new vscode.Range(line - 1, 0, line - 1, 0);
		editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
		const decorationType = vscode.window.createTextEditorDecorationType({
			backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
			isWholeLine: true
		});
		editor.setDecorations(decorationType, [range]);
		setTimeout(() => decorationType.dispose(), 3000);
} catch (error: any) {
		console.error('Error opening file:', error);
		vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
}
}

class CodeSearchProvider {
	   private config: vscode.WorkspaceConfiguration;
	   private outputChannel: vscode.OutputChannel;
	   private codeCollector: CodeCollector;

	   constructor() {
			   this.config = vscode.workspace.getConfiguration('whatTheCode');
			   this.outputChannel = vscode.window.createOutputChannel('What-The-Code');
			   this.codeCollector = new CodeCollector();
	   }

	   async searchCode(query: string, progress: vscode.Progress<{ message?: string; increment?: number }>, token: vscode.CancellationToken): Promise<SearchResult[]> {
			   try {
					   this.outputChannel.appendLine(`🔍 Searching for: "${query}"`);
					   this.outputChannel.show(true);
					   
					   const privacyMode = isPrivacyModeEnabled();
					   
					   progress.report({ increment: 10, message: 'Collecting code files...' });
					   const allFiles = await this.codeCollector.collectCodeFiles();
					   this.outputChannel.appendLine(`📁 Found ${allFiles.length} code files`);
					   
					   if (token.isCancellationRequested) { return []; }
					   if (allFiles.length === 0) {
							   vscode.window.showWarningMessage('No code files found in the workspace.');
							   return [];
					   }
					   
					   progress.report({ increment: 20, message: 'Prioritizing files...' });
					   const relevantFiles = this.codeCollector.prioritizeFiles(allFiles, query);
					   this.outputChannel.appendLine(`🎯 Selected ${relevantFiles.length} most relevant files`);
					   
					   if (token.isCancellationRequested) { return []; }
					   
					   // Use local search in Privacy Mode
					   if (privacyMode) {
						   progress.report({ increment: 30, message: 'Searching locally (Privacy Mode)...' });
						   this.outputChannel.appendLine(`🔒 Using local search (Privacy Mode enabled)`);
						   
						   const localSearch = new LocalSearchProvider();
						   const results = await localSearch.searchLocally(query, relevantFiles);
						   
						   this.outputChannel.appendLine(`✅ Found ${results.length} matches using local search`);
						   return results;
					   }
					   
					   // Use AI search when Privacy Mode is disabled
					   progress.report({ increment: 20, message: 'Building prompt...' });
					   const context = PromptBuilder.buildContextSection(relevantFiles);
					   const prompt = PromptBuilder.buildCodeSearchPrompt(query, context);
					   this.outputChannel.appendLine(`📝 Prepared prompt (${prompt.length} characters)`);
					   
					   if (token.isCancellationRequested) { return []; }
					   
					   progress.report({ increment: 30, message: 'Querying AI...' });
					   const aiProvider = this.getAIProvider();
					   this.outputChannel.appendLine(`🤖 Using ${aiProvider.name} provider`);
					   const response = await aiProvider.query(prompt);
					   this.outputChannel.appendLine(`✅ Received AI response (${response.length} characters)`);
					   
					   if (token.isCancellationRequested) { return []; }
					   
					   progress.report({ increment: 10, message: 'Parsing results...' });
					   const results = this.parseResults(response);
					   this.outputChannel.appendLine(`🎯 Parsed ${results.length} relevant code sections`);
					   return results;
			   } catch (error: any) {
					   this.outputChannel.appendLine(`❌ Error: ${error.message}`);
					   vscode.window.showErrorMessage(`Search failed: ${error.message}`);
					   return [];
			   }
	   }

	   private getAIProvider(): AIProvider {
			   let apiKey = this.config.get<string>('geminiApiKey', '');
			   const model = this.config.get<string>('geminiModel', 'gemini-2.5-flash');
			   return new GeminiProvider(apiKey, model);
	   }

	   private parseResults(response: string): SearchResult[] {
			   try {
					   this.outputChannel.appendLine(`Raw AI response: ${response.substring(0, 200)}...`);
					   let jsonMatch = response.match(/\{[\s\S]*\}/);
					   if (!jsonMatch) {
							   const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
							   if (codeBlockMatch) {
									   jsonMatch = [codeBlockMatch[1]];
							   }
					   }
					   if (!jsonMatch) {
							   throw new Error('No JSON found in response');
					   }
					   const parsed = JSON.parse(jsonMatch[0]);
					   if (!parsed.results || !Array.isArray(parsed.results)) {
							   throw new Error('Invalid response format - missing results array');
					   }
					   const validResults = parsed.results
							   .filter((result: any) => result.file && result.content)
							   .map((result: any) => {
									   const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
									   let absolutePath = result.file;
									   if (workspaceFolder && !result.file.includes(':')) {
											   absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, result.file).fsPath;
									   }
									   return {
											   file: absolutePath,
											   line: Math.max(1, result.line || 1),
											   content: result.content,
											   explanation: result.explanation || 'No explanation provided',
											   confidence: Math.min(1, Math.max(0, result.confidence || 0.8))
									   };
							   });
					   if (validResults.length === 0) {
							   throw new Error('No valid results found in response');
					   }
					   return validResults;
			   } catch (error) {
					   this.outputChannel.appendLine(`JSON parsing failed: ${error}`);
					   this.outputChannel.appendLine(`Full response: ${response}`);
					   vscode.window.showErrorMessage(
							   `AI response parsing failed. The AI may not have returned properly formatted JSON. Check the output channel for details.`
					   );
					   return [];
			   }
	   }

	   dispose() {
			   this.outputChannel.dispose();
	   }
}

async function showWelcomeMessage(context: vscode.ExtensionContext) {
	   const result = await vscode.window.showInformationMessage(
			   '🎉 Welcome to What-The-Code! Ready to search your code with AI?',
			   '✨ Try It Now',
			   '⚙️ Configure Settings'
	   );
	   switch (result) {
			   case '✨ Try It Now':
					   vscode.commands.executeCommand('what-the-code.searchCode');
					   break;
			   case '⚙️ Configure Settings':
					   vscode.commands.executeCommand('what-the-code.openSettings');
					   break;
	   }
	   context.globalState.update('whatTheCode.hasShownWelcome', true);
}

export function activate(context: vscode.ExtensionContext) {
	   console.log('🚀 What-The-Code extension is now activating!');
	   
	   // Create Privacy Mode Toggle Status Bar Item (leftmost, highest priority)
	   const privacyModeStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
	   privacyModeStatusBar.command = 'what-the-code.togglePrivacyMode';
	   updatePrivacyModeStatusBar(privacyModeStatusBar);
	   privacyModeStatusBar.show();
	   context.subscriptions.push(privacyModeStatusBar);
	   
	   // Watch for privacy mode changes to update all status bars
	   context.subscriptions.push(
		   vscode.workspace.onDidChangeConfiguration(e => {
			   if (e.affectsConfiguration('whatTheCode.privacyMode')) {
				   updatePrivacyModeStatusBar(privacyModeStatusBar);
			   }
		   })
	   );
	   
	   // Create Status Bar Item for Code Quality
	   const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	   statusBarItem.command = 'what-the-code.analyzeCurrentFile';
	   updateStatusBar(statusBarItem);
	   statusBarItem.show();
	   context.subscriptions.push(statusBarItem);
	   
	   // Watch for privacy mode changes
	   context.subscriptions.push(
		   vscode.workspace.onDidChangeConfiguration(e => {
			   if (e.affectsConfiguration('whatTheCode.privacyMode')) {
				   updateStatusBar(statusBarItem);
			   }
		   })
	   );
	   
	   const isFirstTime = !context.globalState.get('whatTheCode.hasShownWelcome', false);
	   if (isFirstTime) {
			   console.log('First time activation - showing welcome');
			   showWelcomeMessage(context);
	   }
	   console.log('Creating search provider...');
	   const searchProvider = new CodeSearchProvider();
	   const resultsProvider = new SearchResultsProvider();
	   vscode.window.createTreeView('what-the-code-results', {
			   treeDataProvider: resultsProvider,
			   showCollapseAll: true
	   });
	   const snapshotProvider = new SnapshotProvider(context);
	   vscode.window.createTreeView('what-the-code-snapshots', {
			   treeDataProvider: snapshotProvider,
			   showCollapseAll: true
	   });
	   const mainActionsProvider = new MainActionsProvider();
	   vscode.window.createTreeView('what-the-code-main-actions', {
			   treeDataProvider: mainActionsProvider,
			   showCollapseAll: false
	   });
	   const deadCodeActionsProvider = new DeadCodeActionsProvider();
	   vscode.window.createTreeView('what-the-code-dead-code', {
			   treeDataProvider: deadCodeActionsProvider,
			   showCollapseAll: false
	   });
	   
	   // Initialize HTML Report Generator
	   const htmlReportGenerator = new HTMLReportGenerator();
	   const reportsProvider = new ReportsProvider(htmlReportGenerator.getReportsPath());
	   vscode.window.createTreeView('what-the-code-reports', {
			   treeDataProvider: reportsProvider,
			   showCollapseAll: false
	   });
	   
	   // Initialize Code Visualizer
	   const visualizerActionsProvider = new VisualizerActionsProvider();
	   vscode.window.createTreeView('what-the-code-visualizer', {
			   treeDataProvider: visualizerActionsProvider,
			   showCollapseAll: false
	   });
	   
	   // Initialize Security Scanner
	   const securityScanner = new SecurityScanner();
	   const securityReportGenerator = new SecurityReportGenerator();
	   const securityActionsProvider = new SecurityActionsProvider();
	   vscode.window.createTreeView('what-the-code-security', {
			   treeDataProvider: securityActionsProvider,
			   showCollapseAll: false
	   });

	   const complexityAnalyzer = new ComplexityAnalyzer();
	   const complexityHeatmapGenerator = new ComplexityHeatmapGenerator();
	   const complexityActionsProvider = new ComplexityActionsProvider();
	   vscode.window.createTreeView('what-the-code-complexity', {
			   treeDataProvider: complexityActionsProvider,
			   showCollapseAll: false
	   });
	   
	   const deadCodeFinder = new DeadCodeFinder();
	   const deadCodeRemover = new DeadCodeRemover();
	   const searchCommand = vscode.commands.registerCommand('what-the-code.searchCode', async () => {
			   console.log('🔍 Search command triggered!');
			   
			   try {
					   console.log('Opening search dialog...');
					   
					   // Show privacy mode info if enabled
					   const privacyMode = isPrivacyModeEnabled();
					   let placeholder = 'e.g., "Where is user authentication handled?"';
					   let prompt = 'Ask a question about your code';
					   let title = 'What-The-Code: Ask Your Code';
					   
					   if (privacyMode) {
						   placeholder = '🔒 Privacy Mode: Using local search (e.g., "authentication functions")';
						   prompt = 'Search your code locally (keyword-based)';
						   title = 'What-The-Code: Local Search (Privacy Mode)';
					   }
					   
					   const query = await vscode.window.showInputBox({
							   placeHolder: placeholder,
							   prompt: prompt,
							   title: title
					   });
					   
					   console.log(`User query: ${query}`);
					   if (!query || query.trim().length === 0) {
							   console.log('No query provided, exiting');
							   return;
					   }
					   await vscode.window.withProgress({
							   location: vscode.ProgressLocation.Notification,
							   title: 'Searching your code...',
							   cancellable: true
					   }, async (progress, token) => {
							   token.onCancellationRequested(() => {
									   console.log("User canceled the search operation.");
							   });
							   console.log('Starting search with progress...');
							   progress.report({ increment: 10, message: 'Collecting code files...' });
							   const results = await searchProvider.searchCode(query.trim(), progress, token);
							   console.log(`Search completed with ${results.length} results`);
							   progress.report({ increment: 100, message: 'Complete!' });
							   if (token.isCancellationRequested) {
									   return;
							   }
							   if (results.length > 0) {
									   console.log('Displaying results...');
									   await displayResults(query, results, resultsProvider);
							   } else {
									   console.log('No results found');
									   resultsProvider.clearResults();
									   vscode.window.showInformationMessage('No relevant code found for your query. Try rephrasing or being more specific.');
							   }
					   });
			   } catch (error) {
					   console.error('Search command error:', error);
					   vscode.window.showErrorMessage(`Search failed: ${error}`);
			   }
	   });
	   const testCommand = vscode.commands.registerCommand('what-the-code.testExtension', () => {
			   console.log('🧪 Test command executed!');
			   vscode.window.showInformationMessage('✅ What-The-Code extension is working! Press Ctrl+Shift+Alt+K to search.');
	   });
	   const presetCommand = vscode.commands.registerCommand('what-the-code.applyFrontendPreset', async () => {
			   vscode.window.showWarningMessage("This command is deprecated and will be removed.");
	   });
	   const testGeminiCommand = vscode.commands.registerCommand('what-the-code.testGemini', async () => {
			   const config = vscode.workspace.getConfiguration('whatTheCode');
			   let apiKey = config.get<string>('geminiApiKey', '');
			   const model = config.get<string>('geminiModel', 'gemini-2.5-flash');
			   await vscode.window.withProgress({
					   location: vscode.ProgressLocation.Notification,
					   title: 'Testing Gemini connection...',
					   cancellable: false
			   }, async (progress) => {
					   try {
							   progress.report({ increment: 30, message: 'Connecting to Gemini API...' });
							   const testProvider = new GeminiProvider(apiKey, model);
							   const testPrompt = 'Say "Hello from Gemini!" and nothing else.';
							   progress.report({ increment: 60, message: 'Testing API response...' });
							   const response = await testProvider.query(testPrompt);
							   progress.report({ increment: 100, message: 'Success!' });
							   vscode.window.showInformationMessage(
									   `✅ Gemini connection successful!\n\nModel: ${model}\nResponse: ${response.substring(0, 100)}...`
							   );
					   } catch (error: any) {
							   vscode.window.showErrorMessage(
									   `❌ Gemini connection failed: ${error.message}\n\nMake sure:\n1. API key is valid\n2. You have internet connection\n3. Gemini API is enabled`
							   );
					   }
			   });
	   });
	   const openResultCommand = vscode.commands.registerCommand('what-the-code.openResult', async (result: SearchResult) => {
			   if (result) {
					   await openSearchResult(result);
			   }
	   });
	   const clearResultsCommand = vscode.commands.registerCommand('what-the-code.clearResults', () => {
			   resultsProvider.clearResults();
			   vscode.window.showInformationMessage('Search results cleared.');
	   });
	   const settingsCommand = vscode.commands.registerCommand('what-the-code.openSettings', () => {
			   vscode.commands.executeCommand('workbench.action.openSettings', 'whatTheCode');
	   });
	   const saveSnapshotCommand = vscode.commands.registerCommand('what-the-code.saveSnapshot', async () => {
			   await snapshotProvider.saveSnapshot();
	   });
	   const openSnapshotCommand = vscode.commands.registerCommand('what-the-code.openSnapshot', async (snapshot) => {
			   await snapshotProvider.openSnapshot(snapshot);
	   });
	   const restoreSnapshotCommand = vscode.commands.registerCommand('what-the-code.restoreSnapshot', async (snapshot) => {
			   await snapshotProvider.restoreSnapshot(snapshot);
	   });
	   const deleteSnapshotCommand = vscode.commands.registerCommand('what-the-code.deleteSnapshot', async (snapshot) => {
			   await snapshotProvider.deleteSnapshot(snapshot);
	   });
	   const clearAllSnapshotsCommand = vscode.commands.registerCommand('what-the-code.clearAllSnapshots', async () => {
			   snapshotProvider.clearAllSnapshots();
	   });
	   const findDeadCodeCommand = vscode.commands.registerCommand('what-the-code.findDeadCode', async () => {
			   await deadCodeFinder.findDeadCode();
			   const results = deadCodeFinder.getLastAnalysisResults();
			   deadCodeActionsProvider.updateAnalysisResults(results.length);
	   });
	   const removeDeadCodeSafeCommand = vscode.commands.registerCommand('what-the-code.removeDeadCodeSafe', async () => {
			   const issues = deadCodeFinder.getLastAnalysisResults();
			   if (issues.length === 0) {
					   vscode.window.showWarningMessage('No dead code analysis results found. Please run "Find Dead Code" first.');
					   return;
			   }
			   const highConfidenceIssues = issues.filter(issue => issue.confidence === 'high');
			   if (highConfidenceIssues.length === 0) {
					   vscode.window.showInformationMessage('No high-confidence dead code found. All items need manual review.');
					   return;
			   }
			   const choice = await vscode.window.showWarningMessage(
					   `Remove ${highConfidenceIssues.length} high-confidence dead code items?`,
					   { modal: true },
					   '✅ Yes, Remove Safely',
					   '🔍 Dry Run First',
					   '❌ Cancel'
			   );
			   if (choice === '❌ Cancel') {
					   return;
			   }
			   const options: RemovalOptions = {
					   createBackup: true,
					   confirmEach: false,
					   onlyHighConfidence: true,
					   dryRun: choice === '🔍 Dry Run First'
			   };
			   await deadCodeRemover.removeDeadCode(issues, options);
	   });
	   const removeDeadCodeInteractiveCommand = vscode.commands.registerCommand('what-the-code.removeDeadCodeInteractive', async () => {
			   const issues = deadCodeFinder.getLastAnalysisResults();
			   if (issues.length === 0) {
					   vscode.window.showWarningMessage('No dead code analysis results found. Please run "Find Dead Code" first.');
					   return;
			   }
			   const choice = await vscode.window.showInformationMessage(
					   `Remove dead code interactively? You'll be asked to confirm each file.`,
					   '✅ Yes, Start Interactive',
					   '🔍 Dry Run First',
					   '❌ Cancel'
			   );
			   if (choice === '❌ Cancel') {
					   return;
			   }
			   const options: RemovalOptions = {
					   createBackup: true,
					   confirmEach: true,
					   onlyHighConfidence: false,
					   dryRun: choice === '🔍 Dry Run First'
			   };
			   await deadCodeRemover.removeDeadCode(issues, options);
	   });
	   const removeDeadCodeDryRunCommand = vscode.commands.registerCommand('what-the-code.removeDeadCodeDryRun', async () => {
			   const issues = deadCodeFinder.getLastAnalysisResults();
			   if (issues.length === 0) {
					   vscode.window.showWarningMessage('No dead code analysis results found. Please run "Find Dead Code" first.');
					   return;
			   }
			   const options: RemovalOptions = {
					   createBackup: false,
					   confirmEach: false,
					   onlyHighConfidence: false,
					   dryRun: true
			   };
			   await deadCodeRemover.removeDeadCode(issues, options);
	   });
	   
	   const testAnalyzerCommand = vscode.commands.registerCommand('what-the-code.testAnalyzer', async () => {
		   try {
			   await runAnalyzerTests();
		   } catch (error) {
			   const errorMessage = error instanceof Error ? error.message : String(error);
			   vscode.window.showErrorMessage(`Test failed: ${errorMessage}`);
		   }
	   });
	   
	   const analyzeCodeQualityCommand = vscode.commands.registerCommand('what-the-code.analyzeCodeQuality', async () => {
       const editor = vscode.window.activeTextEditor;
       if (!editor) {
           vscode.window.showWarningMessage('No active editor. Open a file to analyze its code quality.');
           return;
       }
       const document = editor.document;
       const content = document.getText();
       const filePath = document.fileName;
       const analyzer = new CodeQualityAnalyzer();
       const metrics = analyzer.analyzeCodeQuality(content, filePath);
       const issues = analyzer.findTypeSafetyIssues(content, filePath);
       const recommendations = analyzer.generateRefactoringRecommendations(content, filePath);
       let report = `📊 Code Quality Metrics for ${filePath}\n`;
       report += `\nType Coverage: ${metrics.typesCoverage.toFixed(1)}%`;
       report += `\nFunction Complexity: ${metrics.functionComplexity.toFixed(2)}`;
       report += `\nDuplicate Code Blocks: ${metrics.duplicateCodeBlocks}`;
       report += `\nUnused Parameters: ${metrics.unusedParameters}`;
       report += `\nMagic Numbers: ${metrics.magicNumbers}`;
       report += `\nLong Functions: ${metrics.longFunctions}`;
       report += `\n\nType Safety Issues: ${issues.length}`;
       issues.forEach(i => {
           report += `\n- [${i.severity}] Line ${i.line}: ${i.message}`;
       });
       report += `\n\nRefactoring Recommendations: ${recommendations.length}`;
       recommendations.forEach(r => {
           report += `\n- [${r.severity}] Line ${r.line}: ${r.description}`;
       });
       vscode.window.showInformationMessage('Code Quality Analysis complete. See Output for details.');
       const output = vscode.window.createOutputChannel('Code Quality Report');
       output.clear();
       output.appendLine(report);
       output.show();
   });
   
   // Report Generation Commands
   const generateFileReportCommand = vscode.commands.registerCommand('what-the-code.generateFileReport', async () => {
       const editor = vscode.window.activeTextEditor;
       if (!editor) {
           vscode.window.showWarningMessage('No active editor. Open a file to generate a report.');
           return;
       }
       
       await vscode.window.withProgress({
           location: vscode.ProgressLocation.Notification,
           title: 'Generating file report...',
           cancellable: false
       }, async (progress) => {
           try {
               progress.report({ increment: 25, message: 'Analyzing code quality...' });
               
               const document = editor.document;
               const content = document.getText();
               const filePath = document.fileName;
               
               const analyzer = new CodeQualityAnalyzer();
               const metrics = analyzer.analyzeCodeQuality(content, filePath);
               const typeSafetyIssues = analyzer.findTypeSafetyIssues(content, filePath);
               const refactoringRecommendations = analyzer.generateRefactoringRecommendations(content, filePath);
               
               progress.report({ increment: 50, message: 'Checking for dead code...' });
               
               const deadCodeAnalyzer = new DeadCodeAnalyzer();
               const deadCodeIssues = await deadCodeAnalyzer.analyzeFile(filePath, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
               
               progress.report({ increment: 75, message: 'Generating HTML report...' });
               
               const reportPath = await htmlReportGenerator.generateFileReport(
                   filePath,
                   metrics,
                   typeSafetyIssues,
                   refactoringRecommendations,
                   deadCodeIssues
               );
               
               progress.report({ increment: 100, message: 'Complete!' });
               
               const choice = await vscode.window.showInformationMessage(
                   `📄 File report generated successfully!`,
                   'Open Report',
                   'Open Reports Folder'
               );
               
               if (choice === 'Open Report') {
                   await htmlReportGenerator.openReport(reportPath);
               } else if (choice === 'Open Reports Folder') {
                   const uri = vscode.Uri.file(htmlReportGenerator.getReportsPath());
                   await vscode.env.openExternal(uri);
               }
               
               reportsProvider.refresh();
               
           } catch (error) {
               vscode.window.showErrorMessage(`Failed to generate report: ${error}`);
           }
       });
   });
   
   const generateProjectReportCommand = vscode.commands.registerCommand('what-the-code.generateProjectReport', async () => {
       const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
       if (!workspaceFolder) {
           vscode.window.showWarningMessage('No workspace folder found. Open a project to generate a project report.');
           return;
       }
       
       await vscode.window.withProgress({
           location: vscode.ProgressLocation.Notification,
           title: 'Generating project report...',
           cancellable: true
       }, async (progress, token) => {
           try {
               progress.report({ increment: 10, message: 'Collecting project files...' });
               
               const fileCollector = new ProjectFileCollector();
               const files = await fileCollector.collectProjectFiles();
               
               if (token.isCancellationRequested) return;
               
               const reports = [];
               const analyzer = new CodeQualityAnalyzer();
               const deadCodeAnalyzer = new DeadCodeAnalyzer();
               
               for (let i = 0; i < Math.min(files.length, 20); i++) { // Limit to 20 files for performance
                   if (token.isCancellationRequested) return;
                   
                   const file = files[i];
                   progress.report({ 
                       increment: (70 / Math.min(files.length, 20)), 
                       message: `Analyzing ${file.relativePath}...` 
                   });
                   
                   try {
                       const content = await vscode.workspace.fs.readFile(vscode.Uri.file(file.filePath));
                       const textContent = Buffer.from(content).toString('utf8');
                       
                       const metrics = analyzer.analyzeCodeQuality(textContent, file.filePath);
                       const typeSafetyIssues = analyzer.findTypeSafetyIssues(textContent, file.filePath);
                       const refactoringRecommendations = analyzer.generateRefactoringRecommendations(textContent, file.filePath);
                       const deadCodeIssues = await deadCodeAnalyzer.analyzeFile(file.filePath, workspaceFolder.uri.fsPath);
                       
                       reports.push({
                           filePath: file.filePath,
                           relativePath: file.relativePath,
                           timestamp: new Date(),
                           metrics,
                           typeSafetyIssues,
                           refactoringRecommendations,
                           deadCodeIssues,
                           fileSize: textContent.length,
                           lineCount: textContent.split('\n').length
                       });
                   } catch (error) {
                       console.error(`Error analyzing file ${file.filePath}:`, error);
                   }
               }
               
               if (token.isCancellationRequested) return;
               
               progress.report({ increment: 90, message: 'Generating HTML report...' });
               
               const reportPath = await htmlReportGenerator.generateProjectReport(reports);
               
               progress.report({ increment: 100, message: 'Complete!' });
               
               const choice = await vscode.window.showInformationMessage(
                   `📊 Project report generated successfully! (${reports.length} files analyzed)`,
                   'Open Report',
                   'Open Reports Folder'
               );
               
               if (choice === 'Open Report') {
                   await htmlReportGenerator.openReport(reportPath);
               } else if (choice === 'Open Reports Folder') {
                   const uri = vscode.Uri.file(htmlReportGenerator.getReportsPath());
                   await vscode.env.openExternal(uri);
               }
               
               reportsProvider.refresh();
               
           } catch (error) {
               vscode.window.showErrorMessage(`Failed to generate project report: ${error}`);
           }
       });
   });
   
   const openReportCommand = vscode.commands.registerCommand('what-the-code.openReport', async (reportPath: string) => {
       try {
           await htmlReportGenerator.openReport(reportPath);
       } catch (error) {
           vscode.window.showErrorMessage(`Failed to open report: ${error}`);
       }
   });
   
   const deleteReportCommand = vscode.commands.registerCommand('what-the-code.deleteReport', async (reportInfo: any) => {
       try {
           // Handle both direct file path (string) and ReportInfo object
           const reportPath = typeof reportInfo === 'string' ? reportInfo : reportInfo?.filePath;
           
           if (!reportPath) {
               vscode.window.showErrorMessage('Invalid report path provided.');
               return;
           }
           
           const deleted = await htmlReportGenerator.deleteReport(reportPath);
           if (deleted && reportsProvider) {
               reportsProvider.refresh();
           }
       } catch (error) {
           vscode.window.showErrorMessage(`Failed to delete report: ${error}`);
       }
   });
   
   const openReportsFolderCommand = vscode.commands.registerCommand('what-the-code.openReportsFolder', async () => {
       try {
           const uri = vscode.Uri.file(htmlReportGenerator.getReportsPath());
           await vscode.env.openExternal(uri);
       } catch (error) {
           vscode.window.showErrorMessage(`Failed to open reports folder: ${error}`);
       }
   });
   
   const openTeamLeaderboardCommand = vscode.commands.registerCommand('what-the-code.openTeamLeaderboard', async () => {
       try {
           await htmlReportGenerator.openTeamLeaderboard();
       } catch (error) {
           vscode.window.showErrorMessage(`Failed to open team leaderboard: ${error}`);
       }
   });
   
   // Toggle Privacy Mode Command
   const togglePrivacyModeCommand = vscode.commands.registerCommand('what-the-code.togglePrivacyMode', async () => {
       const config = vscode.workspace.getConfiguration('whatTheCode');
       const currentMode = config.get<boolean>('privacyMode', false);
       
       await config.update('privacyMode', !currentMode, vscode.ConfigurationTarget.Global);
       
       const newMode = !currentMode;
       if (newMode) {
           vscode.window.showInformationMessage(
               '🔒 Privacy Mode Enabled: All AI features are disabled. Analysis runs 100% locally.',
               'Learn More'
           ).then(choice => {
               if (choice === 'Learn More') {
                   vscode.env.openExternal(vscode.Uri.parse('https://github.com/insaneodyssey26/what-the-code#privacy-mode'));
               }
           });
       } else {
           vscode.window.showInformationMessage('✨ Privacy Mode Disabled: AI features are now available.');
       }
   });
   
   // Analyze Current File Command (for status bar)
   const analyzeCurrentFileCommand = vscode.commands.registerCommand('what-the-code.analyzeCurrentFile', async () => {
       const editor = vscode.window.activeTextEditor;
       if (!editor) {
           vscode.window.showWarningMessage('No active editor. Open a file to analyze its code quality.');
           return;
       }
       
       await vscode.window.withProgress({
           location: vscode.ProgressLocation.Notification,
           title: 'Analyzing code quality...',
           cancellable: false
       }, async (progress) => {
           try {
               progress.report({ increment: 25, message: 'Analyzing metrics...' });
               
               const document = editor.document;
               const content = document.getText();
               const filePath = document.fileName;
               
               const analyzer = new CodeQualityAnalyzer();
               const metrics = analyzer.analyzeCodeQuality(content, filePath);
               const typeSafetyIssues = analyzer.findTypeSafetyIssues(content, filePath);
               const refactoringRecommendations = analyzer.generateRefactoringRecommendations(content, filePath);
               
               progress.report({ increment: 50, message: 'Checking for dead code...' });
               
               const deadCodeAnalyzer = new DeadCodeAnalyzer();
               const deadCodeIssues = await deadCodeAnalyzer.analyzeFile(filePath, vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
               
               progress.report({ increment: 75, message: 'Complete!' });
               
               const totalIssues = typeSafetyIssues.length + refactoringRecommendations.length + deadCodeIssues.length;
               const qualityScore = calculateQuickScore(metrics, totalIssues);
               
               const choice = await vscode.window.showInformationMessage(
                   `📊 Quality Score: ${qualityScore}/100 | Issues: ${totalIssues} | Type Coverage: ${metrics.typesCoverage.toFixed(0)}%`,
                   'Generate Full Report',
                   'View Issues',
                   'Dismiss'
               );
               
               if (choice === 'Generate Full Report') {
                   vscode.commands.executeCommand('what-the-code.generateFileReport');
               } else if (choice === 'View Issues') {
                   showQuickIssuesSummary(typeSafetyIssues, refactoringRecommendations, deadCodeIssues);
               }
               
           } catch (error) {
               vscode.window.showErrorMessage(`Failed to analyze file: ${error}`);
           }
       });
   });
   
   function calculateQuickScore(metrics: any, issuesCount: number): number {
       let score = 100;
       score -= issuesCount * 2;
       score -= (10 - metrics.functionComplexity) * 2;
       score += metrics.typesCoverage * 0.2;
       return Math.max(0, Math.min(100, Math.round(score)));
   }
   
   function showQuickIssuesSummary(typeSafety: any[], refactoring: any[], deadCode: any[]) {
       const items = [];
       
       if (typeSafety.length > 0) {
           items.push({
               label: `$(warning) ${typeSafety.length} Type Safety Issues`,
               description: 'Click to see details'
           });
       }
       
       if (refactoring.length > 0) {
           items.push({
               label: `$(tools) ${refactoring.length} Refactoring Opportunities`,
               description: 'Click to see details'
           });
       }
       
       if (deadCode.length > 0) {
           items.push({
               label: `$(trash) ${deadCode.length} Dead Code Items`,
               description: 'Click to see details'
           });
       }
       
       if (items.length === 0) {
           vscode.window.showInformationMessage('✅ No issues found! Your code looks great.');
           return;
       }
       
       vscode.window.showQuickPick(items, {
           title: 'Code Quality Issues Summary'
       });
   }
   
   // Code Visualizer
   const codeVisualizerProvider = new CodeVisualizerProvider(context);
   const openCodeVisualizerCommand = vscode.commands.registerCommand('what-the-code.openCodeVisualizer', async () => {
       try {
           await codeVisualizerProvider.openVisualizer();
       } catch (error) {
           vscode.window.showErrorMessage(`Failed to open code visualizer: ${error}`);
       }
   });
	   
	   // Security Scanner Commands
	   const scanSecurityCommand = vscode.commands.registerCommand('what-the-code.scanSecurity', async () => {
		   await vscode.window.withProgress({
			   location: vscode.ProgressLocation.Notification,
			   title: 'Scanning for security vulnerabilities...',
			   cancellable: true
		   }, async (progress, token) => {
			   try {
				   progress.report({ increment: 10, message: 'Collecting files...' });
				   
				   const result = await securityScanner.scanWorkspace();
				   
				   if (token.isCancellationRequested) {
					   return;
				   }
				   
				   progress.report({ increment: 90, message: 'Complete!' });
				   
				   securityActionsProvider.updateResults(result);
				   
				   if (result.totalIssues === 0) {
					   vscode.window.showInformationMessage('✅ No security vulnerabilities detected! Your code is clean.');
				   } else {
					   const choice = await vscode.window.showWarningMessage(
						   `🛡️ Found ${result.totalIssues} security issue(s): ${result.criticalCount} critical, ${result.highCount} high, ${result.mediumCount} medium, ${result.lowCount} low`,
						   'View Details',
						   'Generate Report'
					   );
					   
					   if (choice === 'Generate Report') {
						   vscode.commands.executeCommand('what-the-code.generateSecurityReport');
					   }
				   }
				   
			   } catch (error) {
				   vscode.window.showErrorMessage(`Security scan failed: ${error}`);
			   }
		   });
	   });
	   
	   const openSecurityIssueCommand = vscode.commands.registerCommand('what-the-code.openSecurityIssue', async (issue: any) => {
		   try {
			   const uri = vscode.Uri.file(issue.filePath);
			   const document = await vscode.workspace.openTextDocument(uri);
			   const editor = await vscode.window.showTextDocument(document);
			   
			   const range = new vscode.Range(issue.line - 1, 0, issue.line - 1, 0);
			   editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
			   
			   const decorationType = vscode.window.createTextEditorDecorationType({
				   backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
				   isWholeLine: true
			   });
			   editor.setDecorations(decorationType, [range]);
			   
			   setTimeout(() => decorationType.dispose(), 3000);
		   } catch (error) {
			   vscode.window.showErrorMessage(`Failed to open security issue: ${error}`);
		   }
	   });
	   
	   const clearSecurityResultsCommand = vscode.commands.registerCommand('what-the-code.clearSecurityResults', () => {
		   securityActionsProvider.clearResults();
		   vscode.window.showInformationMessage('Security scan results cleared.');
	   });
	   
	   const generateSecurityReportCommand = vscode.commands.registerCommand('what-the-code.generateSecurityReport', async () => {
		   const results = securityActionsProvider.getResults();
		   if (!results || results.totalIssues === 0) {
			   vscode.window.showWarningMessage('No security scan results found. Please run a security scan first.');
			   return;
		   }
		   
		   await vscode.window.withProgress({
			   location: vscode.ProgressLocation.Notification,
			   title: 'Generating security report...',
			   cancellable: false
		   }, async (progress) => {
			   try {
				   progress.report({ increment: 50, message: 'Creating HTML report...' });
				   
				   const reportPath = await securityReportGenerator.generateSecurityReport(results);
				   
				   progress.report({ increment: 100, message: 'Complete!' });
				   
				   const choice = await vscode.window.showInformationMessage(
					   `🛡️ Security report generated successfully!`,
					   'Open Report',
					   'Open Reports Folder'
				   );
				   
				   if (choice === 'Open Report') {
					   await securityReportGenerator.openReport(reportPath);
				   } else if (choice === 'Open Reports Folder') {
					   const uri = vscode.Uri.file(securityReportGenerator.getReportsPath());
					   await vscode.env.openExternal(uri);
				   }
				   
			   } catch (error) {
				   vscode.window.showErrorMessage(`Failed to generate security report: ${error}`);
			   }
		   });
	   });
	   
	   // Complexity Heatmap Commands
	   
	   const analyzeComplexityCommand = vscode.commands.registerCommand('what-the-code.analyzeComplexity', async () => {
		   await vscode.window.withProgress({
			   location: vscode.ProgressLocation.Notification,
			   title: 'Analyzing code complexity...',
			   cancellable: true
		   }, async (progress, token) => {
			   try {
				   progress.report({ increment: 20, message: 'Collecting files...' });
				   
				   if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
					   vscode.window.showErrorMessage('No workspace folder open');
					   return;
				   }
				   
				   const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
				   const data = await complexityAnalyzer.analyzeWorkspace();
				   
				   if (token.isCancellationRequested) {
					   return;
				   }
				   
				   progress.report({ increment: 100, message: 'Complete!' });
				   
				   // Update the tree view
				   complexityActionsProvider.updateComplexityData(data.files, workspaceRoot);
				   
				   vscode.window.showInformationMessage(
					   `📊 Analyzed ${data.totalFiles} files. Average complexity: ${data.averageComplexity}/100`
				   );
				   
			   } catch (error) {
				   vscode.window.showErrorMessage(`Failed to analyze complexity: ${error}`);
			   }
		   });
	   });

	   const clearComplexityResultsCommand = vscode.commands.registerCommand('what-the-code.clearComplexityResults', () => {
		   complexityActionsProvider.clear();
		   vscode.window.showInformationMessage('Complexity results cleared');
	   });
	   
	   const generateComplexityHeatmapCommand = vscode.commands.registerCommand('what-the-code.generateComplexityHeatmap', async () => {
		   await vscode.window.withProgress({
			   location: vscode.ProgressLocation.Notification,
			   title: 'Analyzing code complexity...',
			   cancellable: true
		   }, async (progress, token) => {
			   try {
				   progress.report({ increment: 20, message: 'Collecting files...' });
				   
				   const data = await complexityAnalyzer.analyzeWorkspace();
				   
				   if (token.isCancellationRequested) {
					   return;
				   }
				   
				   progress.report({ increment: 70, message: 'Generating heatmap...' });
				   
				   const reportPath = await complexityHeatmapGenerator.generateHeatmap(data);
				   
				   progress.report({ increment: 100, message: 'Complete!' });
				   
				   const choice = await vscode.window.showInformationMessage(
					   `📊 Complexity heatmap generated! Analyzed ${data.totalFiles} files. Average complexity: ${data.averageComplexity}/100`,
					   'Open Heatmap',
					   'Open Reports Folder'
				   );
				   
				   if (choice === 'Open Heatmap') {
					   await complexityHeatmapGenerator.openHeatmap(reportPath);
				   } else if (choice === 'Open Reports Folder') {
					   const uri = vscode.Uri.file(complexityHeatmapGenerator.getReportsPath());
					   await vscode.env.openExternal(uri);
				   }
				   
				   reportsProvider.refresh();
				   
			   } catch (error) {
				   vscode.window.showErrorMessage(`Failed to generate complexity heatmap: ${error}`);
			   }
		   });
	   });
	   
	   // Secondary status bar for search (updates based on privacy mode)
	   const searchStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99);
	   updateSearchStatusBar(searchStatusBarItem);
	   searchStatusBarItem.show();
	   context.subscriptions.push(searchStatusBarItem);
	   
	   // Update search status bar when privacy mode changes
	   context.subscriptions.push(
		   vscode.workspace.onDidChangeConfiguration(e => {
			   if (e.affectsConfiguration('whatTheCode.privacyMode')) {
				   updateSearchStatusBar(searchStatusBarItem);
			   }
		   })
	   );
   
   const codeQualityStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 98);
	codeQualityStatusBar.text = '$(checklist) Code Quality';
	codeQualityStatusBar.command = 'what-the-code.analyzeCodeQuality';
	codeQualityStatusBar.tooltip = 'Analyze code quality of the current file';
	codeQualityStatusBar.show();

   
   console.log('Registering commands and UI elements...');
   const openFeedbackCommand = vscode.commands.registerCommand('what-the-code.openFeedback', async () => {
	   const url = 'https://github.com/insaneodyssey26/what-the-code/issues/new?template=feedback.md';
	   vscode.env.openExternal(vscode.Uri.parse(url));
   });
   context.subscriptions.push(
			   searchCommand, 
			   testCommand, 
			   presetCommand, 
			   testGeminiCommand, 
			   settingsCommand, 
			   searchProvider, 
			   statusBarItem, 
			   openResultCommand, 
			   clearResultsCommand, 
			   resultsProvider, 
			   saveSnapshotCommand, 
			   openSnapshotCommand, 
			   restoreSnapshotCommand, 
			   deleteSnapshotCommand, 
			   clearAllSnapshotsCommand, 
			   snapshotProvider, 
			   findDeadCodeCommand, 
			   deadCodeFinder,
			   mainActionsProvider,
			   deadCodeActionsProvider,
			   removeDeadCodeSafeCommand,
			   removeDeadCodeInteractiveCommand,
			   removeDeadCodeDryRunCommand,
			   testAnalyzerCommand,
			   analyzeCodeQualityCommand,
			   codeQualityStatusBar,
			   openFeedbackCommand,
			   generateFileReportCommand,
			   generateProjectReportCommand,
			   openReportCommand,
			   deleteReportCommand,
			   openReportsFolderCommand,
			   openTeamLeaderboardCommand,
			   togglePrivacyModeCommand,
			   analyzeCurrentFileCommand,
			   htmlReportGenerator,
			   reportsProvider,
			   openCodeVisualizerCommand,
			   codeVisualizerProvider,
			   visualizerActionsProvider,
			   scanSecurityCommand,
			   openSecurityIssueCommand,
			   clearSecurityResultsCommand,
			   generateSecurityReportCommand,
			   securityScanner,
			   securityReportGenerator,
			   securityActionsProvider,
			   analyzeComplexityCommand,
			   clearComplexityResultsCommand,
			   generateComplexityHeatmapCommand,
			   complexityAnalyzer,
			   complexityHeatmapGenerator
	   );
	   console.log('✅ What-The-Code extension fully activated!');
}

export function deactivate() {}
