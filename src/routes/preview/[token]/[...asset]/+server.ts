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
		const asset = resolveProjectPreviewAsset({ token: params.token, assetPath: params.asset });
		const contentType = mimeTypeForProjectPreview(asset.filePath);
		const body = contentType.startsWith('text/html')
			? await readFile(asset.filePath, 'utf-8')
			: await readFile(asset.filePath);
		return new Response(
			contentType.startsWith('text/html') && typeof body === 'string'
				? rewriteProjectPreviewHtml(body, params.token)
				: body,
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
