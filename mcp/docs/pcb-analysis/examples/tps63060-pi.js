// P8 stage 6 board pi() on TPS63060DSCR. Benchmark hypotheses: stack, materials, VRM output resistance and every decap/connector value are not measured.
// Rail VOUT (U1.9 against GND U1.7). Source: VRM output pin U1.9 with a 50 mOhm Thevenin hypothesis.
// Load: IC power pin pair U1.9/U1.11 (second GND pad of the same IC; U1 has one VOUT pin, pin 9).
// Rail-return parts declared as hypotheses: C3, C4, C5 (22 uF C0805, ESR 3 mOhm, ESL 1 nH); J2 (VOUT connector, 10 mOhm contact resistance hypothesis). Ports: 6.
const a=analysis({board});
const src=a.port({positive:pad('U1','9'),negative:pad('U1','7')});
const load=a.port({positive:pad('U1','9'),negative:pad('U1','11')});
const layers=stackup({"boardThicknessMm": 1.6, "viaPlatingThicknessUm": 25, "platingMaterial": "cu", "diameterConvention": "finished_hole", "layers": [{"kind": "copper", "name": "TOP", "thicknessMm": 0.035, "material": "cu"}, {"kind": "dielectric", "name": "assumed-gap-0", "thicknessMm": 1.53, "material": "d"}, {"kind": "copper", "name": "BOTTOM", "thicknessMm": 0.035, "material": "cu"}]});
const materials={cu:{conductivitySM:58e6,state:'Benchmark copper 25 C'},d:{relativePermittivity:4.2,state:'Benchmark lossless dielectric; actual data missing'}};
const vrm=a.model({kind:'linear-driver',lowV:0,highV:3.3,outputResistanceOhm:0.05});
const z=await a.pi().domain('frequency').frequencyHz(1e6)
 .sources([{port:src,voltageV:3.3,model:vrm}])
 .loads([{port:load,currentA:1}])
 .components([
  capacitor({designator:'C3',pins:{positive:'1',negative:'2'},capacitanceF:22e-6,esrOhm:.003,eslH:1e-9}),
  capacitor({designator:'C4',pins:{positive:'1',negative:'2'},capacitanceF:22e-6,esrOhm:.003,eslH:1e-9}),
  capacitor({designator:'C5',pins:{positive:'1',negative:'2'},capacitanceF:22e-6,esrOhm:.003,eslH:1e-9}),
  resistor({designator:'J2',pins:{positive:'1',negative:'2'},resistanceOhm:.01})])
 .stackup(layers).materials(materials).budget({maxSeconds:3600,maxMemoryMiB:6144}).run();
a.plot({title:'TPS63060DSCR board pi impedance',kind:'table',data:z.solution});
