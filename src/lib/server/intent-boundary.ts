export interface ExecutionIntentVerdict {
	allowed: boolean;
	reasonCode: 'execution_intent_present' | 'conversation_only_boundary';
	reasons: string[];
}

const META_LANGUAGE_SIGNALS = [
	'mentioning ',
	'just mentioning',
	'only mentioning',
	'keyword',
	'keywords',
	'word here',
	'words here',
	'words alone',
	'phrase',
	'phrases',
	'in this sentence',
	'as words',
	'as text',
	'quoted text',
	'just quoted',
	'does not mean',
	"doesn't mean",
	'talking about the word',
	'talking about the phrase',
	'discussing the word',
	'discussing the phrase'
];

const CONVERSATIONAL_DENIALS = [
	'do not start',
	"don't start",
	'do not run',
	"don't run",
	'do not execute',
	"don't execute",
	'do not dispatch',
	"don't dispatch",
	'do not launch',
	"don't launch",
	'do not build',
	"don't build",
	'do not create a mission',
	"don't create a mission",
	'do not open',
	"don't open",
	'no need to start',
	'no need to run',
	'no need to execute',
	'no need to dispatch',
	'no need to launch',
	'no need to build',
	'not asking you to start',
	'not asking you to run',
	'not asking you to execute',
	'not asking you to dispatch',
	'not asking you to launch',
	'not asking you to build',
	'just explain',
	'explain only',
	'only explain',
	'we can talk here',
	'talk here',
	'stay in chat'
];

export function evaluateExecutionIntentBoundary(goal: string): ExecutionIntentVerdict {
	const normalized = String(goal || '').trim().toLowerCase();
	if (!normalized) {
		return {
			allowed: false,
			reasonCode: 'conversation_only_boundary',
			reasons: ['empty_goal']
		};
	}

	const reasons: string[] = [];
	if (META_LANGUAGE_SIGNALS.some((signal) => normalized.includes(signal))) {
		reasons.push('meta_language_boundary');
	}
	if (CONVERSATIONAL_DENIALS.some((signal) => normalized.includes(signal))) {
		reasons.push('execution_denial_boundary');
	}

	if (reasons.length > 0) {
		return {
			allowed: false,
			reasonCode: 'conversation_only_boundary',
			reasons
		};
	}

	return {
		allowed: true,
		reasonCode: 'execution_intent_present',
		reasons: []
	};
}
