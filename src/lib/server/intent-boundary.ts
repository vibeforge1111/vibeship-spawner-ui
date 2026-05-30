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
	'word alone',
	'words alone',
	'phrase',
	'phrases',
	'term',
	'terms',
	'in this sentence',
	'as a sentence',
	'as words',
	'as text',
	'quoted text',
	'just quoted',
	'only quoted',
	'just a repo name',
	'just the repo name',
	'does not mean',
	"doesn't mean",
	'not mean',
	'talking about the word',
	'talking about the phrase',
	'discussing the word',
	'discussing the phrase',
	'not a request',
	'not an instruction',
	'not a command',
	'not asking for',
	'not asking you to'
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
	'do not create',
	"don't create",
	'do not scaffold',
	"don't scaffold",
	'do not generate',
	"don't generate",
	'do not save',
	"don't save",
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
	'no need to create',
	'no need to scaffold',
	'no need to generate',
	'no need to save',
	'not asking you to start',
	'not asking you to run',
	'not asking you to execute',
	'not asking you to dispatch',
	'not asking you to launch',
	'not asking you to build',
	'not asking you to create',
	'not asking you to scaffold',
	'not asking you to generate',
	'not asking you to save',
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
