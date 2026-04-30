import type { MissionControlTaskStatus, MissionControlTaskStatusCounts } from '$lib/types/mission-control';

export type MissionBoardCardStatus = 'draft' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type MissionBoardCardSource = 'mcp' | 'spark';

export interface MissionBoardTaskSummary {
	title: string;
	skills: string[];
	status?: MissionControlTaskStatus;
}

export interface MissionBoardProviderResult {
	providerId: string;
	status: string;
	summary: string;
}

export interface MissionBoardCard {
	id: string;
	name: string;
	status: MissionBoardCardStatus;
	mode: string;
	source: MissionBoardCardSource;
	updatedAt: string | null;
	createdAt: string | null;
	lastEventType?: string | null;
	executionStarted?: boolean;
	queuedAt?: string | null;
	startedAt?: string | null;
	taskCount: number;
	taskStatusCounts?: MissionControlTaskStatusCounts;
	strategy?: string;
	taskNames?: string[];
	tasks?: MissionBoardTaskSummary[];
	summary?: string | null;
	providerSummary?: string | null;
	providerResults?: MissionBoardProviderResult[];
	canvasHref?: string | null;
	detailHref?: string | null;
}

export interface MissionBoardCardActionLinks {
	detailHref: string;
	canvasHref: string | null;
	traceHref: string;
	resultHref: string | null;
}

function missionDetailHref(missionId: string): string {
	return `/missions/${encodeURIComponent(missionId)}`;
}

function withoutHash(href: string): string {
	return href.split('#')[0] || href;
}

export function getMissionBoardCardActionLinks(
	card: Pick<MissionBoardCard, 'id' | 'canvasHref' | 'detailHref' | 'providerResults' | 'status'>
): MissionBoardCardActionLinks {
	const encodedMissionId = encodeURIComponent(card.id);
	const detailHref = card.detailHref ?? missionDetailHref(card.id);
	const hasTerminalResult = ['completed', 'failed', 'cancelled'].includes(card.status);
	const hasProviderResult = (card.providerResults?.length ?? 0) > 0;

	return {
		detailHref,
		canvasHref: card.canvasHref ?? null,
		traceHref: `/trace?missionId=${encodedMissionId}`,
		resultHref: hasTerminalResult || hasProviderResult ? `${withoutHash(detailHref)}#result` : null
	};
}

function latestTimestamp(a: string | null, b: string | null): string | null {
	if (!a) return b;
	if (!b) return a;
	return Date.parse(a) >= Date.parse(b) ? a : b;
}

function mergeLiveWithStaticCard(live: MissionBoardCard, staticCard: MissionBoardCard): MissionBoardCard {
	return {
		...staticCard,
		...live,
		name: live.name || staticCard.name,
		status: live.status,
		source: live.source,
		mode: live.mode || staticCard.mode,
		updatedAt: latestTimestamp(live.updatedAt, staticCard.updatedAt),
		createdAt: live.createdAt || staticCard.createdAt,
		queuedAt: live.queuedAt ?? staticCard.queuedAt,
		startedAt: live.startedAt ?? staticCard.startedAt,
		lastEventType: live.lastEventType ?? staticCard.lastEventType,
		executionStarted: live.executionStarted ?? staticCard.executionStarted,
		taskCount: Math.max(live.taskCount || 0, staticCard.taskCount || 0),
		taskStatusCounts: live.taskStatusCounts ?? staticCard.taskStatusCounts,
		taskNames: live.taskNames?.length ? live.taskNames : staticCard.taskNames,
		tasks: live.tasks?.length ? live.tasks : staticCard.tasks,
		summary: live.summary ?? staticCard.summary,
		providerSummary: live.providerSummary ?? staticCard.providerSummary,
		providerResults: live.providerResults?.length ? live.providerResults : staticCard.providerResults,
		canvasHref: live.canvasHref ?? staticCard.canvasHref,
		detailHref: live.detailHref ?? staticCard.detailHref
	};
}

export function mergeMissionBoardCards(
	liveCards: MissionBoardCard[],
	staticCards: MissionBoardCard[]
): MissionBoardCard[] {
	const byId = new Map<string, MissionBoardCard>();
	for (const card of liveCards) {
		byId.set(card.id, card);
	}

	for (const card of staticCards) {
		const live = byId.get(card.id);
		byId.set(card.id, live ? mergeLiveWithStaticCard(live, card) : card);
	}

	return [...byId.values()];
}

export function isCreatorMissionBoardCard(
	card: Pick<MissionBoardCard, 'id' | 'mode' | 'name'>
): boolean {
	return (
		card.id.startsWith('mission-creator-') ||
		card.mode === 'creator-mission' ||
		card.name.toLowerCase().startsWith('creator mission:')
	);
}

export function canRunCreatorMissionBoardCard(
	card: Pick<MissionBoardCard, 'id' | 'mode' | 'name' | 'status' | 'executionStarted'>
): boolean {
	if (!isCreatorMissionBoardCard(card)) return false;
	if (card.executionStarted) return false;
	return card.status !== 'completed' && card.status !== 'failed' && card.status !== 'cancelled' && card.status !== 'paused';
}

export function canValidateCreatorMissionBoardCard(
	card: Pick<MissionBoardCard, 'id' | 'mode' | 'name' | 'status'>
): boolean {
	if (!isCreatorMissionBoardCard(card)) return false;
	return card.status !== 'cancelled';
}
