import { open, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Read only a bounded tail; full routing logs can be very large. */
export async function readRoutingProgress(artifactsDirectory: string) {
    try {
        const entries = await readdir(artifactsDirectory, { recursive: true, withFileTypes: true });
        const logs = await Promise.all(entries
            .filter(entry => entry.isFile() && /^krt-.*\.(stdout|stderr)\.log$/.test(entry.name))
            .map(async entry => {
                const path = join(entry.parentPath, entry.name);
                const info = await stat(path).catch(() => undefined);
                return info?.size ? { path, modified: info.mtimeMs } : undefined;
            }));
        const latest = logs.filter(log => log !== undefined)
            .sort((left, right) => right.modified - left.modified)[0];
        if (!latest) return undefined;

        const file = await open(latest.path, 'r');
        try {
            const info = await file.stat();
            const offset = Math.max(0, info.size - 8192);
            const buffer = Buffer.alloc(Math.min(info.size, 8192));
            const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
            const lines = buffer.subarray(0, bytesRead).toString('utf8').split(/\r\n|[\r\n]/);
            if (offset > 0 && lines.length > 1) lines.shift();
            const tail = lines.filter(line => line.trim()).slice(-10);
            if (!tail.length) return undefined;
            return {
                log_file: latest.path,
                updated_at: info.mtime.toISOString(),
                log_tail: tail,
            };
        } finally {
            await file.close();
        }
    } catch {
        // Logs may not exist yet, or may disappear while an operation finishes.
        return undefined;
    }
}
