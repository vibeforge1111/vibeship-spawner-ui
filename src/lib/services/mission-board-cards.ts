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
		taskCount: Math.max(live.taskCount || 0, staticCard.taskCount || 0),
		taskStatusCounts: live.taskStatusCounts ?? staticCard.taskStatusCounts,
		taskNames: live.taskNames?.length ? live.taskNames : staticCard.taskNames,
		tasks: live.tasks?.length ? live.tasks : staticCard.tasks,
		summary: live.summary ?? staticCard.summary,
		providerSummary: live.providerSummary ?? staticCard.providerSummary,
		providerResults: live.providerResults?.length ? live.providerResults : staticCard.providerResults,
		canvasHref: live.canvasHref ?? staticCard.canvasHref
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
