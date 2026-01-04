/**
 * Claude API Client Service
 *
 * Provides intelligent goal analysis using Claude.
 * Communicates with the secure server-side API route.
 */

export interface ClaudeAnalysis {
	technologies: string[];
	features: string[];
	domains: string[];
	suggestedSkills: string[];
	complexity: 'simple' | 'moderate' | 'complex';
	summary: string;
	questions?: string[];
}

export interface AnalysisResult {
	success: boolean;
	analysis?: ClaudeAnalysis;
	error?: string;
	source: 'claude' | 'local' | 'mcp';
	fallback?: boolean;
}

class ClaudeClient {
	private apiEndpoint = '/api/analyze';
	private availableSkills: string[] = [];
	private enabled = true;

	/**
	 * Set available skills for context
	 */
	setAvailableSkills(skills: string[]) {
		this.availableSkills = skills;
	}

	/**
	 * Enable or disable Claude API
	 */
	setEnabled(enabled: boolean) {
		this.enabled = enabled;
	}

	/**
	 * Check if Claude API is enabled
	 */
	isEnabled(): boolean {
		return this.enabled;
	}

	/**
	 * Analyze a goal using Claude
	 */
	async analyzeGoal(goal: string): Promise<AnalysisResult> {
		if (!this.enabled) {
			return {
				success: false,
				error: 'Claude API is disabled',
				source: 'local',
				fallback: true
			};
		}

		try {
			const response = await fetch(this.apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					goal,
					context: {
						availableSkills: this.availableSkills.slice(0, 100)
					}
				})
			});

			const data = await response.json();

			if (!response.ok || data.fallback) {
				return {
					success: false,
					error: data.error || 'API request failed',
					source: 'local',
					fallback: true
				};
			}

			return {
				success: true,
				analysis: data.analysis,
				source: 'claude'
			};

		} catch (error) {
			console.warn('Claude API call failed, falling back to local analysis:', error);
			return {
				success: false,
				error: error instanceof Error ? error.message : 'Network error',
				source: 'local',
				fallback: true
			};
		}
	}

	/**
	 * Check if the Claude API is available
	 */
	async checkAvailability(): Promise<boolean> {
		try {
			const result = await this.analyzeGoal('test');
			return result.success || !result.fallback;
		} catch {
			return false;
		}
	}
}

// Singleton instance
export const claudeClient = new ClaudeClient();

// Export class for testing
export { ClaudeClient };
