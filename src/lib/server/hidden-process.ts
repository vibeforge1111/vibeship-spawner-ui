import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'node:child_process';

export function quoteWindowsArg(value: string): string {
	if (/^[A-Za-z0-9._:/\\@+=,-]+$/.test(value)) return value;
	return `"${value.replace(/"/g, '\\"')}"`;
}

export function windowsCmdShimArgs(command: string, args: string[]): string[] {
	return ['/d', '/s', '/c', [quoteWindowsArg(command), ...args.map(quoteWindowsArg)].join(' ')];
}

export function spawnHidden(
	command: string,
	args: string[],
	options: SpawnOptionsWithoutStdio
): ChildProcess {
	const spawnOptions: SpawnOptionsWithoutStdio = {
		...options,
		shell: false,
		windowsHide: true
	};

	if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)) {
		return spawn(process.env.ComSpec || 'cmd.exe', windowsCmdShimArgs(command, args), spawnOptions);
	}

	return spawn(command, args, spawnOptions);
}
