import { spawn, type ChildProcess, type SpawnOptionsWithoutStdio } from 'node:child_process';

function quoteWindowsArg(value: string): string {
	if (/^[A-Za-z0-9._:/\\@+=,-]+$/.test(value)) return value;
	return `"${value.replace(/"/g, '\\"')}"`;
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
		const commandLine = [quoteWindowsArg(command), ...args.map(quoteWindowsArg)].join(' ');
		return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', commandLine], spawnOptions);
	}

	return spawn(command, args, spawnOptions);
}
