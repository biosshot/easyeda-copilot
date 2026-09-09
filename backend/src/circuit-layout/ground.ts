/** Drawing role only. Names are never normalized into one electrical net. */
export function isGroundSignal(signalName: string) {
    return /gnd/i.test(signalName)
        || /(^|[_+\-/])GROUND(?:$|[_+\-/])/i.test(signalName)
        || /^PGMD$/i.test(signalName);
}
