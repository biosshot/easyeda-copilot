// USB isolator layout intent: ADUM4160 + ADUM5000 on a compact 40x20 mm
// two-layer board. Host USB-A (XS1) on the bottom-left, device USB-A (XP1)
// on the top-right. The isolator U1 sits in the centre with a 2 mm isolation
// keepout slot; the isolated DC-DC U2 is on the bottom side directly below U1.
// Passive support is split across top and bottom layers to fit the envelope.

board.rect(40, 20, {
    layers: ["top", "bottom"],
    defaultLayer: "top",
    clearance: 0.4,
    edge: 1.0,
});
silkscreen.designators({ height: 0.7, rotations: [0, 90], margin: 0.15 });

// ---------------------------------------------------------------------------
// Isolation keepout slot in the centre of the board
// ---------------------------------------------------------------------------

constraintRegion("isolation_slot", {
    shape: region.rect({ anchor: anchor("board.center"), width: 2, height: 18 }),
    allow: { blocks: ["isolator_core"] },
});

// ---------------------------------------------------------------------------
// Main functional blocks
// ---------------------------------------------------------------------------

block("host_connector", ["XS1"], "connector", {
    placement: "main",
    anchor: anchor("board.left"),
    maxBboxWidth: 16,
    maxBboxHeight: 18,
});

block("device_connector", ["XP1"], "connector", {
    placement: "main",
    anchor: anchor("board.right"),
    maxBboxWidth: 16,
    maxBboxHeight: 18,
});

block("isolator_core", ["U1"], "generic", {
    placement: "main",
    anchor: anchor("board.center"),
    familyMaxWidth: 36,
    familyMaxHeight: 18,
    placementClearance: 0.4,
});

block("host_side", ["R1", "R2", "R3", "R7", "C1", "C2"], "generic", {
    placement: "satellite",
    attachTo: "isolator_core",
    anchor: pin("U1", "6"),
    sidePreference: "left",
    maxBboxWidth: 7,
    maxBboxHeight: 12,
    maxAnchorGap: 5,
    hardAnchor: true,
    placementClearance: 0.35,
});

block("device_side", ["R4", "R5", "R6", "R8", "C3", "C4"], "generic", {
    placement: "satellite",
    attachTo: "isolator_core",
    anchor: pin("U1", "11"),
    sidePreference: "right",
    maxBboxWidth: 7,
    maxBboxHeight: 12,
    maxAnchorGap: 5,
    hardAnchor: true,
    placementClearance: 0.35,
});

block("dcdc_core", ["U2"], "power", {
    placement: "main",
    anchor: anchor("board.bottom"),
    familyMaxWidth: 36,
    familyMaxHeight: 18,
    placementClearance: 0.4,
});

block("dcdc_caps", ["C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"], "power", {
    placement: "satellite",
    attachTo: "dcdc_core",
    anchor: pin("U2", "8"),
    sidePreference: "bottom",
    maxBboxWidth: 18,
    maxBboxHeight: 5,
    maxAnchorGap: 7,
    hardAnchor: false,
    placementClearance: 0.35,
});

// ---------------------------------------------------------------------------
// Component options
// ---------------------------------------------------------------------------

component("XS1")
    .block("host_connector")
    .role("connector")
    .bottom()
    .faceAt0("left")
    .edgeMount("left", { overhang: 0.5, face: "outward", layer: "bottom" })
    .boardOverflow({ left: 8 });

component("XP1")
    .block("device_connector")
    .role("connector")
    .top()
    .faceAt0("right")
    .edgeMount("right", { overhang: 0.5, face: "outward", layer: "top" })
    .boardOverflow({ right: 8 });

component("U1").block("isolator_core").role("main_ic").top();
component("U2").block("dcdc_core").role("main_ic").bottom();

for (const d of ["R1", "R2", "R3", "R7"]) component(d).block("host_side").role("passive").bottom();
for (const d of ["R4", "R5", "R6", "R8"]) component(d).block("device_side").role("passive").top();

for (const d of ["C1", "C2"]) component(d).block("host_side").role("decoupling_cap").bottom();
for (const d of ["C3", "C4"]) component(d).block("device_side").role("decoupling_cap").top();
for (const d of ["C5", "C6", "C7", "C8", "C9", "C10", "C11", "C12"]) component(d).block("dcdc_caps").role("decoupling_cap").bottom();

// ---------------------------------------------------------------------------
// Mechanical placement hints
// ---------------------------------------------------------------------------

near(comp("XS1"), anchor("board.left"), "critical");
near(comp("XP1"), anchor("board.right"), "critical");
near(comp("U1"), anchor("board.center"), "critical");
near(comp("U2"), anchor("board.bottom"), "critical");

near(block("host_side"), comp("U1"), "critical");
near(block("device_side"), comp("U1"), "critical");
near(block("dcdc_caps"), comp("U2"), "critical");

sameSide(comp("XS1"), comp("U2"), "critical");
sameSide(comp("XP1"), comp("U1"), "critical");

blockClearance("host_connector", "device_connector", 14, "critical");
blockClearance("host_connector", "isolator_core", 0.5, "high");
blockClearance("device_connector", "isolator_core", 0.5, "high");
blockClearance("host_connector", "dcdc_core", 0.5, "high");
blockClearance("device_connector", "dcdc_core", 0.5, "high");
blockClearance("host_side", "device_side", 2.0, "critical");

// ---------------------------------------------------------------------------
// Critical USB data paths
// ---------------------------------------------------------------------------

criticalPair(pin("XS1", "2"), pin("R1", "2"), { maxDistance: 6, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R1", "1"), pin("U1", "6"), { maxDistance: 5, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("XS1", "3"), pin("R2", "2"), { maxDistance: 6, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R2", "1"), pin("U1", "7"), { maxDistance: 5, hard: false, weight: 5, preferFacingPads: true });

criticalPair(pin("U1", "11"), pin("R4", "2"), { maxDistance: 5, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R4", "1"), pin("XP1", "2"), { maxDistance: 6, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("U1", "10"), pin("R5", "2"), { maxDistance: 5, hard: false, weight: 5, preferFacingPads: true });
criticalPair(pin("R5", "1"), pin("XP1", "3"), { maxDistance: 6, hard: false, weight: 5, preferFacingPads: true });

veryNear(pin("XS1", "2"), pin("R1", "2"), "normal");
veryNear(pin("R1", "1"), pin("U1", "6"), "normal");
veryNear(pin("XS1", "3"), pin("R2", "2"), "normal");
veryNear(pin("R2", "1"), pin("U1", "7"), "normal");
veryNear(pin("U1", "11"), pin("R4", "2"), "normal");
veryNear(pin("R4", "1"), pin("XP1", "2"), "normal");
veryNear(pin("U1", "10"), pin("R5", "2"), "normal");
veryNear(pin("R5", "1"), pin("XP1", "3"), "normal");

// ---------------------------------------------------------------------------
// Pull resistors and configuration
// ---------------------------------------------------------------------------

criticalPair(pin("R3", "1"), pin("U1", "3"), { maxDistance: 5, weight: 3, preferFacingPads: true });
criticalPair(pin("R7", "1"), pin("U1", "5"), { maxDistance: 5, weight: 3, preferFacingPads: true });
criticalPair(pin("R8", "1"), pin("U1", "12"), { maxDistance: 5, weight: 3, preferFacingPads: true });
criticalPair(pin("R6", "1"), pin("U1", "14"), { maxDistance: 5, weight: 3, preferFacingPads: true });

near(pin("R3", "2"), pin("U1", "2"), "normal");
near(pin("R7", "2"), pin("XS1", "1"), "normal");
near(pin("R8", "2"), pin("XP1", "1"), "normal");
near(pin("R6", "2"), pin("U1", "9"), "normal");

// ---------------------------------------------------------------------------
// Capacitor clusters
// ---------------------------------------------------------------------------

capCluster(["C1", "C2"], {
    powerNet: "$1N2177",
    returnNet: "GND1",
    target: pin("XS1", "1"),
    axis: "y",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

capCluster(["C3", "C4"], {
    powerNet: "$1N939",
    returnNet: "GND2",
    target: pin("XP1", "1"),
    axis: "y",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

capCluster(["C5", "C6"], {
    powerNet: "$1N2177",
    returnNet: "GND1",
    target: pin("U2", "1"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

capCluster(["C7", "C8"], {
    powerNet: "$1N1763",
    returnNet: "GND1",
    target: pin("U2", "7"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

capCluster(["C9", "C10"], {
    powerNet: "$1N939",
    returnNet: "GND2",
    target: pin("U2", "16"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

capCluster(["C11", "C12"], {
    powerNet: "$1N1971",
    returnNet: "GND2",
    target: pin("U2", "10"),
    axis: "x",
    maxRows: 1,
    maxPerRow: 2,
    gap: 0.55,
    priority: "critical",
});

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

solver({
    grid: 0.25,
    fallbackGrid: 0.5,
    ignoredSignals: ["GND"],
    localImproveIterations: 48,
    hierarchicalBlocks: true,
});
