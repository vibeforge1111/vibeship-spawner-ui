import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	ProjectPreviewError,
	assertProjectPreviewHost,
	mimeTypeForProjectPreview,
	resolveProjectPreviewAsset
} from '$lib/server/project-preview';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		assertProjectPreviewHost(url);
		const asset = resolveProjectPreviewAsset({ token: params.token });
		return new Response(await readFile(asset.filePath), {
			headers: {
				'content-type': mimeTypeForProjectPreview(asset.filePath),
				'cache-control': 'no-store',
				'x-spark-preview-root': asset.projectRoot
			}
		});
	} catch (e) {
		if (e instanceof ProjectPreviewError) {
			throw error(e.status, e.message);
		}
		throw e;
	}
};
