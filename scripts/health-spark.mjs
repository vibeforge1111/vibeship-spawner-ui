import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const baseUrl = (process.env.SPAWNER_UI_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const healthUrl = `${baseUrl}/api/providers`;
const boardUrl = `${baseUrl}/api/mission-control/board`;

function resolveCli(binaryName) {
  const upper = binaryName.toUpperCase();
  const configured =
    process.env[`${upper}_PATH`] ||
    process.env[`SPARK_${upper}_PATH`] ||
    process.env[`SPAWNER_${upper}_PATH`];
  if (configured && configured.trim()) return configured.trim();

  try {
    const locator = process.platform === "win32" ? "where.exe" : "which";
    const output = execFileSync(locator, [binaryName], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true,
      timeout: 5000,
    });
    const matches = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (process.platform === "win32") {
      return matches.find((line) => line.toLowerCase().endsWith(".cmd")) || matches[0] || null;
    }
    return matches[0] || null;
  } catch {
    return null;
  }
}

async function getJson(url) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot reach ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`GET ${url} returned ${response.status}`);
  }

  return await response.json();
}

async function main() {
  const payload = await getJson(healthUrl);
  if (!payload || !Array.isArray(payload.providers)) {
    throw new Error("provider payload missing providers[]");
  }

  const configuredCount = payload.providers.filter(
    (provider) =>
      provider &&
      (provider.configured === true ||
        provider.envKeyConfigured === true ||
        provider.cliConfigured === true),
  ).length;
  const providerIds = payload.providers
    .map((provider) => provider && provider.id)
    .filter(Boolean);
  const wantsCodex =
    process.env.DEFAULT_MISSION_PROVIDER === "codex" ||
    process.env.SPAWNER_PRD_AUTO_PROVIDER === "codex" ||
    providerIds.includes("codex");
  const codexPath = wantsCodex ? resolveCli("codex") : null;

  if (wantsCodex && !codexPath) {
    throw new Error(
      "Codex provider is listed but codex is not resolvable. Install/login to Codex CLI or set CODEX_PATH.",
    );
  }

  const board = await getJson(boardUrl);
  if (!board || typeof board !== "object") {
    throw new Error("mission board payload is not JSON");
  }

  const workspaceRoot =
    process.env.SPARK_WORKSPACE_ROOT ||
    process.env.SPAWNER_WORKSPACE_ROOT ||
    join(homedir(), ".spark", "workspaces");
  const smokeWorkspace = join(workspaceRoot, ".health-smoke");
  mkdirSync(smokeWorkspace, { recursive: true });
  writeFileSync(join(smokeWorkspace, "write-check.txt"), `spark-health ${new Date().toISOString()}\n`, "utf-8");

  if (process.env.SPARK_HEALTH_DEEP === "1") {
    const requestId = `health-${Date.now()}`;
    const runResponse = await fetch(`${baseUrl}/api/spark/run`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        goal: "Reply with exactly: SPARK_HEALTH_OK",
        providers: ["codex"],
        promptMode: "simple",
        projectPath: smokeWorkspace,
        requestId,
      }),
    });
    if (!runResponse.ok) {
      const text = await runResponse.text().catch(() => "");
      throw new Error(`deep mission smoke failed to start: ${runResponse.status} ${text.slice(0, 300)}`);
    }
  }

  console.log(
    [
      `Spawner UI healthy: ${baseUrl}`,
      `${payload.providers.length} providers listed`,
      `${configuredCount} configured`,
      wantsCodex ? `codex=${codexPath}` : "codex=not-required",
      `workspace=${smokeWorkspace}`,
    ].join(" | "),
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Spawner UI unhealthy: ${message}`);
  process.exitCode = 1;
});
