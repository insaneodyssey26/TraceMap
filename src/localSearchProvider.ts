import { AIProvider, SearchResult, CodeFile } from './types';

export class LocalSearchProvider implements AIProvider {
    name = 'Local Search (Privacy Mode)';

    async query(prompt: string): Promise<string> {
        // This won't be called directly, but we need it for the interface
        return JSON.stringify({ results: [] });
    }

    /**
     * Perform local code search without external APIs
     */
    async searchLocally(query: string, files: CodeFile[]): Promise<SearchResult[]> {
        const keywords = this.extractKeywords(query);
        const results: Array<SearchResult & { score: number }> = [];

        for (const file of files) {
            const lines = file.content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const matches = this.findMatches(line, keywords, file.content, i);
                
                if (matches.score > 0) {
                    // Get context (3 lines before and after)
                    const contextStart = Math.max(0, i - 3);
                    const contextEnd = Math.min(lines.length, i + 4);
                    const context = lines.slice(contextStart, contextEnd).join('\n');
                    
                    results.push({
                        file: file.path,
                        line: i + 1,
                        content: context,
                        explanation: this.generateExplanation(matches.matchedKeywords, line, query),
                        confidence: this.calculateConfidence(matches.score, keywords.length),
                        score: matches.score
                    });
                }
            }
        }

        // Sort by score and take top 10
        results.sort((a, b) => b.score - a.score);
        const topResults = results.slice(0, 10);

        return topResults.map(({ score, ...result }) => result);
    }

    private extractKeywords(query: string): string[] {
        // Remove common words and extract meaningful keywords
        const commonWords = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
            'could', 'may', 'might', 'must', 'can', 'where', 'what', 'how', 'when',
            'why', 'which', 'that', 'this', 'these', 'those', 'i', 'you', 'we', 'they'
        ]);

        const words = query.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2 && !commonWords.has(word));

        // Add programming-specific synonyms
        const synonyms: Record<string, string[]> = {
            'function': ['function', 'func', 'def', 'method', 'fn'],
            'class': ['class', 'component', 'interface', 'type'],
            'variable': ['var', 'let', 'const', 'variable'],
            'api': ['api', 'fetch', 'axios', 'http', 'request'],
            'authentication': ['auth', 'login', 'signin', 'authentication', 'session'],
            'database': ['db', 'database', 'sql', 'query', 'collection'],
            'error': ['error', 'exception', 'catch', 'throw', 'try'],
            'form': ['form', 'input', 'submit', 'validation'],
            'button': ['button', 'btn', 'click', 'onclick'],
            'route': ['route', 'router', 'navigation', 'path', 'link'],
            'state': ['state', 'useState', 'setState', 'data'],
            'style': ['style', 'css', 'styled', 'className'],
            'component': ['component', 'element', 'widget', 'ui'],
            'handler': ['handler', 'callback', 'listener', 'event']
        };

        const expandedKeywords = new Set<string>();
        
        for (const word of words) {
            expandedKeywords.add(word);
            
            // Add synonyms
            for (const [key, syns] of Object.entries(synonyms)) {
                if (word.includes(key) || key.includes(word)) {
                    syns.forEach(syn => expandedKeywords.add(syn));
                }
            }
        }

        return Array.from(expandedKeywords);
    }

    private findMatches(line: string, keywords: string[], fullContent: string, lineIndex: number): {
        score: number;
        matchedKeywords: string[];
    } {
        let score = 0;
        const matchedKeywords: string[] = [];
        const lowerLine = line.toLowerCase();
        const lowerContent = fullContent.toLowerCase();

        for (const keyword of keywords) {
            const lowerKeyword = keyword.toLowerCase();
            
            // Exact match on line (high score)
            if (lowerLine.includes(lowerKeyword)) {
                score += 10;
                matchedKeywords.push(keyword);
                
                // Bonus for word boundaries
                const wordBoundaryRegex = new RegExp(`\\b${this.escapeRegex(lowerKeyword)}\\b`);
                if (wordBoundaryRegex.test(lowerLine)) {
                    score += 5;
                }
                
                // Bonus for being in function/class declaration
                if (/^[\s]*(function|class|const|let|var|export|async|interface|type)\s/.test(line)) {
                    score += 8;
                }
            }
            
            // Partial match
            else if (lowerLine.includes(lowerKeyword.slice(0, -1))) {
                score += 3;
            }
            
            // Bonus for multiple matches in surrounding context
            const contextStart = Math.max(0, lineIndex - 5);
            const contextEnd = Math.min(fullContent.split('\n').length, lineIndex + 5);
            const context = fullContent.split('\n').slice(contextStart, contextEnd).join('\n').toLowerCase();
            
            const contextMatches = (context.match(new RegExp(this.escapeRegex(lowerKeyword), 'g')) || []).length;
            score += Math.min(contextMatches, 5);
        }

        return { score, matchedKeywords };
    }

    private generateExplanation(matchedKeywords: string[], line: string, originalQuery: string): string {
        const explanations = [];

        // Check what kind of code this is
        if (/^[\s]*(function|const|let|var|async)\s+\w+/.test(line)) {
            explanations.push('Function or variable declaration');
        } else if (/^[\s]*class\s+\w+/.test(line)) {
            explanations.push('Class definition');
        } else if (/^[\s]*export/.test(line)) {
            explanations.push('Exported code');
        } else if (/\.(get|post|put|delete|patch)\s*\(/.test(line)) {
            explanations.push('API endpoint');
        } else if (/(fetch|axios|http)\s*\(/.test(line)) {
            explanations.push('HTTP request');
        } else if (/(onClick|onSubmit|onChange|addEventListener)/.test(line)) {
            explanations.push('Event handler');
        } else if (/import\s+.*from/.test(line)) {
            explanations.push('Import statement');
        }

        if (matchedKeywords.length > 0) {
            explanations.push(`Matches keywords: ${matchedKeywords.slice(0, 3).join(', ')}`);
        }

        if (explanations.length === 0) {
            explanations.push('Contains relevant code');
        }

        return explanations.join(' - ');
    }

    private calculateConfidence(score: number, totalKeywords: number): number {
        // Normalize score to 0-1 range
        const normalizedScore = Math.min(score / (totalKeywords * 15), 1);
        return Math.round(normalizedScore * 100) / 100;
    }

    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Format results as JSON string (for compatibility with existing code)
     */
    formatResults(results: SearchResult[]): string {
        return JSON.stringify({ results }, null, 2);
    }
}
