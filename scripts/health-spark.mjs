const baseUrl = (process.env.SPAWNER_UI_URL || "http://127.0.0.1:5173").replace(/\/$/, "");
const healthUrl = `${baseUrl}/api/providers`;

async function main() {
  let response;
  try {
    response = await fetch(healthUrl, {
      headers: {
        accept: "application/json",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot reach ${healthUrl}: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`GET ${healthUrl} returned ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.providers)) {
    throw new Error("provider payload missing providers[]");
  }

  const configuredCount = payload.providers.filter(
    (provider) => provider && provider.envKeyConfigured === true,
  ).length;

  console.log(
    `Spawner UI healthy: ${baseUrl} (${payload.providers.length} providers listed, ${configuredCount} configured)`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Spawner UI unhealthy: ${message}`);
  process.exitCode = 1;
});
