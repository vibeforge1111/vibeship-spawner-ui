import { rename, unlink, writeFile } from 'node:fs/promises';

export async function writeFileAtomic(filePath: string, content: string): Promise<void> {
	const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
	try {
		await writeFile(tempPath, content, 'utf-8');
		await rename(tempPath, filePath);
	} catch (error) {
		await unlink(tempPath).catch(() => undefined);
		throw error;
	}
}
