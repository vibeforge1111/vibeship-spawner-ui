import { describe, expect, it } from 'vitest';
import { extractMaterializableFiles } from './openai-compat-client';

describe('openai compat hosted file materialization', () => {
	it('extracts a static index.html file from an HTML code fence', () => {
		const files = extractMaterializableFiles([
			'Here is the page:',
			'```html',
			'<!DOCTYPE html>',
			'<html><body><h1>Plant shop</h1></body></html>',
			'```'
		].join('\n'));

		expect(files).toEqual([
			{
				path: 'index.html',
				content: '<!DOCTYPE html>\n<html><body><h1>Plant shop</h1></body></html>\n'
			}
		]);
	});

	it('extracts files from structured JSON maps', () => {
		const files = extractMaterializableFiles(JSON.stringify({
			files: {
				'index.html': '<main>Hello</main>',
				'styles.css': 'main { color: green; }'
			}
		}));

		expect(files).toEqual([
			{ path: 'index.html', content: '<main>Hello</main>' },
			{ path: 'styles.css', content: 'main { color: green; }' }
		]);
	});

	it('rejects unsafe file paths', () => {
		const files = extractMaterializableFiles(JSON.stringify({
			files: {
				'../secret.txt': 'nope',
				'index.html': '<main>Safe</main>'
			}
		}));

		expect(files).toEqual([{ path: 'index.html', content: '<main>Safe</main>' }]);
	});
});
