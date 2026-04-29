import { describe, expect, it } from 'vitest';
import { quoteWindowsArg, windowsCmdShimArgs, windowsTaskkillArgs } from './hidden-process';

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

	it('builds a process-tree kill command for Windows provider cleanup', () => {
		expect(windowsTaskkillArgs(1234)).toEqual(['/pid', '1234', '/t', '/f']);
	});
});
