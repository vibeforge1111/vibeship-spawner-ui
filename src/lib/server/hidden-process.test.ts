import { describe, expect, it } from 'vitest';
import { quoteWindowsArg, windowsCmdShimArgs } from './hidden-process';

describe('hidden-process', () => {
	it('quotes Windows command shims without shell interpolation', () => {
		expect(quoteWindowsArg('C:\\Users\\Example\\.npm-global\\codex.cmd')).toBe(
			'C:\\Users\\Example\\.npm-global\\codex.cmd'
		);
		expect(windowsCmdShimArgs('C:\\Program Files\\Spark\\codex.cmd', ['exec', 'hello world'])).toEqual([
			'/d',
			'/s',
			'/c',
			'"C:\\Program Files\\Spark\\codex.cmd" exec "hello world"'
		]);
	});
});
