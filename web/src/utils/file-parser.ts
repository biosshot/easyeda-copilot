
export type AttachmentFileType = 'image' | 'raw_text';

export interface AttachmentFile {
    id: string;
    name: string;
    type: AttachmentFileType;
    mimeType: string;
    size: number;
    content: string;
}

const SUPPORTED_IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/bmp',
];

const SUPPORTED_TEXT_MIME_TYPES = [
    'text/plain',
    'text/csv',
    'text/html',
    'text/xml',
    'text/markdown',
    'application/json',
    'application/xml',
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];

const TEXT_EXTENSIONS = ['.txt', '.csv', '.html', '.xml', '.md', '.json', '.log'];


function detectMimeTypeByContent(fileBytes: Uint8Array): string | null {
    const signature = fileBytes.slice(0, 16);

    // JPEG: FF D8 FF
    if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
        return 'image/jpeg';
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E &&
        signature[3] === 0x47 && signature[4] === 0x0D && signature[5] === 0x0A &&
        signature[6] === 0x1A && signature[7] === 0x0A) {
        return 'image/png';
    }

    // GIF: 47 49 46 38
    if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46 &&
        signature[3] === 0x38) {
        return 'image/gif';
    }

    // WebP: 52 49 46 46 ... 57 45 42 50
    if (signature[0] === 0x52 && signature[1] === 0x49 && signature[2] === 0x46 &&
        signature[3] === 0x46 && signature[8] === 0x57 && signature[9] === 0x45 &&
        signature[10] === 0x42 && signature[11] === 0x50) {
        return 'image/webp';
    }

    // BMP: 42 4D
    if (signature[0] === 0x42 && signature[1] === 0x4D) {
        return 'image/bmp';
    }

    return null;
}

function detectMimeTypeByExtension(fileName: string): string | null {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();

    if (!ext) return null;

    const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp',
        '.txt': 'text/plain',
        '.csv': 'text/csv',
        '.html': 'text/html',
        '.xml': 'text/xml',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.log': 'text/plain',
    };

    return mimeMap[ext] || null;
}

function isImageFile(mimeType: string, fileName: string): boolean {
    if (SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType)) {
        return true;
    }

    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return IMAGE_EXTENSIONS.includes(ext);
}

function isTextFile(mimeType: string, fileName: string): boolean {
    if (SUPPORTED_TEXT_MIME_TYPES.includes(mimeType)) {
        return true;
    }

    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return TEXT_EXTENSIONS.includes(ext);
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function blobToText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
}

function generateFileId(): string {
    return `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function parseFile(file: File): Promise<AttachmentFile | null> {
    try {
        const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });

        const fileBytes = new Uint8Array(arrayBuffer);

        let mimeType = file.type || detectMimeTypeByContent(fileBytes) || detectMimeTypeByExtension(file.name);

        if (!mimeType) {
            console.warn(`Не удалось определить MIME тип для файла: ${file.name}`);
            mimeType = 'application/octet-stream';
        }

        let fileType: AttachmentFileType | null = null;

        if (isImageFile(mimeType, file.name)) {
            fileType = 'image';
        } else if (isTextFile(mimeType, file.name)) {
            fileType = 'raw_text';
        }

        if (!fileType) {
            console.warn(`Неподдерживаемый тип файла: ${file.name} (${mimeType})`);
            return null;
        }

        let content: string;
        if (fileType === 'image') {
            content = await blobToBase64(file);
        } else {
            content = await blobToText(file);
        }

        return {
            id: generateFileId(),
            name: file.name,
            type: fileType,
            mimeType,
            size: file.size,
            content,
        };
    } catch (error) {
        console.error('Ошибка при парсинге файла:', file.name, error);
        return null;
    }
}

export function isSupportedFile(file: File | string): boolean {
    const fileName = typeof file === 'string' ? file : file.name;
    const mimeType = typeof file === 'string' ? '' : file.type;

    if (mimeType && (SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType) || SUPPORTED_TEXT_MIME_TYPES.includes(mimeType))) {
        return true;
    }

    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS].includes(ext);
}

export function getSupportedExtensions(): string[] {
    return [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS];
}

export function getAcceptString(): string {
    return [...SUPPORTED_IMAGE_MIME_TYPES, ...SUPPORTED_TEXT_MIME_TYPES].join(',');
}
