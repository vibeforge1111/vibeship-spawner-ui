import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { platform as osPlatform } from 'node:os';
import { sparkWorkspaceRoot } from './spark-run-workspace';
import { highAgencyWorkersAllowed } from './high-agency-workers';

export type AccessExecutionLaneId = 'spark_workspace' | 'docker' | 'ssh' | 'modal' | 'level5_operator';
export type AccessSetupMode = 'automatic' | 'guided' | 'blocked';
export type AccessOperatingSystemFamily = 'macos' | 'windows' | 'linux' | 'unknown';

export interface AccessExecutionLane {
	id: AccessExecutionLaneId;
	label: string;
	setupMode: AccessSetupMode;
	recommended: boolean;
	available: boolean;
	why: string;
	userMessage: string;
	sparkCliAction: string;
	workspaceRoot?: string;
	osHint?: string;
}

export interface AccessExecutionLaneInput {
	accessLevel: 4 | 5;
	userGoal?: string;
	env?: Record<string, string | undefined>;
	platform?: NodeJS.Platform;
	dockerAvailable?: boolean;
	dockerProbe?: () => boolean;
	workspaceRoot?: string;
}

const DOCKER_PROBE_TIMEOUT_MS = 1_500;
const DOCKER_PROBE_CACHE_MS = 10_000;
let dockerAvailabilityCache: { checkedAt: number; available: boolean } | null = null;

function enabled(value: string | undefined): boolean | undefined {
	const normalized = String(value || '').trim().toLowerCase();
	if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
	if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
	return undefined;
}

function dockerCliDaemonAvailable(): boolean {
	const now = Date.now();
	if (dockerAvailabilityCache && now - dockerAvailabilityCache.checkedAt < DOCKER_PROBE_CACHE_MS) {
		return dockerAvailabilityCache.available;
	}

	const result = spawnSync('docker', ['info', '--format', '{{json .ServerVersion}}'], {
		stdio: 'ignore',
		timeout: DOCKER_PROBE_TIMEOUT_MS,
		windowsHide: true
	}) as SpawnSyncReturns<Buffer>;
	const available = result.status === 0 && !result.error;
	dockerAvailabilityCache = { checkedAt: now, available };
	return available;
}

export function resetDockerAvailabilityCacheForTests(): void {
	dockerAvailabilityCache = null;
}

function hasModalCredentials(env: Record<string, string | undefined>): boolean {
	return Boolean(
		env.MODAL_TOKEN_ID?.trim() && env.MODAL_TOKEN_SECRET?.trim()
	);
}

function hasSshTarget(env: Record<string, string | undefined>): boolean {
	return Boolean(
		env.SPARK_SSH_HOST?.trim() ||
		env.SPARK_REMOTE_SSH_HOST?.trim() ||
		env.SPARK_ACCESS_SSH_TARGET?.trim()
	);
}

function goalNeedsDocker(goal: string): boolean {
	return /\b(?:docker|container|containerized|isolated|linux\s+sandbox|reproducible)\b/i.test(goal);
}

function goalNeedsModal(goal: string): boolean {
	return /\b(?:modal|gpu|cloud\s+sandbox|remote\s+compute|large\s+job)\b/i.test(goal);
}

function goalNeedsSsh(goal: string): boolean {
	return /\b(?:ssh|remote\s+(?:box|machine|server|computer)|vps)\b/i.test(goal);
}

function osFamily(platform: NodeJS.Platform): AccessOperatingSystemFamily {
	if (platform === 'darwin') return 'macos';
	if (platform === 'win32') return 'windows';
	if (platform === 'linux') return 'linux';
	return 'unknown';
}

function osSandboxHint(family: AccessOperatingSystemFamily): string {
	if (family === 'macos') {
		return 'macOS default: use a Spark-owned workspace first; add Docker Desktop only when stronger isolation is useful.';
	}
	if (family === 'windows') {
		return 'Windows default: use a Spark-owned workspace first; add Docker Desktop/WSL through guided setup only when needed.';
	}
	if (family === 'linux') {
		return 'Linux default: use a Spark-owned workspace first; add Docker Engine or Docker Desktop through guided setup only when needed.';
	}
	return 'Default: use a Spark-owned workspace first; add heavier sandboxes only when the machine supports them.';
}

function dockerSetupHint(family: AccessOperatingSystemFamily): string {
	if (family === 'macos') {
		return 'Spark should guide Docker Desktop setup on macOS instead of asking the user to paste terminal commands.';
	}
	if (family === 'windows') {
		return 'Spark should guide Docker Desktop with WSL support on Windows instead of exposing virtualization details.';
	}
	if (family === 'linux') {
		return 'Spark should guide Docker Engine/Desktop setup on Linux with distro-aware checks.';
	}
	return 'Spark should guide Docker setup with OS-aware checks.';
}

function localWorkspaceLane(workspaceRoot: string, family: AccessOperatingSystemFamily): AccessExecutionLane {
	return {
		id: 'spark_workspace',
		label: 'Spark Workspace Sandbox',
		setupMode: 'automatic',
		recommended: false,
		available: true,
		workspaceRoot,
		why: 'Safest default for Level 4: Spark can create and work inside an approved workspace without asking the user to learn Docker, SSH, or Modal.',
		userMessage: `I can set up a safe Spark workspace and work only inside it: ${workspaceRoot}`,
		sparkCliAction: 'spark access setup sandbox',
		osHint: osSandboxHint(family)
	};
}

function dockerLane(available: boolean, family: AccessOperatingSystemFamily): AccessExecutionLane {
	return {
		id: 'docker',
		label: 'Docker Sandbox',
		setupMode: available ? 'automatic' : 'guided',
		recommended: false,
		available,
		why: available
			? 'Docker is available, so Spark can use it for stronger dependency isolation when a task benefits from containers.'
			: 'Docker is useful for stronger isolation, but Spark should guide installation instead of dumping Docker commands into chat.',
		userMessage: available
			? 'Docker is ready. I can use a container sandbox when this task needs stronger isolation.'
			: 'Docker is not ready yet. I can guide a one-click Spark setup path when container isolation is useful.',
		sparkCliAction: available ? 'spark access setup docker-sandbox' : 'spark install docker',
		osHint: dockerSetupHint(family)
	};
}

function sshLane(available: boolean): AccessExecutionLane {
	return {
		id: 'ssh',
		label: 'SSH Remote Sandbox',
		setupMode: available ? 'automatic' : 'guided',
		recommended: false,
		available,
		why: available
			? 'An SSH target is configured, so Spark can route remote-machine work there.'
			: 'SSH is only useful after a trusted remote target is configured.',
		userMessage: available
			? 'Your remote machine is configured. I can use it when the task belongs there.'
			: 'Remote access is not configured yet. I can help connect a trusted machine when you need one.',
		sparkCliAction: available ? 'spark access setup ssh-sandbox' : 'spark connect ssh'
	};
}

function modalLane(available: boolean): AccessExecutionLane {
	return {
		id: 'modal',
		label: 'Modal Cloud Sandbox',
		setupMode: available ? 'automatic' : 'guided',
		recommended: false,
		available,
		why: available
			? 'Modal credentials are configured, so Spark can recommend cloud sandbox execution for compute-heavy jobs.'
			: 'Modal is best for cloud compute, but setup should happen through Spark onboarding rather than manual token commands in chat.',
		userMessage: available
			? 'Modal is connected. I can use a cloud sandbox for compute-heavy work.'
			: 'Modal is not connected yet. I can guide a Spark setup path when cloud compute is useful.',
		sparkCliAction: available ? 'spark access setup modal-sandbox' : 'spark connect modal'
	};
}

function operatorLane(allowed: boolean): AccessExecutionLane {
	return {
		id: 'level5_operator',
		label: 'Whole-Computer Operator Mode',
		setupMode: allowed ? 'guided' : 'blocked',
		recommended: allowed,
		available: allowed,
		why: allowed
			? 'Level 5 is explicitly enabled for this trusted local install.'
			: 'Level 5 is blocked until high-agency worker guardrails are explicitly enabled.',
		userMessage: allowed
			? 'Whole-computer operator mode is available, but I will still prefer a sandbox unless the task truly needs broader access.'
			: 'Whole-computer access is not enabled. I can use the safer Level 4 sandbox path instead.',
		sparkCliAction: allowed ? 'spark access setup operator' : 'spark access setup sandbox'
	};
}

export function recommendAccessExecutionLane(input: AccessExecutionLaneInput): {
	recommended: AccessExecutionLane;
	lanes: AccessExecutionLane[];
	platform: NodeJS.Platform;
	osFamily: AccessOperatingSystemFamily;
} {
	const env = input.env || process.env;
	const currentPlatform = input.platform || osPlatform();
	const family = osFamily(currentPlatform);
	const goal = input.userGoal || '';
	const workspaceRoot = input.workspaceRoot || sparkWorkspaceRoot();
	const dockerAvailable =
		input.dockerAvailable ??
		enabled(env.SPARK_DOCKER_AVAILABLE) ??
		(input.dockerProbe || dockerCliDaemonAvailable)();
	const lanes = [
		localWorkspaceLane(workspaceRoot, family),
		dockerLane(dockerAvailable, family),
		sshLane(hasSshTarget(env)),
		modalLane(hasModalCredentials(env))
	];

	if (input.accessLevel === 5) {
		const lane = operatorLane(highAgencyWorkersAllowed(env));
		return {
			recommended: lane.available ? lane : { ...lanes[0], recommended: true },
			lanes: [lane, ...lanes],
			platform: currentPlatform,
			osFamily: family
		};
	}

	let recommendedId: AccessExecutionLaneId = 'spark_workspace';
	if (goalNeedsModal(goal) && hasModalCredentials(env)) {
		recommendedId = 'modal';
	} else if (goalNeedsSsh(goal) && hasSshTarget(env)) {
		recommendedId = 'ssh';
	} else if (goalNeedsDocker(goal) && dockerAvailable) {
		recommendedId = 'docker';
	}

	const marked = lanes.map((lane) => ({
		...lane,
		recommended: lane.id === recommendedId
	}));
	return {
		recommended: marked.find((lane) => lane.recommended) || marked[0],
		lanes: marked,
		platform: currentPlatform,
		osFamily: family
	};
}
