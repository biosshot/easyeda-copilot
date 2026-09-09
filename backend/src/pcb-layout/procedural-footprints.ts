import type {
    AntennaRule,
    SolderJumperRule,
    ThermalPadRule,
} from "#types/pcb/layout-rules.ts";
import type {
    FootprintPad,
    FootprintSpec,
    PcbComponent,
    PcbGeneratedGeometry,
    PcbPin,
    Point,
} from "#types/pcb/layout-model.ts";

const SPEED_OF_LIGHT_M_S = 299_792_458;
const DEFAULT_SUBSTRATE_ER = 4.2;
const DEFAULT_SUBSTRATE_HEIGHT_MM = 1.6;
const THERMAL_VIA_DIAMETER_MM = 0.55;
const THERMAL_VIA_DRILL_MM = 0.3;
const THERMAL_VIA_PITCH_MM = 0.8;
const THERMAL_VIA_EDGE_MARGIN_MM = 0.08;
const DEFAULT_BOARD_THICKNESS_MM = 1.6;
const DEFAULT_VIA_PLATING_MM = 0.035;
const COPPER_THERMAL_CONDUCTIVITY_W_MK = 400;
const DEFAULT_PACKAGE_INTERNAL_PATH_MM = 0.2;
const DEFAULT_PACKAGE_EFFECTIVE_CONDUCTIVITY_W_MK = 5;
const DEFAULT_PACKAGE_INTERFACE_THETA_C_W = 1;

export type CompiledSyntheticFootprint = {
    footprint: FootprintSpec;
    pins: PcbPin[];
    geometry: PcbGeneratedGeometry;
};

export function compileSolderJumper(rule: SolderJumperRule): CompiledSyntheticFootprint {
    const current = Math.max(0, rule.current ?? 0);
    const power = rule.usage === "power";
    const padWidth = power ? clamp(1.4 + current * 0.18, 1.4, 2.8) : 1.2;
    const padHeight = power ? clamp(1.2 + current * 0.1, 1.2, 2.2) : 1.2;
    const gap = power ? 0.25 : 0.2;
    const pitch = padWidth + gap;
    const startX = -pitch * (rule.nets.length - 1) / 2;
    const shape = power ? "rect" as const : "round" as const;
    const pads = rule.nets.map((net, index) => ({
        pin_number: String(index + 1),
        name: String(index + 1),
        net,
        x: round(startX + index * pitch),
        y: 0,
        width: padWidth,
        height: padHeight,
        shape,
    }));

    return {
        footprint: {
            name: `SOLDER_JUMPER_${rule.name}`,
            width: round((rule.nets.length - 1) * pitch + padWidth),
            height: round(padHeight),
            pads: pads.map(({ net: _net, ...pad }) => ({ ...pad, mount: "smd" as const })),
        },
        pins: pads.map((pad) => ({
            pin_number: pad.pin_number,
            name: pad.name ?? String(pad.pin_number),
            signal_name: pad.net,
        })),
        geometry: {
            kind: "solder_jumper",
            name: rule.name,
            pads: pads.map((pad) => ({
                name: pad.name,
                net: pad.net,
                x: pad.x,
                y: pad.y,
                layer: "same" as const,
                shape: pad.shape,
                ...(pad.shape === "round"
                    ? { diameter: round(Math.max(pad.width, pad.height)) }
                    : { width: round(pad.width), height: round(pad.height) }),
            })),
            tracks: [],
            vias: [],
            polygons: [],
        },
    };
}

export function compileAntenna(rule: AntennaRule): CompiledSyntheticFootprint {
    const maxSize = rule.maxSize ?? antennaDefaultMaxSize(rule.strategy);
    const effectiveEr = (DEFAULT_SUBSTRATE_ER + 1) / 2;
    const wavelengthMm = SPEED_OF_LIGHT_M_S * 1000 / rule.centerFrequency / Math.sqrt(effectiveEr);
    const targetLength = wavelengthMm / 4;
    const feedWidth = microstripWidthMm(rule.impedance, DEFAULT_SUBSTRATE_HEIGHT_MM, DEFAULT_SUBSTRATE_ER);
    const requestedFractionalBandwidth = (rule.minBandwidth ?? rule.centerFrequency * 0.05) / rule.centerFrequency;
    const bandwidthWidthFactor = clamp(0.8 + requestedFractionalBandwidth * 4, 0.8, 1.6);
    const traceWidth = round(clamp(feedWidth * 0.4 * bandwidthWidthFactor, 0.45, 1.8));
    const clearance = rule.strategy === "efficient" ? 3 : rule.strategy === "compact" ? 1.5 : 2;
    const centerlineMaxWidth = maxSize.width - clearance * 2 - traceWidth;
    const centerlineMaxHeight = maxSize.height - clearance * 2 - traceWidth;
    if (centerlineMaxWidth <= traceWidth || centerlineMaxHeight < 0) {
        throw new Error(`primitive.antenna("${rule.name}") maxSize ${maxSize.width}x${maxSize.height}mm is too small for calculated ${traceWidth}mm copper and ${clearance}mm RF clearance.`);
    }
    const topology = rule.topology === "auto"
        ? targetLength <= centerlineMaxWidth ? "monopole" : "meandered_monopole"
        : rule.topology;
    const preferredMeanderRuns = rule.strategy === "efficient" ? 2 : rule.strategy === "compact" ? 4 : 3;
    const rawPoints = topology === "meandered_monopole"
        ? meanderPoints(targetLength, centerlineMaxWidth, centerlineMaxHeight, traceWidth, preferredMeanderRuns)
        : straightPoints(Math.min(targetLength, centerlineMaxWidth));
    const centered = centerPoints(rawPoints);
    const points = centered.points;
    const feed = points[0];
    const footprintWidth = round(maxSize.width);
    const footprintHeight = round(maxSize.height);
    const keepout = rectPoints(footprintWidth, footprintHeight);
    const actualLength = polylineLength(points);
    const predictedFrequency = rule.centerFrequency * targetLength / Math.max(actualLength, 0.001);
    const estimatedBandwidth = rule.centerFrequency * clamp(0.035 + 0.07 * traceWidth / 1.8, 0.035, 0.12);
    const diagnostics = [
        `antenna ${rule.name}: ${topology}, target ${round(rule.centerFrequency / 1e6)}MHz, predicted ${round(predictedFrequency / 1e6)}MHz`,
        `antenna ${rule.name}: requested bandwidth ${round((rule.minBandwidth ?? 0) / 1e6)}MHz, first-order estimate ${round(estimatedBandwidth / 1e6)}MHz`,
        `antenna ${rule.name}: default FR-4 er=${DEFAULT_SUBSTRATE_ER}, h=${DEFAULT_SUBSTRATE_HEIGHT_MM}mm, calculated trace width ${traceWidth}mm`,
        `antenna ${rule.name}: V1 is a first-order single-net model; validate with EM simulation and tune a 50-ohm matching network on the real board`,
        ...(actualLength + 0.01 < targetLength
            ? [`antenna ${rule.name}: target electrical length does not fit maxSize; geometry was clipped to the hard size limit`]
            : []),
        ...(rule.minBandwidth && estimatedBandwidth < rule.minBandwidth
            ? [`antenna ${rule.name}: requested bandwidth is not met by the V1 first-order model within maxSize`]
            : []),
    ];

    return {
        footprint: {
            name: `ANTENNA_${rule.name}_${topology.toUpperCase()}`,
            width: footprintWidth,
            height: footprintHeight,
            pads: [{
                pin_number: "1",
                name: "FEED",
                x: feed.x,
                y: feed.y,
                width: round(Math.max(1.2, traceWidth * 1.4)),
                height: round(Math.max(1.2, traceWidth * 1.4)),
                shape: "round",
                mount: "smd",
            }],
            graphics: [{
                kind: "path",
                layer: "marking",
                points,
                closed: false,
                strokeWidth: traceWidth,
            }],
        },
        pins: [{ pin_number: "1", name: "FEED", signal_name: rule.net }],
        geometry: {
            kind: "antenna",
            name: rule.name,
            pads: [{
                name: "FEED",
                net: rule.net,
                x: feed.x,
                y: feed.y,
                layer: "same",
                shape: "round",
                diameter: round(Math.max(1.2, traceWidth * 1.4)),
            }],
            tracks: [{
                net: rule.net,
                layer: "same",
                width: traceWidth,
                points,
            }],
            vias: [],
            polygons: [],
            routingKeepouts: [{ layers: [rule.layer, rule.layer === "top" ? "bottom" : "top"], points: keepout }],
            diagnostics,
        },
    };
}

export function compileThermalPad(
    rule: ThermalPadRule,
    component: PcbComponent,
): { footprint: FootprintSpec; pins: PcbPin[]; geometry: PcbGeneratedGeometry } {
    const targetPad = component.footprint.pads.find((pad) => String(pad.pin_number) === String(rule.at.pin_number));
    if (!targetPad) {
        throw new Error(`primitive.thermalPad("${rule.name}") target ${rule.at.designator}.${String(rule.at.pin_number)} has no resolved footprint pad.`);
    }
    const targetPin = component.pins.find((pin) => String(pin.pin_number) === String(rule.at.pin_number));
    const net = targetPin?.signal_name?.trim();
    if (!net) {
        throw new Error(`primitive.thermalPad("${rule.name}") target ${rule.at.designator}.${String(rule.at.pin_number)} has no electrical net.`);
    }

    if (rule.maxSize && (rule.maxSize.width < targetPad.width || rule.maxSize.height < targetPad.height)) {
        throw new Error(`primitive.thermalPad("${rule.name}").limits.maxSize must not be smaller than real pad ${targetPad.width}x${targetPad.height}mm.`);
    }
    const targetPadAreaMm2 = targetPad.width * targetPad.height;
    const estimatedThetaJC = estimateThetaJC(targetPadAreaMm2);
    const thetaJC = rule.thetaJC ?? estimatedThetaJC;
    const requiredTotalResistance = rule.maxTemperatureRise / rule.dissipation;
    const availablePcbResistance = requiredTotalResistance - thetaJC;
    const singleViaResistance = thermalViaResistance();
    const requestedCount = availablePcbResistance > 0
        ? Math.max(1, Math.ceil(singleViaResistance / availablePcbResistance))
        : Number.POSITIVE_INFINITY;
    const candidates = thermalViaCandidates(targetPad);
    const selected = candidates.slice(0, requestedCount);
    if (selected.length === 0) {
        throw new Error(`primitive.thermalPad("${rule.name}") cannot fit a ${THERMAL_VIA_DIAMETER_MM}mm thermal via inside real pad ${rule.at.designator}.${String(rule.at.pin_number)} (${targetPad.width}x${targetPad.height}mm).`);
    }
    const viaArrayResistance = singleViaResistance / selected.length;
    const needsSpreadingPolygon = selected.length < requestedCount;
    const maxSpreadSize = rule.maxSize ?? {
        width: Math.max(6, targetPad.width * 3),
        height: Math.max(6, targetPad.height * 3),
    };
    const shortfallRatio = availablePcbResistance > 0
        ? Math.max(1, viaArrayResistance / availablePcbResistance)
        : Number.POSITIVE_INFINITY;
    const spreadScale = Number.isFinite(shortfallRatio) ? Math.sqrt(shortfallRatio) : Number.POSITIVE_INFINITY;
    const spreadSize = {
        width: round(Math.min(maxSpreadSize.width, Math.max(targetPad.width, targetPad.width * spreadScale))),
        height: round(Math.min(maxSpreadSize.height, Math.max(targetPad.height, targetPad.height * spreadScale))),
    };
    const polygons = needsSpreadingPolygon ? [{
        net,
        layer: "opposite" as const,
        points: rectPointsAt(targetPad.x, targetPad.y, spreadSize.width, spreadSize.height),
    }] : [];
    const diagnostics = [
        `thermal pad ${rule.name}: required total Rtheta ${round(requiredTotalResistance)}C/W; thetaJC ${round(thetaJC)}C/W (${rule.thetaJC === null ? `estimated from ${round(targetPadAreaMm2)}mm2 exposed pad` : "DSL"})`,
        `thermal pad ${rule.name}: V1 defaults board ${DEFAULT_BOARD_THICKNESS_MM}mm, via plating ${DEFAULT_VIA_PLATING_MM}mm, kCu ${COPPER_THERMAL_CONDUCTIVITY_W_MK}W/mK; thetaJC estimate uses ${DEFAULT_PACKAGE_INTERNAL_PATH_MM}mm effective path, ${DEFAULT_PACKAGE_EFFECTIVE_CONDUCTIVITY_W_MK}W/mK and ${DEFAULT_PACKAGE_INTERFACE_THETA_C_W}C/W interface`,
        `thermal pad ${rule.name}: one default plated via ${round(singleViaResistance)}C/W; array ${round(viaArrayResistance)}C/W using ${selected.length}/${Number.isFinite(requestedCount) ? requestedCount : "unbounded"} vias`,
        ...(needsSpreadingPolygon
            ? [`thermal pad ${rule.name}: via matrix misses the PCB thermal budget; added ${spreadSize.width}x${spreadSize.height}mm opposite-layer spreading polygon`]
            : [`thermal pad ${rule.name}: via matrix meets the first-order PCB thermal budget; no extended opposite-layer polygon generated`]),
        ...(availablePcbResistance <= 0
            ? [`thermal pad ${rule.name}: thetaJC alone exceeds the allowed ${round(requiredTotalResistance)}C/W total resistance; PCB copper cannot meet this target`]
            : []),
        ...(needsSpreadingPolygon && (spreadSize.width >= maxSpreadSize.width || spreadSize.height >= maxSpreadSize.height)
            ? [`thermal pad ${rule.name}: spreading polygon reached maxSize; verify with datasheet/thermal simulation`]
            : []),
    ];
    const vias = selected.map((point, index) => ({
        name: `${rule.name}_V${index + 1}`,
        net,
        x: round(targetPad.x + point.x),
        y: round(targetPad.y + point.y),
        diameter: THERMAL_VIA_DIAMETER_MM,
        drill: THERMAL_VIA_DRILL_MM,
    }));
    const generatedPads: FootprintPad[] = vias.map((via, index) => ({
        pin_number: `__${rule.name}_V${index + 1}`,
        name: via.name,
        x: via.x,
        y: via.y,
        width: via.diameter,
        height: via.diameter,
        shape: "round",
        mount: "through_hole",
        drillDiameter: via.drill,
    }));

    return {
        footprint: {
            ...expandFootprintForRect(component.footprint, needsSpreadingPolygon ? {
                x: targetPad.x,
                y: targetPad.y,
                width: spreadSize.width,
                height: spreadSize.height,
            } : null),
            pads: [...component.footprint.pads, ...generatedPads],
        },
        pins: generatedPads.map((pad) => ({
            pin_number: pad.pin_number,
            name: pad.name ?? String(pad.pin_number),
            signal_name: net,
        })),
        geometry: {
            kind: "thermal_pad",
            name: rule.name,
            pads: [],
            tracks: [],
            vias,
            polygons,
            diagnostics,
        },
    };
}

function estimateThetaJC(padAreaMm2: number) {
    const areaM2 = Math.max(0.1, padAreaMm2) * 1e-6;
    const pathM = DEFAULT_PACKAGE_INTERNAL_PATH_MM * 1e-3;
    return clamp(
        DEFAULT_PACKAGE_INTERFACE_THETA_C_W + pathM / (DEFAULT_PACKAGE_EFFECTIVE_CONDUCTIVITY_W_MK * areaM2),
        1.5,
        25,
    );
}

function thermalViaResistance() {
    const innerRadiusM = THERMAL_VIA_DRILL_MM / 2 * 1e-3;
    const outerRadiusM = (THERMAL_VIA_DRILL_MM / 2 + DEFAULT_VIA_PLATING_MM) * 1e-3;
    const barrelAreaM2 = Math.PI * (outerRadiusM ** 2 - innerRadiusM ** 2);
    return DEFAULT_BOARD_THICKNESS_MM * 1e-3 / (COPPER_THERMAL_CONDUCTIVITY_W_MK * barrelAreaM2);
}

function expandFootprintForRect(
    footprint: FootprintSpec,
    rect: { x: number; y: number; width: number; height: number } | null,
) {
    if (!rect) return footprint;
    const halfWidth = Math.max(footprint.width / 2, Math.abs(rect.x - rect.width / 2), Math.abs(rect.x + rect.width / 2));
    const halfHeight = Math.max(footprint.height / 2, Math.abs(rect.y - rect.height / 2), Math.abs(rect.y + rect.height / 2));
    return { ...footprint, width: round(halfWidth * 2), height: round(halfHeight * 2) };
}

function rectPointsAt(x: number, y: number, width: number, height: number): Point[] {
    return rectPoints(width, height).map((point) => roundPoint({ x: point.x + x, y: point.y + y }));
}

function thermalViaCandidates(pad: FootprintPad) {
    const radius = THERMAL_VIA_DIAMETER_MM / 2 + THERMAL_VIA_EDGE_MARGIN_MM;
    const maxColumns = Math.max(1, Math.floor((pad.width - radius * 2) / THERMAL_VIA_PITCH_MM) + 1);
    const maxRows = Math.max(1, Math.floor((pad.height - radius * 2) / THERMAL_VIA_PITCH_MM) + 1);
    const points: Point[] = [];
    for (let row = 0; row < maxRows; row += 1) {
        for (let column = 0; column < maxColumns; column += 1) {
            const point = {
                x: (column - (maxColumns - 1) / 2) * THERMAL_VIA_PITCH_MM,
                y: (row - (maxRows - 1) / 2) * THERMAL_VIA_PITCH_MM,
            };
            if (thermalViaFitsPad(pad, point, radius)) points.push(point);
        }
    }
    return points.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y) || a.y - b.y || a.x - b.x);
}

function thermalViaFitsPad(pad: FootprintPad, point: Point, radius: number) {
    const halfWidth = pad.width / 2;
    const halfHeight = pad.height / 2;
    if (halfWidth <= radius || halfHeight <= radius) return false;
    if (pad.shape === "round" || pad.shape === "oval") {
        const x = (Math.abs(point.x) + radius) / halfWidth;
        const y = (Math.abs(point.y) + radius) / halfHeight;
        return x * x + y * y <= 1;
    }
    return Math.abs(point.x) + radius <= halfWidth && Math.abs(point.y) + radius <= halfHeight;
}

function antennaDefaultMaxSize(strategy: AntennaRule["strategy"]) {
    if (strategy === "efficient") return { width: 42, height: 16 };
    if (strategy === "compact") return { width: 18, height: 10 };
    return { width: 28, height: 12 };
}

function straightPoints(length: number): Point[] {
    return [{ x: -length / 2, y: 0 }, { x: length / 2, y: 0 }].map(roundPoint);
}

function meanderPoints(targetLength: number, maxWidth: number, maxHeight: number, traceWidth: number, preferredRuns: number): Point[] {
    const pitch = Math.max(traceWidth + 0.35, 0.8);
    const maxRuns = Math.max(2, Math.floor(maxHeight / pitch) + 1);
    let runs = Math.min(maxRuns, Math.max(2, preferredRuns));
    while (runs > 2 && targetLength <= (runs - 1) * pitch + runs * traceWidth) runs -= 1;
    const run = Math.max(traceWidth, Math.min(maxWidth, (targetLength - (runs - 1) * pitch) / runs));
    const points: Point[] = [{ x: -run / 2, y: -(runs - 1) * pitch / 2 }];
    let direction = 1;
    for (let index = 0; index < runs; index += 1) {
        const previous = points[points.length - 1];
        points.push({ x: previous.x + direction * run, y: previous.y });
        if (index === runs - 1) break;
        points.push({ x: points[points.length - 1].x, y: points[points.length - 1].y + pitch });
        direction *= -1;
    }
    return points.map(roundPoint);
}

function centerPoints(points: Point[]) {
    const bounds = pointsBounds(points, 0);
    const cx = (bounds.left + bounds.right) / 2;
    const cy = (bounds.top + bounds.bottom) / 2;
    return { points: points.map((point) => roundPoint({ x: point.x - cx, y: point.y - cy })) };
}

function pointsBounds(points: Point[], margin: number) {
    const left = Math.min(...points.map((point) => point.x)) - margin;
    const right = Math.max(...points.map((point) => point.x)) + margin;
    const top = Math.min(...points.map((point) => point.y)) - margin;
    const bottom = Math.max(...points.map((point) => point.y)) + margin;
    return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function rectPoints(width: number, height: number): Point[] {
    return [
        { x: -width / 2, y: -height / 2 },
        { x: width / 2, y: -height / 2 },
        { x: width / 2, y: height / 2 },
        { x: -width / 2, y: height / 2 },
    ].map(roundPoint);
}

function polylineLength(points: Point[]) {
    return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index].x, point.y - points[index].y), 0);
}

function microstripWidthMm(impedance: number, height: number, er: number) {
    let low = 0.02;
    let high = height * 20;
    for (let index = 0; index < 60; index += 1) {
        const width = (low + high) / 2;
        const z = microstripImpedance(width, height, er);
        if (z > impedance) low = width;
        else high = width;
    }
    return round((low + high) / 2);
}

function microstripImpedance(width: number, height: number, er: number) {
    const u = width / height;
    const effectiveEr = (er + 1) / 2 + (er - 1) / 2 * (1 / Math.sqrt(1 + 12 / u) + (u < 1 ? 0.04 * (1 - u) ** 2 : 0));
    if (u <= 1) return 60 / Math.sqrt(effectiveEr) * Math.log(8 / u + u / 4);
    return 120 * Math.PI / (Math.sqrt(effectiveEr) * (u + 1.393 + 0.667 * Math.log(u + 1.444)));
}

function roundPoint(point: Point): Point {
    return { x: round(point.x), y: round(point.y) };
}

function round(value: number) {
    return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}
