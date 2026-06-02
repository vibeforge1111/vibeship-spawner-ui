#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const artifactDir = path.join(root, 'creator-artifacts', 'spark-grants-contracts-v1');

const requiredFiles = [
  'mission_packet.json',
  'creator_intent.json',
  'artifact_manifest.json',
  'contracts_v1_outline.json',
  'validation-ledger.json',
  'verification_plan.md'
];

async function readJson(fileName) {
  const content = await readFile(path.join(artifactDir, fileName), 'utf8');
  return JSON.parse(content);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

await check('required files exist and parse', async () => {
  for (const fileName of requiredFiles) {
    const content = await readFile(path.join(artifactDir, fileName), 'utf8');
    assert(content.trim().length > 0, `${fileName} is empty`);
    if (fileName.endsWith('.json')) JSON.parse(content);
  }
  return `${requiredFiles.length} files`;
});

const mission = await readJson('mission_packet.json');
const intent = await readJson('creator_intent.json');
const manifest = await readJson('artifact_manifest.json');
const contracts = await readJson('contracts_v1_outline.json');
const ledger = await readJson('validation-ledger.json');
const verificationPlan = await readFile(path.join(artifactDir, 'verification_plan.md'), 'utf8');

await check('mission is staged and local-only', async () => {
  assert(mission.schema_version === 'spark-spawner-staged-mission.v1', 'unexpected mission schema');
  assert(mission.execution_policy === 'read_only', 'mission must be read_only');
  assert(mission.privacy_mode === 'local_only', 'mission must be local_only');
  assert(mission.network_absorbable === false, 'mission must not be network absorbable');
  assert(mission.public_ready === false, 'mission must not be public-ready');
  assert(Array.isArray(mission.tasks) && mission.tasks.length >= 5, 'mission needs at least 5 tasks');
  return `${mission.tasks.length} tasks`;
});

await check('planning decisions match Telegram context', async () => {
  assert(mission.recommended_v1_decisions.account.choice.includes('Spark_coded'), 'Spark_coded must be v1 account choice');
  assert(mission.recommended_v1_decisions.account.reason.includes('BookofAgents'), 'BookofAgents must be addressed');
  assert(mission.recommended_v1_decisions.wl_wording.choice.includes('WL spots'), 'WL spots must be default copy');
  assert(mission.recommended_v1_decisions.wl_wording.choice.includes('free WLs'), 'free WLs condition must be addressed');
  assert(
    mission.recommended_v1_decisions.contracts_timing.choice.toLowerCase().includes('before'),
    'contracts must come before public CTA/allocation promises'
  );
  return 'account, WL wording, and contract timing recorded';
});

await check('contract outline blocks unsafe public copy', async () => {
  assert(contracts.schema_version === 'spark-grants-contract-outline.v1', 'unexpected contract outline schema');
  assert(contracts.legal_review_required === true, 'legal review must be required');
  assert(contracts.public_use_allowed === false, 'public use must be blocked');
  assert(contracts.default_public_phrase === 'WL spots', 'default public phrase must be WL spots');
  assert(contracts.free_wl_phrase_allowed === false, 'free WL phrase must be blocked');
  assert(Array.isArray(contracts.recommended_contracts) && contracts.recommended_contracts.length >= 4, 'contract pack is incomplete');
  return `${contracts.recommended_contracts.length} contract outlines`;
});

await check('manifest references every required artifact', async () => {
  assert(manifest.schema_version === 'spark-artifact-manifest.v1', 'unexpected manifest schema');
  assert(manifest.network_absorbable === false, 'manifest must not be network absorbable');
  const paths = new Set((manifest.artifacts || []).map((artifact) => artifact.path));
  for (const fileName of requiredFiles) {
    assert(paths.has(fileName), `manifest missing ${fileName}`);
  }
  return `${paths.size} manifest paths`;
});

await check('creator intent stays workspace-only', async () => {
  assert(intent.schema_version === 'spark-creator-intent.v1', 'unexpected creator intent schema');
  assert(intent.privacy_mode === 'local_only', 'intent must be local_only');
  assert(intent.network_contribution_policy === 'workspace_only', 'intent must be workspace_only');
  assert(intent.desired_outputs.spawner_mission === true, 'intent must request spawner_mission');
  assert(intent.desired_outputs.swarm_publish_packet === false, 'intent must not request swarm publish');
  return intent.target_domain;
});

await check('validation ledger records blockers', async () => {
  assert(ledger.schema_version === 'spark-grants-validation-ledger.v1', 'unexpected ledger schema');
  assert(ledger.automation_blocked === true, 'automation must be blocked');
  assert(Array.isArray(ledger.checks) && ledger.checks.length >= 6, 'ledger checks are incomplete');
  assert(Array.isArray(ledger.blockers) && ledger.blockers.length >= 3, 'ledger blockers are incomplete');
  return `${ledger.checks.length} checks`;
});

await check('verification plan includes voice proof commands', async () => {
  const requiredVoiceKeys = [
    'SPARK_VOICE_QA_DELIVERY_OK_AFTER_RESTART',
    'SPARK_VOICE_QA_DELIVERY_OK_ENVELOPE_FIX',
    'SPARK_VOICE_QA_DELIVERY_OK_OWNER_FIX',
    'SPARK_VOICE_QA_DELIVERY_OK_STATE_FIX'
  ];
  for (const key of requiredVoiceKeys) {
    assert(verificationPlan.includes(key), `verification plan missing ${key}`);
  }
  return `${requiredVoiceKeys.length} voice proof keys`;
});

for (const result of checks) {
  const line = result.ok ? `PASS ${result.name}` : `FAIL ${result.name}`;
  const stream = result.ok ? console.log : console.error;
  stream(`${line}: ${result.detail}`);
}

if (checks.some((result) => !result.ok)) {
  process.exitCode = 1;
}
