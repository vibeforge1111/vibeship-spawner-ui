import { readFileSync } from "node:fs";

const spawnerEnvPath = readArg("--spawner-env");
const botEnvPath = readArg("--bot-env");
const checks = [];
const proConnectionEnv = ["SPARK_PRO", "CONNECTION", "TOKEN"].join("_");
const legacyProBearerEnv = ["SPARK_PRO", "BEARER", "TOKEN"].join("_");

if (!spawnerEnvPath || !botEnvPath) {
  fail("usage", "node scripts/check-deploy-pair.mjs --spawner-env ./spawner.env --bot-env ./bot.env");
} else {
  const spawner = loadEnvFile(spawnerEnvPath);
  const bot = loadEnvFile(botEnvPath);

  sameValue(spawner, bot, "SPARK_WORKSPACE_ID");
  sameValue(spawner, bot, "SPARK_BRIDGE_API_KEY");
  sameValue(spawner, bot, "SPARK_UI_API_KEY");
  sameValue(spawner, bot, "TELEGRAM_RELAY_SECRET");
  differentValues(spawner, "SPARK_UI_API_KEY", "SPARK_BRIDGE_API_KEY");
  differentValues(spawner, "SPARK_UI_API_KEY", "TELEGRAM_RELAY_SECRET");
  differentValues(spawner, "SPARK_BRIDGE_API_KEY", "TELEGRAM_RELAY_SECRET");

  includesCsv(spawner, "MISSION_CONTROL_WEBHOOK_URLS", bot.TELEGRAM_RELAY_URL);
  requirePublicUrl(bot, "SPAWNER_UI_PUBLIC_URL");
  const spawnerUrlKey = bot.SPAWNER_UI_URL ? "SPAWNER_UI_URL" : "SPARK_SPAWNER_URL";
  requirePrivateOrLocalUrl(bot, spawnerUrlKey);
  if (!bot.SPAWNER_UI_URL && bot.SPARK_SPAWNER_URL) {
    warn("SPARK_SPAWNER_URL", "compatibility alias accepted; prefer SPAWNER_UI_URL in new docs");
  }

  if (spawner[proConnectionEnv] || spawner[legacyProBearerEnv]) {
    warn("spawner SPARK_PRO_* token", "remove unless running an internal compatibility smoke");
  }
  if (bot[proConnectionEnv] || bot[legacyProBearerEnv]) {
    warn("bot SPARK_PRO_* token", "remove unless running an internal compatibility smoke");
  }
}

for (const check of checks) {
  const label = check.status.toUpperCase().padEnd(4);
  console.log(`${label} ${check.name}: ${check.detail}`);
}

const failed = checks.filter((check) => check.status === "fail");
const warned = checks.filter((check) => check.status === "warn");
console.log(`\nSpark deploy pair check: ${failed.length} failed, ${warned.length} warned, ${checks.length} checked.`);
process.exitCode = failed.length ? 1 : 0;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function loadEnvFile(filePath) {
  const values = {};
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    values[key] = stripEnvQuotes(rawValue.trim());
  }
  return values;
}

function stripEnvQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function sameValue(left, right, key) {
  if (!left[key] || !right[key]) {
    fail(key, "missing from one or both env files");
    return;
  }
  if (looksPlaceholder(left[key]) || looksPlaceholder(right[key])) {
    fail(key, "replace placeholder value");
    return;
  }
  if (left[key] !== right[key]) {
    fail(key, "must match between Spawner and bot");
    return;
  }
  ok(key, "matches");
}

function differentValues(values, first, second) {
  if (!values[first] || !values[second]) return;
  if (looksPlaceholder(values[first]) || looksPlaceholder(values[second])) return;
  if (values[first] === values[second]) {
    fail(`${first}/${second}`, "must be different secrets");
    return;
  }
  ok(`${first}/${second}`, "different secrets");
}

function includesCsv(values, key, expected) {
  if (!values[key] || !expected) {
    fail(key, "missing callback or expected bot relay URL");
    return;
  }
  if (looksPlaceholder(values[key]) || looksPlaceholder(expected)) {
    fail(key, "replace placeholder value");
    return;
  }
  const urls = values[key].split(",").map((value) => value.trim()).filter(Boolean);
  if (!urls.includes(expected)) {
    fail(key, "must include bot TELEGRAM_RELAY_URL");
    return;
  }
  ok(key, "includes bot relay URL");
}

function requirePublicUrl(values, key) {
  const value = values[key] || "";
  if (!value) {
    fail(key, "missing");
    return;
  }
  if (looksPlaceholder(value)) {
    fail(key, "replace placeholder value");
    return;
  }
  if (!validUrl(value)) {
    fail(key, "must be a valid URL");
    return;
  }
  if (new URL(value).protocol !== "https:") {
    fail(key, "public URL must use https");
    return;
  }
  if (isPrivateRailwayUrl(value) || isDockerPrivateHost(value)) {
    fail(key, "must be a public browser URL");
    return;
  }
  ok(key, "public URL");
}

function requirePrivateOrLocalUrl(values, key) {
  const value = values[key] || "";
  if (!value) {
    fail(key, "missing");
    return;
  }
  if (looksPlaceholder(value)) {
    fail(key, "replace placeholder value");
    return;
  }
  if (!validUrl(value)) {
    fail(key, "must be a valid URL");
    return;
  }
  if (isPrivateRailwayUrl(value) && !hasExplicitPort(value)) {
    fail(key, "Railway private DNS needs an explicit port");
    return;
  }
  ok(key, isPrivateRailwayUrl(value) || isDockerPrivateHost(value) ? "private URL" : "local/public URL");
}

function isPrivateRailwayUrl(value) {
  return /\.railway\.internal(?::\d+)?(?:\/|$)/.test(value);
}

function looksPlaceholder(value) {
  return /<[^>]+>|your[_-]|changeme|replace[_-]?me|example\.com|private-non-guessable/i.test(value);
}

function validUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isDockerPrivateHost(value) {
  try {
    const hostname = new URL(value).hostname;
    return !hostname.includes(".") && hostname !== "localhost";
  } catch {
    return false;
  }
}

function hasExplicitPort(value) {
  try {
    return Boolean(new URL(value).port);
  } catch {
    return false;
  }
}

function ok(name, detail) {
  checks.push({ status: "ok", name, detail });
}

function warn(name, detail) {
  checks.push({ status: "warn", name, detail });
}

function fail(name, detail) {
  checks.push({ status: "fail", name, detail });
}
