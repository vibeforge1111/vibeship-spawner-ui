const assert = require('node:assert/strict');
const test = require('node:test');

const { buildIndexes, processManifestSkill } = require('./build-skill-index.cjs');

test('builds matcher indexes from Spark standard manifest skills', () => {
  const records = [
    processManifestSkill({
      id: 'auth-workflows',
      name: 'Auth Workflows',
      description: 'Design login, signup, recovery, session, and permission flows.',
      category: 'backend',
      owns: ['Authentication flow design'],
      tags: ['auth'],
      triggers: ['secure login'],
      selection_hints: {
        aliases: ['login'],
        boost_terms: ['authentication']
      },
      delegates: [
        {
          skill: 'audit-log',
          target_id: 'audit-log',
          when: 'Auth events need security traceability.',
          resolved: true
        },
        {
          skill: 'missing-skill',
          when: 'Unknown downstream need.',
          resolved: false
        }
      ]
    }),
    processManifestSkill({
      id: 'audit-log',
      name: 'Audit Log',
      description: 'Capture append-only security and data-change events.',
      category: 'backend',
      owns: ['Event actor, target, and diff capture'],
      tags: ['audit'],
      triggers: ['audit trail'],
      selection_hints: {},
      delegates: []
    })
  ];

  const { minimalOutput, fullDetails, matcherCatalog } = buildIndexes(records);

  assert.equal(minimalOutput.totalSkills, 2);
  assert.equal(fullDetails['auth-workflows'].delegates.length, 1);
  assert.equal(fullDetails['auth-workflows'].delegates[0].skill, 'audit-log');
  assert.equal(matcherCatalog['auth-workflows'].selectionHints.aliases[0], 'login');
  assert.equal(matcherCatalog['auth-workflows'].triggers.includes('secure login'), true);
});

test('normalizes structured Spark owns metadata for Spawner matching', () => {
  const record = processManifestSkill({
    id: 'usage-metering-entitlements',
    name: 'Usage Metering Entitlements',
    description: 'Design quota, entitlement, and usage billing boundaries.',
    category: 'payments',
    owns: [
      { decision_authority: 'Quota model, entitlement boundaries, and usage counters' },
      { capability: 'Billing limit enforcement' },
      'Plan upgrade prompts'
    ],
    tags: ['billing', 'quota'],
    triggers: ['usage limits'],
    selection_hints: {}
  });

  const { minimalOutput, fullDetails, matcherCatalog } = buildIndexes([record]);

  assert.deepEqual(fullDetails['usage-metering-entitlements'].owns, [
    'Quota model, entitlement boundaries, and usage counters',
    'Billing limit enforcement',
    'Plan upgrade prompts'
  ]);
  assert.equal(minimalOutput.flat[0].kw.includes('quota'), true);
  assert.deepEqual(matcherCatalog['usage-metering-entitlements'].owns, [
    'Quota model, entitlement boundaries, and usage counters',
    'Billing limit enforcement',
    'Plan upgrade prompts'
  ]);
});
