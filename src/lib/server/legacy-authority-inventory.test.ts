import { describe, expect, it } from 'vitest';
import type { LegacyAuthorityRisk } from '@spark/harness-core';
import {
	buildSpawnerLegacyAuthorityInventory,
	buildSpawnerLegacyAuthorityPlanes
} from './legacy-authority-inventory';

function hasHighAgencyRisk(risk: LegacyAuthorityRisk): boolean {
	return Object.values(risk).some(Boolean);
}

describe('Spawner legacy authority inventory', () => {
	it('is release-ready under the Harness Core inventory contract', () => {
		const inventory = buildSpawnerLegacyAuthorityInventory();

		expect(inventory.schema_version).toBe('legacy-authority-inventory-v1');
		expect(inventory.scope.owner_repo).toBe('spawner-ui');
		expect(inventory.scope.surfaces).toEqual(['spawner']);
		expect(inventory.release_gate.zero_high_agency_legacy_local_gates).toBe(true);
		expect(inventory.release_gate.ready_for_readiness_promotion).toBe(true);
		expect(inventory.release_gate.blockers).toEqual([]);
		expect(inventory.summary.release_blocker_count).toBe(0);
		expect(inventory.summary.plane_count).toBe(inventory.planes.length);
		expect(inventory.summary.plane_count).toBeGreaterThanOrEqual(20);
	});

	it('keeps Spawner parser and planning helpers evidence-only', () => {
		const evidenceOnlyPlanes = buildSpawnerLegacyAuthorityPlanes().filter(
			(plane) => plane.disposition === 'evidence_adapter'
		);

		expect(evidenceOnlyPlanes.length).toBeGreaterThanOrEqual(5);
		for (const plane of evidenceOnlyPlanes) {
			expect(hasHighAgencyRisk(plane.authority_risk)).toBe(false);
			expect(plane.harness_binding.evidence_only).toBe(true);
			expect(plane.harness_binding.consumer_of_governor).toBe(false);
			expect(plane.harness_binding.ledger_required).toBe(false);
			expect(plane.blockers).toEqual([]);
		}
	});

	it('requires Governor and ledgers for every high-agency Spawner consumer', () => {
		const inventory = buildSpawnerLegacyAuthorityInventory();
		const highAgencyPlanes = inventory.planes.filter((plane) => hasHighAgencyRisk(plane.authority_risk));

		expect(highAgencyPlanes.length).toBe(inventory.summary.high_agency_risk_count);
		expect(highAgencyPlanes.length).toBeGreaterThanOrEqual(14);
		for (const plane of highAgencyPlanes) {
			expect(plane.disposition).toBe('canonical_consumer');
			expect(plane.harness_binding.governor_required).toBe(true);
			expect(plane.harness_binding.consumer_of_governor).toBe(true);
			expect(plane.harness_binding.ledger_required).toBe(true);
			expect(plane.blockers).toEqual([]);
		}
	});

	it('names the old Spawner planes that could fight execution authority', () => {
		const planeIds = new Set(buildSpawnerLegacyAuthorityPlanes().map((plane) => plane.source_ref.id));

		[
			'artifact:spawner-machine-origin-policy:source',
			'artifact:spawner-server-harness-authority:source',
			'artifact:spawner-spark-run-api:source',
			'artifact:spawner-dispatch-api:source',
			'artifact:spawner-scheduled-api:source',
			'artifact:spawner-scheduler-runtime:source',
			'artifact:spawner-mission-control-command:source',
			'artifact:spawner-creator-mission-api:source',
			'artifact:spawner-creator-execute-api:source',
			'artifact:spawner-prd-load-to-canvas:source',
			'artifact:spawner-mission-executor:source',
			'artifact:spawner-capability-policy:source'
		].forEach((id) => expect(planeIds.has(id), `missing inventory plane ${id}`).toBe(true));
	});
});
