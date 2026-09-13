/** Observations, not a guarantee about future EasyEDA versions. Verify against known geometry. */
export const OBSERVED_PCB_UNITS = Object.freeze({ primitiveMmPerUnit: 0.0254, pouredMmPerUnit: 0.254 });
function finite(value: number, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be a finite number`);
    return value;
}
/** Convert a length only. Never apply blindly to polygon tokens, angles or enum values. */
export function convertLength(value: number, sourceMmPerUnit: number, targetMmPerUnit = 1): number {
    finite(value, 'value'); finite(sourceMmPerUnit, 'sourceMmPerUnit'); finite(targetMmPerUnit, 'targetMmPerUnit');
    if (sourceMmPerUnit <= 0 || targetMmPerUnit <= 0) throw new RangeError('Unit scales must be positive');
    return finite(value * sourceMmPerUnit / targetMmPerUnit, 'converted length');
}
export function milToMm(value: number): number { return convertLength(value, 0.0254); }
export function mmToMil(value: number): number { return convertLength(value, 1, 0.0254); }
/** Read-only numeric sanity check; referenceMm must be independently known and nonzero. */
export function assertUnitScale(nativeDistance: number, referenceMm: number, mmPerUnit: number, toleranceMm: number): void {
    finite(referenceMm, 'referenceMm'); finite(toleranceMm, 'toleranceMm');
    if (nativeDistance <= 0 || referenceMm <= 0 || toleranceMm < 0 || toleranceMm >= referenceMm / 2) throw new RangeError('Use positive distances and a meaningful nonnegative tolerance');
    const actual = convertLength(nativeDistance, mmPerUnit);
    if (Math.abs(actual - referenceMm) > toleranceMm) throw new Error(`Unit scale mismatch: observed ${actual} mm; expected ${referenceMm} ± ${toleranceMm} mm. Recheck the connected EasyEDA API.`);
}
