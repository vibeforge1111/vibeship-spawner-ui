import {
	createHarnessCoreEvidenceRef,
	createHarnessCoreLegacyAuthorityInventory,
	createHarnessCoreLegacyAuthorityPlane,
	createHarnessCoreTraceRef,
	type HarnessCoreEvidenceKind,
	type LegacyAuthorityInventoryV1,
	type LegacyAuthorityPlaneType,
	type LegacyAuthorityPlaneV1,
	type LegacyAuthorityRisk
} from '@spark/harness-core';

const OWNER_REPO = 'spawner-ui';

function evidence(id: string, kind: HarnessCoreEvidenceKind, summary: string, confidence = 0.95) {
	return createHarnessCoreEvidenceRef({
		id,
		kind,
		source: OWNER_REPO,
		summary,
		confidence,
		trace_refs: [
			createHarnessCoreTraceRef({
				id: `${id}:trace`,
				summary
			})
		]
	});
}

function evidenceOnlyPlane(input: {
	id: string;
	plane_type: LegacyAuthorityPlaneType;
	source_path: string;
	summary: string;
	kind?: HarnessCoreEvidenceKind;
}): LegacyAuthorityPlaneV1 {
	return createHarnessCoreLegacyAuthorityPlane({
		id: input.id,
		owner_repo: OWNER_REPO,
		surface: 'spawner',
		plane_type: input.plane_type,
		source_path: input.source_path,
		summary: input.summary,
		authority_risk: {},
		disposition: 'evidence_adapter',
		evidence_only: true,
		evidence: [evidence(`${input.id}:evidence`, input.kind || 'route_candidate', input.summary)]
	});
}

function consumerPlane(input: {
	id: string;
	plane_type: LegacyAuthorityPlaneType;
	source_path: string;
	summary: string;
	authority_risk: Partial<LegacyAuthorityRisk>;
	kind?: HarnessCoreEvidenceKind;
}): LegacyAuthorityPlaneV1 {
	return createHarnessCoreLegacyAuthorityPlane({
		id: input.id,
		owner_repo: OWNER_REPO,
		surface: 'spawner',
		plane_type: input.plane_type,
		source_path: input.source_path,
		summary: input.summary,
		authority_risk: input.authority_risk,
		disposition: 'canonical_consumer',
		governor_required: true,
		consumer_of_governor: true,
		ledger_required: true,
		evidence: [evidence(`${input.id}:consumer`, input.kind || 'policy', input.summary)]
	});
}

function quarantinedPlane(input: {
	id: string;
	plane_type: LegacyAuthorityPlaneType;
	source_path: string;
	summary: string;
}): LegacyAuthorityPlaneV1 {
	return createHarnessCoreLegacyAuthorityPlane({
		id: input.id,
		owner_repo: OWNER_REPO,
		surface: 'spawner',
		plane_type: input.plane_type,
		source_path: input.source_path,
		summary: input.summary,
		authority_risk: {},
		disposition: 'quarantined',
		evidence: [evidence(`${input.id}:quarantined`, 'policy', input.summary, 0.9)]
	});
}

export function buildSpawnerLegacyAuthorityPlanes(): LegacyAuthorityPlaneV1[] {
	return [
		evidenceOnlyPlane({
			id: 'spawner-prd-analyzer',
			plane_type: 'keyword_detector',
			source_path: 'src/lib/utils/prd-analyzer.ts',
			summary: 'PRD analyzer keyword and skill matching stays recommendation evidence; it cannot dispatch providers or mutate workspaces.'
		}),
		evidenceOnlyPlane({
			id: 'spawner-smart-prd-analyzer',
			plane_type: 'keyword_detector',
			source_path: 'src/lib/utils/smart-prd-analyzer.ts',
			summary: 'Smart PRD mission/task shaping is prompt and workflow evidence only until a Governor-authorized dispatch consumes it.'
		}),
		evidenceOnlyPlane({
			id: 'spawner-mission-size-classifier',
			plane_type: 'regex_router',
			source_path: 'src/lib/server/mission-size-classifier.ts',
			summary: 'Mission-size classification may shape lanes and UI, but does not own execution authority.'
		}),
		evidenceOnlyPlane({
			id: 'spawner-skill-router',
			plane_type: 'regex_router',
			source_path: 'src/lib/services/skill-router.ts',
			summary: 'Skill routing and H70 matching are metadata-only routing evidence for mission planning.'
		}),
		evidenceOnlyPlane({
			id: 'spawner-workspace-path-resolver',
			plane_type: 'machine_origin_policy',
			source_path: 'src/lib/server/spark-run-workspace.ts',
			summary: 'Workspace path resolution validates/sanitizes targets but cannot authorize a run by itself.'
		}),
		quarantinedPlane({
			id: 'spawner-machine-origin-policy',
			plane_type: 'machine_origin_policy',
			source_path: 'src/lib/server/harness-authority.ts',
			summary: 'Legacy machine-origin policy is explicitly demoted and never allowed as execution authority.'
		}),
		consumerPlane({
			id: 'spawner-server-harness-authority',
			plane_type: 'local_dispatcher',
			source_path: 'src/lib/server/harness-authority.ts',
			summary: 'Server authority validation converts downstream requests into native Governor-only execution gates with ledger checks.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_route_turns: true,
				can_launch_mission: true,
				can_call_network: true,
				can_publish: true,
				can_schedule: true
			}
		}),
		consumerPlane({
			id: 'spawner-client-harness-authority',
			plane_type: 'local_dispatcher',
			source_path: 'src/lib/services/harness-authority-client.ts',
			summary: 'Client-side authority helpers produce Harness Core envelopes/Governor records for UI-originated Spawner actions.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_route_turns: true,
				can_launch_mission: true,
				can_call_network: true
			}
		}),
		consumerPlane({
			id: 'spawner-spark-run-api',
			plane_type: 'tool_launcher',
			source_path: 'src/routes/api/spark/run/+server.ts',
			summary: 'Spark run API requires native Governor authority before provider mission execution.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_launch_mission: true,
				can_call_network: true
			}
		}),
		consumerPlane({
			id: 'spawner-dispatch-api',
			plane_type: 'tool_launcher',
			source_path: 'src/routes/api/dispatch/+server.ts',
			summary: 'Provider dispatch API requires Governor authority from request, relay, or execution pack before provider execution.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_launch_mission: true,
				can_call_network: true
			}
		}),
		consumerPlane({
			id: 'spawner-scheduled-api',
			plane_type: 'schedule_trigger',
			source_path: 'src/routes/api/scheduled/+server.ts',
			summary: 'Schedule create/delete API passes executionAuthority into scheduler governance before mutating schedules.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_schedule: true,
				can_launch_mission: true
			}
		}),
		consumerPlane({
			id: 'spawner-scheduler-runtime',
			plane_type: 'schedule_trigger',
			source_path: 'src/lib/server/scheduler.ts',
			summary: 'Persisted schedule fires mint native Governor authority for scheduled mission or loop execution.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_schedule: true,
				can_launch_mission: true
			}
		}),
		consumerPlane({
			id: 'spawner-mission-control-command',
			plane_type: 'mission_helper',
			source_path: 'src/lib/server/mission-control-command.ts',
			summary: 'Mission pause/resume/kill commands require native Governor authority; status remains read-only.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_route_turns: true,
				can_launch_mission: true
			}
		}),
		consumerPlane({
			id: 'spawner-creator-mission-api',
			plane_type: 'mission_helper',
			source_path: 'src/routes/api/creator/mission/+server.ts',
			summary: 'Creator mission creation requires Governor authority unless explicitly staged as read-only.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_launch_mission: true,
				can_publish: true
			}
		}),
		consumerPlane({
			id: 'spawner-creator-execute-api',
			plane_type: 'tool_launcher',
			source_path: 'src/routes/api/creator/mission/execute/+server.ts',
			summary: 'Creator mission execution dispatch requires native Governor authority and preserves execution authority to Spawner dispatch.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_launch_mission: true,
				can_call_network: true,
				can_publish: true
			}
		}),
		consumerPlane({
			id: 'spawner-analysis-api',
			plane_type: 'tool_launcher',
			source_path: 'src/routes/api/analyze/+server.ts',
			summary: 'External/LLM project analysis is a governed tool consumer when it can call provider APIs.',
			authority_risk: {
				can_execute: true,
				can_call_network: true
			}
		}),
		consumerPlane({
			id: 'spawner-prd-load-to-canvas',
			plane_type: 'local_dispatcher',
			source_path: 'src/routes/api/prd-bridge/load-to-canvas/+server.ts',
			summary: 'PRD load-to-canvas can auto-run only by creating and forwarding Governor authority.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_route_turns: true,
				can_launch_mission: true
			}
		}),
		consumerPlane({
			id: 'spawner-mission-executor',
			plane_type: 'tool_launcher',
			source_path: 'src/lib/services/mission-executor.ts',
			summary: 'Mission executor consumes existing relay authority or mints bounded Governor records for internal continuation paths.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_launch_mission: true,
				can_call_network: true
			}
		}),
		consumerPlane({
			id: 'spawner-access-execution-actions',
			plane_type: 'tool_launcher',
			source_path: 'src/lib/server/access-execution-actions.ts',
			summary: 'Access execution actions are capability-policy and Harness-authority consumers for bounded OS/operator work.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true
			}
		}),
		consumerPlane({
			id: 'spawner-daily-orchestrator',
			plane_type: 'schedule_trigger',
			source_path: 'src/lib/server/daily-orchestrator.ts',
			summary: 'Daily orchestrator scheduled work mints bounded Governor authority before downstream execution.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_schedule: true,
				can_launch_mission: true
			}
		}),
		consumerPlane({
			id: 'spawner-capability-policy',
			plane_type: 'machine_origin_policy',
			source_path: 'src/lib/server/capability-policy.ts',
			summary: 'Capability policy is a second-stage least-privilege check; it cannot replace Governor authority for high-agency execution.',
			authority_risk: {
				can_execute: true,
				can_mutate_state: true,
				can_call_network: true
			}
		})
	];
}

export function buildSpawnerLegacyAuthorityInventory(): LegacyAuthorityInventoryV1 {
	return createHarnessCoreLegacyAuthorityInventory({
		id: 'spawner-authority-inventory',
		owner_repo: OWNER_REPO,
		surfaces: ['spawner'],
		planes: buildSpawnerLegacyAuthorityPlanes()
	});
}
