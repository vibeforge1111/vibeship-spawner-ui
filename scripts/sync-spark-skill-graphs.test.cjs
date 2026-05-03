const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
	FOUNDATION_FREE_SKILL_IDS,
	normalizeSkillTier,
	summariesFromManifest
} = require('./sync-spark-skill-graphs.cjs');

const skillsPath = path.resolve(__dirname, '..', 'static', 'skills.json');

test('maps a Spark portable manifest into Spawner skill summaries', () => {
	const summaries = summariesFromManifest({
		schema_version: 'spark.skill.manifest.v1',
		skills: [
			{
				id: 'auth-workflows',
				name: 'Auth Workflows',
				description: 'Design login and session workflows.',
				category: 'backend',
				tags: ['auth'],
				triggers: ['secure login'],
				owns: ['Login and signup flow design'],
				selection_hints: {
					aliases: ['login', 'signup'],
					boost_terms: ['authentication']
				},
				delegates: [
					{
						skill: 'audit-log',
						target_id: 'audit-log',
						when: 'Admin action changes customer data.',
						resolved: true
					},
					{
						skill: 'missing-skill',
						when: 'Unknown downstream need.',
						resolved: false
					}
				]
			},
			{
				id: 'audit-log',
				name: 'Audit Log',
				description: 'Capture append-only activity trails.',
				category: 'backend',
				owns: ['Audit event capture'],
				selection_hints: {},
				delegates: []
			}
		]
	});

	const auth = summaries.find((skill) => skill.id === 'auth-workflows');

	assert.equal(summaries.length, 2);
	assert.deepEqual(auth.handoffs, [
		{
			trigger: 'Admin action changes customer data.',
			to: 'audit-log'
		}
	]);
	assert.equal(auth.triggers.includes('login'), true);
	assert.equal(auth.triggers.includes('secure login'), true);
	assert.deepEqual(auth.tags, ['auth']);
	assert.equal(auth.selectionHints.boost_terms[0], 'authentication');
});

test('foundation free tier is exactly the 30 public Spark skills', () => {
	const skills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
	const skillIds = new Set(skills.map((skill) => skill.id));

	assert.equal(FOUNDATION_FREE_SKILL_IDS.size, 30);
	for (const id of FOUNDATION_FREE_SKILL_IDS) {
		assert.equal(skillIds.has(id), true, `${id} is missing from static/skills.json`);
		assert.equal(normalizeSkillTier(id), 'free');
	}
});

test('unspecified skills default to Pro while explicit tiers are preserved', () => {
	assert.equal(normalizeSkillTier('webhook-provider-platform'), 'premium');
	assert.equal(normalizeSkillTier('custom-free-skill', 'free'), 'free');
	assert.equal(normalizeSkillTier('custom-pro-skill', 'pro'), 'premium');
	assert.equal(normalizeSkillTier('custom-premium-skill', 'premium'), 'premium');
});
