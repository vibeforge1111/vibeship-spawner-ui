/**
 * Skill Dependencies
 *
 * Tracks which skills should be loaded before others.
 * KISS: Only critical dependencies, not everything.
 */

// Skills that must be loaded before others
export const SKILL_DEPENDENCIES: Record<string, string[]> = {
	// Payment skills need auth first
	'stripe-integration': ['auth-specialist'],
	'subscription-billing': ['stripe-integration', 'database-architect'],
	'payment-processing': ['stripe-integration'],

	// Web3 skills need wallet first
	'nft-engineer': ['wallet-integration'],
	'smart-contracts': ['wallet-integration'],
	'defi-protocols': ['wallet-integration', 'smart-contracts'],

	// Real-time skills need base networking
	'game-networking': ['realtime-engineer'],
	'multiplayer-sync': ['realtime-engineer', 'game-networking'],
	'live-collaboration': ['realtime-engineer'],

	// Database skills
	'drizzle-orm': ['database-architect'],
	'prisma-orm': ['database-architect'],

	// Frontend skills need base setup
	'animation-specialist': ['frontend-architect'],
	'state-management': ['frontend-architect'],

	// Testing skills
	'e2e-testing': ['test-architect'],
	'integration-testing': ['test-architect'],
};

// Skill groups that commonly work together
export const SKILL_GROUPS: Record<string, string[]> = {
	'auth-complete': ['auth-specialist', 'session-management', 'oauth-integration'],
	'payments-complete': ['stripe-integration', 'subscription-billing', 'payment-processing'],
	'database-complete': ['database-architect', 'drizzle-orm', 'migration-specialist'],
	'testing-complete': ['test-architect', 'e2e-testing', 'integration-testing'],
	'realtime-complete': ['realtime-engineer', 'websocket-specialist', 'presence-system'],
};

/**
 * Get skills in correct load order based on dependencies
 */
export function getSkillLoadOrder(skills: string[]): string[] {
	const ordered: string[] = [];
	const visited = new Set<string>();
	const visiting = new Set<string>(); // For cycle detection

	function visit(skill: string): void {
		if (visited.has(skill)) return;
		if (visiting.has(skill)) {
			// Cycle detected, just add it
			console.warn(`Circular dependency detected for skill: ${skill}`);
			return;
		}

		visiting.add(skill);

		const deps = SKILL_DEPENDENCIES[skill] || [];
		for (const dep of deps) {
			// Only visit if the dependency is in our skill list
			if (skills.includes(dep)) {
				visit(dep);
			}
		}

		visiting.delete(skill);
		visited.add(skill);
		ordered.push(skill);
	}

	for (const skill of skills) {
		visit(skill);
	}

	return ordered;
}

/**
 * Check if skill dependencies are satisfied
 */
export function checkDependencies(
	skillId: string,
	loadedSkills: Set<string>
): { satisfied: boolean; missing: string[] } {
	const deps = SKILL_DEPENDENCIES[skillId] || [];
	const missing = deps.filter(d => !loadedSkills.has(d));

	return {
		satisfied: missing.length === 0,
		missing
	};
}

/**
 * Get all dependencies for a skill (recursive)
 */
export function getAllDependencies(skillId: string): string[] {
	const all = new Set<string>();
	const visited = new Set<string>();

	function collect(skill: string): void {
		if (visited.has(skill)) return;
		visited.add(skill);

		const deps = SKILL_DEPENDENCIES[skill] || [];
		for (const dep of deps) {
			all.add(dep);
			collect(dep);
		}
	}

	collect(skillId);
	return Array.from(all);
}

/**
 * Expand skill groups into individual skills
 */
export function expandSkillGroup(groupId: string): string[] {
	return SKILL_GROUPS[groupId] || [groupId];
}

/**
 * Get recommended skill group for a given skill
 */
export function getSkillGroup(skillId: string): string | null {
	for (const [groupId, skills] of Object.entries(SKILL_GROUPS)) {
		if (skills.includes(skillId)) {
			return groupId;
		}
	}
	return null;
}
