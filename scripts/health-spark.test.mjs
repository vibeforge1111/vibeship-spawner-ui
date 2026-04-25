import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { resolveSparkWorkspaceRoot } from "./health-spark.mjs";

describe("resolveSparkWorkspaceRoot", () => {
  it("prefers explicit Spark workspace roots", () => {
    expect(
      resolveSparkWorkspaceRoot({
        SPARK_WORKSPACE_ROOT: "/tmp/explicit",
        SPAWNER_WORKSPACE_ROOT: "/tmp/spawner",
        SPARK_HOME: "/tmp/spark-home",
      }),
    ).toBe("/tmp/explicit");
  });

  it("uses SPARK_HOME for sandboxed installs", () => {
    expect(
      resolveSparkWorkspaceRoot({
        SPARK_HOME: "/tmp/spark-home",
      }),
    ).toBe(join("/tmp/spark-home", "workspaces"));
  });

  it("falls back to the user Spark home only when no sandbox is provided", () => {
    expect(resolveSparkWorkspaceRoot({}, "/home/example")).toBe(join("/home/example", ".spark", "workspaces"));
  });
});

describe("health-spark command", () => {
  it("fails when mission webhook lacks relay secret", () => {
    const result = spawnSync(process.execPath, ["scripts/health-spark.mjs"], {
      cwd: join(import.meta.dirname, ".."),
      env: {
        ...process.env,
        MISSION_CONTROL_WEBHOOK_URLS: "http://127.0.0.1:8788/spawner-events",
        TELEGRAM_RELAY_SECRET: "",
      },
      encoding: "utf-8",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("TELEGRAM_RELAY_SECRET is missing");
  });
});
