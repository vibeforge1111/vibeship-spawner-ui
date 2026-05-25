import { readFile } from 'node:fs/promises';
import path from 'node:path';

const artifactDir = path.resolve(process.argv[2] || 'creator-artifacts/spark-qa-operator-benchmark');

const requiredFiles = [
  'benchmark_creator_prd.json',
  'benchmark_creator_prd.md',
  'artifact_manifest.json',
  'benchmark_pack.json',
  'evidence_ladder.md',
  'promotion_bridge.template.json',
  'autoloop_policy.json',
  'validation-ledger.json',
  'validation_ledger.jsonl',
  'domain_chip_contract.json',
  'specialization_path.json',
  'canvas_kanban_plan.json',
  'swarm_publish_packet.json',
  'creator_intent.json',
  'benchmark_level_contract.json',
  'adapter_map.json',
  'source_lane_map.json',
  'local_private_boundary.json',
  'hidden_heldout_manifest.json',
  'trap_manifest.json',
  'research_pattern_map.json',
  'runner_contract.json',
  'wrapper_raw_reconciliation.template.json',
  'sidecar_review.template.json',
  'score_reconciliation.template.json',
  'promotion_dossier.template.json',
  'promotion_boundary.json',
  'swarm_contribution_packet.json',
  'spark_swarm_future_bridge.json',
  'longrun_stability_plan.json',
  'benchmark_pack_scaffold.json',
  'creator-mission-status.json'
];

async function readJson(file) {
  return JSON.parse(await readFile(path.join(artifactDir, file), 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const prd = await readJson('benchmark_creator_prd.json');
const manifest = await readJson('artifact_manifest.json');
const pack = await readJson('benchmark_pack.json');
const bridge = await readJson('promotion_bridge.template.json');
const policy = await readJson('autoloop_policy.json');
const ledger = await readJson('validation-ledger.json');
const chip = await readJson('domain_chip_contract.json');
const pathSpec = await readJson('specialization_path.json');
const canvas = await readJson('canvas_kanban_plan.json');
const swarm = await readJson('swarm_publish_packet.json');
const creatorIntent = await readJson('creator_intent.json');
const levelContract = await readJson('benchmark_level_contract.json');
const adapterMap = await readJson('adapter_map.json');
const sourceLaneMap = await readJson('source_lane_map.json');
const localPrivateBoundary = await readJson('local_private_boundary.json');
const hiddenHeldout = await readJson('hidden_heldout_manifest.json');
const trapManifest = await readJson('trap_manifest.json');
const researchPatternMap = await readJson('research_pattern_map.json');
const runnerContract = await readJson('runner_contract.json');
const wrapperRaw = await readJson('wrapper_raw_reconciliation.template.json');
const sidecarReview = await readJson('sidecar_review.template.json');
const scoreReconciliation = await readJson('score_reconciliation.template.json');
const promotionDossier = await readJson('promotion_dossier.template.json');
const promotionBoundary = await readJson('promotion_boundary.json');
const swarmContribution = await readJson('swarm_contribution_packet.json');
const sparkSwarmBridge = await readJson('spark_swarm_future_bridge.json');
const longrunPlan = await readJson('longrun_stability_plan.json');
const scaffold = await readJson('benchmark_pack_scaffold.json');
const status = await readJson('creator-mission-status.json');
const jsonl = await readFile(path.join(artifactDir, 'validation_ledger.jsonl'), 'utf8');

for (const file of requiredFiles) {
  await readFile(path.join(artifactDir, file), 'utf8');
}

assert(prd.schema_version === 'spark-benchmark-creator-prd.v1', 'PRD schema mismatch');
assert(prd.specialization_path_id === 'spark-qa-operator', 'wrong specialization path');
assert(prd.benchmark_level === 10, 'benchmark level must be 10');
assert(prd.creator_intent?.privacy_mode === 'local_only', 'privacy mode must be local_only');
assert(prd.creator_intent?.risk_level === 'high', 'risk level must be high');
assert(prd.benchmark_execution_contract?.score_source === 'fresh benchmark runner artifact only', 'score source boundary missing');

const requiredSplits = ['visible', 'heldout', 'hidden_heldout', 'trap', 'system', 'adversarial', 'mutation', 'human_swarm_adjudication'];
for (const split of requiredSplits) {
  assert(Array.isArray(pack.splits?.[split]) && pack.splits[split].length > 0, `missing split ${split}`);
}

const cases = Array.isArray(pack.cases) ? pack.cases : [];
assert(cases.some((testCase) => testCase.case_type === 'anti_hallucination'), 'missing anti-hallucination case');
assert(cases.some((testCase) => testCase.case_type === 'tool_use'), 'missing tool-use case');
assert(cases.some((testCase) => testCase.case_type === 'source_conflict_reasoning'), 'missing source-conflict case');
assert(cases.every((testCase) => Array.isArray(testCase.source_lanes) && testCase.source_lanes.length > 0), 'case missing source lanes');

const manifestPaths = new Set((manifest.artifacts || []).map((artifact) => artifact.path));
for (const file of [
  'benchmark_creator_prd.json',
  'benchmark_pack.json',
  'autoloop_policy.json',
  'promotion_bridge.template.json',
  'swarm_publish_packet.json',
  'benchmark_pack_scaffold.json',
  'hidden_heldout_manifest.json',
  'wrapper_raw_reconciliation.template.json',
  'sidecar_review.template.json',
  'swarm_contribution_packet.json',
  'spark_swarm_future_bridge.json',
  'promotion_dossier.template.json',
  'score_reconciliation.template.json',
  'longrun_stability_plan.json'
]) {
  assert(manifestPaths.has(file), `manifest missing ${file}`);
}

assert(bridge.evidence_lane === 'benchmark_grounded', 'promotion bridge must use benchmark_grounded lane');
assert(bridge.metric_value === null, 'promotion bridge must not contain a score');
assert(policy.bounded_rounds === true && policy.pause_resume_required === true, 'autoloop policy must be bounded and resumable');
assert(chip.routing?.positive_keywords?.length >= 3, 'domain chip routing keywords missing');
assert(pathSpec.stages?.length >= 5, 'specialization path stages missing');
assert(canvas.no_instant_completion_claim === true, 'Canvas/Kanban no-instant-completion boundary missing');
assert(swarm.network_absorbable === false && swarm.public_ready === false && swarm.payload_ready === false, 'Swarm packet must remain local and not ready');
assert(status.publication?.network_absorbable === false, 'status packet must keep network_absorbable false');
assert(ledger.benchmark_evidence?.baseline_score === null && ledger.benchmark_evidence?.candidate_score === null, 'ledger must not claim scores');
assert(ledger.held_out_verdict === 'blocked', 'held-out verdict must remain blocked before scoring');
assert(jsonl.trim().split('\n').length >= 5, 'jsonl ledger needs checkpoint entries');

const level10Splits = ['visible', 'heldout', 'trap', 'system', 'audit', 'longrun', 'fresh'];
assert(creatorIntent.schemaVersion === 'spark-creator-intent.v1', 'canonical creator intent missing');
assert(creatorIntent.scoreStatus === 'not_scored', 'creator intent must remain not_scored');
assert(levelContract.schemaVersion === 'spark-benchmark-level-contract.v1', 'benchmark level contract schema mismatch');
assert(levelContract.selectedLevel === 10, 'canonical level contract must be level 10');
for (const split of level10Splits) {
  assert(levelContract.requiredSplits?.includes(split), `level contract missing ${split}`);
  assert(scaffold.splits?.includes(split), `benchmark scaffold missing ${split}`);
}
assert(scaffold.schemaVersion === 'spark-benchmark-pack-scaffold.v1', 'benchmark scaffold schema mismatch');
assert(scaffold.caseCount >= 50, 'level-10 scaffold must define at least 50 case blueprints');
assert(scaffold.scoringContract?.scoreClaimAllowed === false, 'scaffold must block score claims by default');
assert(adapterMap.systems?.includes('spark_swarm_future'), 'adapter map must include future Spark Swarm bridge');
assert(sourceLaneMap.laneBindingRequired === true, 'source lane binding must be required');
assert(localPrivateBoundary.public_ready === false && localPrivateBoundary.network_absorbable === false, 'local private boundary must block publication');
assert(localPrivateBoundary.score_claim_allowed === false && localPrivateBoundary.improvement_claim_allowed === false, 'local private boundary must block score/improvement claims');
assert(hiddenHeldout.schemaVersion === 'spark-hidden-heldout-manifest.v1', 'hidden heldout manifest schema mismatch');
assert(hiddenHeldout.answerKeysIncluded === false && hiddenHeldout.candidateVisible === false && hiddenHeldout.rawAnswersIncluded === false, 'hidden heldout answers must stay sealed');
assert(JSON.stringify(hiddenHeldout.sealedCaseRefs || []).includes('expectedAnswer') === false, 'sealed heldout refs must not contain expected answers');
assert(trapManifest.trapFamilies?.includes('fake_score_claim'), 'trap manifest must include fake score traps');
assert(researchPatternMap.appliedPatterns?.includes('wrapper/raw reconciliation'), 'research map must include wrapper/raw pattern');
assert(runnerContract.preparedEvidenceValidationIsNotCapabilityScore === true, 'runner contract must separate fixture validation from capability scoring');
assert(wrapperRaw.status === 'not_reconciled' && wrapperRaw.scoreClaimAllowed === false, 'wrapper/raw reconciliation must start blocked');
assert(sidecarReview.reviewRequired === true && sidecarReview.reviewStatus === 'pending' && sidecarReview.noSelfApproval === true, 'sidecar review must require independent pending review');
assert(scoreReconciliation.status === 'not_reconciled' && scoreReconciliation.scoreClaimAllowed === false, 'score reconciliation must block claims');
assert(promotionDossier.eligibility_status === 'not_eligible' && promotionDossier.scoreClaimAllowed === false, 'promotion dossier must remain not eligible');
assert(promotionBoundary.public_ready === false && promotionBoundary.improvement_claim_allowed === false, 'promotion boundary must block public/improvement claims');
assert(swarmContribution.exportStatus === 'draft_private' && swarmContribution.networkAbsorbable === false, 'swarm contribution must remain private draft');
assert(sparkSwarmBridge.bridgeStatus === 'future_bridge_draft' && sparkSwarmBridge.networkAbsorbable === false, 'Spark Swarm bridge must remain private future draft');
assert(longrunPlan.status === 'planned' && longrunPlan.noCapabilityClaim === true, 'longrun stability plan must avoid capability claims');

console.log(JSON.stringify({
  ok: true,
  artifactDir,
  files: requiredFiles.length,
  cases: cases.length,
  splits: requiredSplits.length,
  scoreStatus: 'not_scored',
  level10CaseBlueprints: scaffold.caseCount,
  level10Splits,
  nextGate: 'fresh benchmark runner artifact'
}, null, 2));
