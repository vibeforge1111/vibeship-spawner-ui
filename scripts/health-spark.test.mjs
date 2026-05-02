import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  healthRequiresCodex,
  resolveHealthMissionProvider,
  resolveSparkWorkspaceRoot,
  shouldRepairHostedWorkspaceOwnership,
  sparkHealthAuthHeaders,
} from "./health-spark.mjs";

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

describe("healthRequiresCodex", () => {
  it("does not require Codex just because the provider is listed", () => {
    expect(
      healthRequiresCodex([{ id: "codex", configured: false, cliConfigured: false }], {
        DEFAULT_MISSION_PROVIDER: "zai",
      }),
    ).toBe(false);
  });

  it("requires Codex when it is the selected mission provider", () => {
    expect(
      healthRequiresCodex([{ id: "codex", configured: false, cliConfigured: false }], {
        DEFAULT_MISSION_PROVIDER: "codex",
      }),
    ).toBe(true);
  });

  it("requires Codex when the provider is actually configured", () => {
    expect(healthRequiresCodex([{ id: "codex", cliConfigured: true }], {})).toBe(true);
  });

  it("does not let configured Codex override an explicit hosted mission provider", () => {
    expect(
      healthRequiresCodex([{ id: "codex", cliConfigured: true }], {
        DEFAULT_MISSION_PROVIDER: "minimax",
      }),
    ).toBe(false);
  });
});

describe("resolveHealthMissionProvider", () => {
  it("prefers the explicit health smoke provider", () => {
    expect(
      resolveHealthMissionProvider({
        SPARK_HEALTH_PROVIDER: "zai",
        DEFAULT_MISSION_PROVIDER: "codex",
      }),
    ).toBe("zai");
  });

  it("uses the selected mission provider before falling back to Codex", () => {
    expect(resolveHealthMissionProvider({ DEFAULT_MISSION_PROVIDER: "minimax" })).toBe("minimax");
    expect(resolveHealthMissionProvider({})).toBe("codex");
  });
});

describe("sparkHealthAuthHeaders", () => {
  it("uses the hosted UI key for local private health probes", () => {
    expect(sparkHealthAuthHeaders({ SPARK_UI_API_KEY: "ui", SPARK_BRIDGE_API_KEY: "bridge" })).toEqual({
      "x-spawner-ui-key": "ui",
      "x-api-key": "ui",
    });
  });

  it("falls back to the bridge key when no UI key is configured", () => {
    expect(sparkHealthAuthHeaders({ SPARK_BRIDGE_API_KEY: "bridge" })).toEqual({
      "x-spawner-ui-key": "bridge",
      "x-api-key": "bridge",
    });
  });
});

describe("shouldRepairHostedWorkspaceOwnership", () => {
  it("repairs Spark workspaces when health checks are accidentally run as root", () => {
    expect(
      shouldRepairHostedWorkspaceOwnership(
        {
          SPARK_HOME: "/data/spark",
        },
        0,
      ),
    ).toBe(true);
    expect(
      shouldRepairHostedWorkspaceOwnership(
        {
          SPARK_LIVE_CONTAINER: "1",
          SPARK_HOME: "/data/spark",
        },
        1001,
      ),
    ).toBe(false);
    expect(
      shouldRepairHostedWorkspaceOwnership(
        {
          SPARK_WORKSPACE_ROOT: "/data/spark/workspaces",
        },
        0,
      ),
    ).toBe(true);
    expect(shouldRepairHostedWorkspaceOwnership({}, 0)).toBe(false);
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
