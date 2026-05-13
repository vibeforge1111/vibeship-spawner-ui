import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnerStateDir } from './spawner-state';

export const RAW_PROVIDER_OUTPUT_RETENTION_ENV = 'SPARK_SPAWNER_RETAIN_RAW_PROVIDER_OUTPUT';

export interface ProviderOutputPrivateArchiveMetadata {
	schema_version: 'spark.spawner_provider_output_private_archive.v1';
	missionId: string;
	providerId: string;
	responsePresent: boolean;
	responseLength: number;
	rawOutputStored: boolean;
	rawOutputFile: string;
	redaction: string;
	createdAt: string;
}

function safeFileSegment(value: string): string {
	return (
		value
			.trim()
			.replace(/[^A-Za-z0-9._-]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 120) || 'unknown'
	);
}

export function retainRawProviderOutput(env: Record<string, string | undefined> = process.env): boolean {
	return env[RAW_PROVIDER_OUTPUT_RETENTION_ENV] === '1';
}

export function writeProviderOutputPrivateArchive(
	input: {
		missionId: string;
		providerId: string;
		response: string | null | undefined;
	},
	env: Record<string, string | undefined> = process.env
): ProviderOutputPrivateArchiveMetadata | null {
	const response = typeof input.response === 'string' ? input.response : '';
	if (!response.trim() || !retainRawProviderOutput(env)) return null;

	const stateDir = spawnerStateDir();
	const outputDir = path.join(stateDir, 'provider-output-private');
	const metadataDir = path.join(stateDir, 'provider-output-metadata');
	if (!existsSync(outputDir)) {
		mkdirSync(outputDir, { recursive: true });
	}
	if (!existsSync(metadataDir)) {
		mkdirSync(metadataDir, { recursive: true });
	}

	const fileStem = `${safeFileSegment(input.missionId)}-${safeFileSegment(input.providerId)}`;
	const rawOutputFile = `${fileStem}.txt`;
	writeFileSync(path.join(outputDir, rawOutputFile), response, 'utf-8');

	const metadata: ProviderOutputPrivateArchiveMetadata = {
		schema_version: 'spark.spawner_provider_output_private_archive.v1',
		missionId: input.missionId,
		providerId: input.providerId,
		responsePresent: true,
		responseLength: response.length,
		rawOutputStored: true,
		rawOutputFile,
		redaction: `local-private opt-in raw provider output retention enabled by ${RAW_PROVIDER_OUTPUT_RETENTION_ENV}; not exported to mission-provider-results, traces, Cockpit, or read models`,
		createdAt: new Date().toISOString()
	};
	writeFileSync(path.join(metadataDir, `${fileStem}.json`), JSON.stringify(metadata, null, 2), 'utf-8');
	return metadata;
}
