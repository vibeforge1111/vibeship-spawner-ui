import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	ProjectPreviewError,
	assertProjectPreviewHost,
	mimeTypeForProjectPreview,
	resolveProjectPreviewAsset,
	rewriteProjectPreviewHtml
} from '$lib/server/project-preview';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		assertProjectPreviewHost(url);
		const asset = resolveProjectPreviewAsset({ token: params.token });
		const body = await readFile(asset.filePath, 'utf-8');
		const contentType = mimeTypeForProjectPreview(asset.filePath);
		return new Response(
			contentType.startsWith('text/html') ? rewriteProjectPreviewHtml(body, params.token) : body,
			{
			headers: {
				'content-type': contentType,
				'cache-control': 'no-store',
				'x-spark-preview-root': asset.projectRoot
			}
			}
		);
	} catch (e) {
		if (e instanceof ProjectPreviewError) {
			throw error(e.status, e.message);
		}
		throw e;
	}
};
