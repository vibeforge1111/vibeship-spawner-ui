const assert = require('node:assert/strict');
const test = require('node:test');

const { summariesFromManifest } = require('./sync-spark-skill-graphs.cjs');

test('maps a Spark portable manifest into Spawner skill summaries', () => {
	const summaries = summariesFromManifest({
		schema_version: 'spark.skill.manifest.v1',
		skills: [
			{
				id: 'auth-workflows',
				name: 'Auth Workflows',
				description: 'Design login and session workflows.',
				category: 'backend',
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
	assert.equal(auth.selectionHints.boost_terms[0], 'authentication');
});
