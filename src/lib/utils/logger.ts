/**
 * Structured Logger
 *
 * Provides consistent logging with log levels that respect environment.
 * In production, only warnings and errors are shown.
 * In development, all logs are shown.
 */

const LOG_LEVELS = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

// In production and tests, only show warnings and errors.
// Vitest runs with DEV semantics, so check MODE first to keep green test output readable.
const currentLevel: LogLevel = import.meta.env.MODE === 'test' ? 'warn' : import.meta.env.DEV ? 'debug' : 'warn';

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatPrefix(level: LogLevel, context?: string): string {
	const levelStr = level.toUpperCase().padEnd(5);
	return context ? `[${levelStr}][${context}]` : `[${levelStr}]`;
}

export const logger = {
	/**
	 * Debug logs - only shown in development
	 * Use for detailed debugging information
	 */
	debug: (msg: string, ...args: unknown[]): void => {
		if (shouldLog('debug')) {
			console.debug(formatPrefix('debug'), msg, ...args);
		}
	},

	/**
	 * Info logs - only shown in development
	 * Use for general information about application flow
	 */
	info: (msg: string, ...args: unknown[]): void => {
		if (shouldLog('info')) {
			console.info(formatPrefix('info'), msg, ...args);
		}
	},

	/**
	 * Warning logs - shown in all environments
	 * Use for potentially problematic situations
	 */
	warn: (msg: string, ...args: unknown[]): void => {
		if (shouldLog('warn')) {
			console.warn(formatPrefix('warn'), msg, ...args);
		}
	},

	/**
	 * Error logs - always shown
	 * Use for errors and exceptions
	 */
	error: (msg: string, ...args: unknown[]): void => {
		console.error(formatPrefix('error'), msg, ...args);
	},

	/**
	 * Create a scoped logger with a context prefix
	 * @example const log = logger.scope('CanvasSync');
	 */
	scope: (context: string) => ({
		debug: (msg: string, ...args: unknown[]): void => {
			if (shouldLog('debug')) {
				console.debug(formatPrefix('debug', context), msg, ...args);
			}
		},
		info: (msg: string, ...args: unknown[]): void => {
			if (shouldLog('info')) {
				console.info(formatPrefix('info', context), msg, ...args);
			}
		},
		warn: (msg: string, ...args: unknown[]): void => {
			if (shouldLog('warn')) {
				console.warn(formatPrefix('warn', context), msg, ...args);
			}
		},
		error: (msg: string, ...args: unknown[]): void => {
			console.error(formatPrefix('error', context), msg, ...args);
		}
	})
};

export default logger;
