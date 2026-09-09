import { createDecipheriv } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { fetchWithRetry } from "#utils/fetch-with-retry.ts";
import type { SymbolInfo } from "#types/easy-eda-api.ts";

type EasyEdaDataStrSource = Pick<SymbolInfo, "dataStr" | "dataStrId" | "key" | "iv">;

async function fetchDataStrBlob(dataStrId: string) {
    const response = await fetchWithRetry(dataStrId);
    if (!response.ok) {
        throw new Error(`Failed to fetch EasyEDA dataStrId: ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

export function decryptEasyEdaDataStr(encrypted: Buffer, keyHex: string, ivHex: string) {
    const key = Buffer.from(keyHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = encrypted.subarray(-16);
    const ciphertext = encrypted.subarray(0, -16);

    const decipher = createDecipheriv(`aes-${key.length * 8}-gcm`, key, iv);
    (decipher as any).setAuthTag(authTag);

    const gzippedDataStr = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
    ]);

    return gunzipSync(gzippedDataStr).toString("utf8");
}

export async function getEasyEdaDataStr(source?: EasyEdaDataStrSource | null) {
    if (!source) return null;
    if (source.dataStr) return source.dataStr;
    if (!source.dataStrId) return null;

    if (!source.key || !source.iv) {
        throw new Error("EasyEDA dataStrId requires key and iv");
    }

    const encrypted = await fetchDataStrBlob(source.dataStrId);
    return decryptEasyEdaDataStr(encrypted, source.key, source.iv);
}

export async function normalizeEasyEdaSymbolInfo<T extends EasyEdaDataStrSource>(symbol: T) {
    const dataStr = await getEasyEdaDataStr(symbol);
    if (!dataStr) return symbol;

    return {
        ...symbol,
        dataStr,
    };
}
