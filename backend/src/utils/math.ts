export const rotatePointClockwise = (point: { x: number; y: number }, degrees: number) => {
    const radians = degrees * (Math.PI / 180);
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    return {
        x: point.x * cos + point.y * sin,
        y: -point.x * sin + point.y * cos,
    };
};

export function rotatePoint(point: { x: number; y: number }, degrees: number) {
    const radians = degrees * Math.PI / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    };
}

export const randomDigit = () => Math.floor(Math.random() * 10);

export function normalizeRotation(rotation: number) {
    return ((Math.round(rotation) % 360) + 360) % 360;
}

export function countDiffChars(str1: string, str2: string): number {
    let diffCount = 0;
    const maxLen = Math.max(str1.length, str2.length);

    for (let i = 0; i < maxLen; i++) {
        // Если символ отсутствует (индекс > длины), используем undefined
        if (str1[i] !== str2[i]) {
            diffCount++;
        }
    }

    return diffCount;
}

export function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}