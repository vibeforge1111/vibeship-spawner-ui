export interface CapabilityProposalSummary {
	schemaVersion: string;
	status: string;
	implementationRoute: string;
	ledgerKey: string;
	ownerSystem: string;
}

export function normalizeCapabilityProposalPacket(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
	const packet = value as Record<string, unknown>;
	if (packet.schema_version !== 'spark.capability_proposal.v1') return null;
	if (typeof packet.status !== 'string' || !packet.status.trim()) return null;
	if (typeof packet.implementation_route !== 'string' || !packet.implementation_route.trim()) return null;
	if (typeof packet.capability_ledger_key !== 'string' || !packet.capability_ledger_key.trim()) return null;
	return packet;
}

export function capabilityProposalSummary(packet: Record<string, unknown> | null): CapabilityProposalSummary | null {
	if (!packet) return null;
	return {
		schemaVersion: String(packet.schema_version),
		status: String(packet.status),
		implementationRoute: String(packet.implementation_route),
		ledgerKey: String(packet.capability_ledger_key),
		ownerSystem: typeof packet.owner_system === 'string' ? packet.owner_system : 'unknown'
	};
}
