// BandAmpV5 RF_IN, RF1.2 -> C1.1. The stack and material values are benchmark hypotheses.
const a=analysis({board});
const input=a.port({positive:pad('RF1','2'),negative:pad('RF1','1')});
const output=a.port({positive:pad('C1','1'),negative:pad('U1','2')});
const layers=stackup({"boardThicknessMm": 1.6, "viaPlatingThicknessUm": 25, "platingMaterial": "cu", "diameterConvention": "finished_hole", "layers": [{"kind": "copper", "name": "TOP", "thicknessMm": 0.035, "material": "cu"}, {"kind": "dielectric", "name": "assumed-gap-0", "thicknessMm": 1.53, "material": "d"}, {"kind": "copper", "name": "BOTTOM", "thicknessMm": 0.035, "material": "cu"}]});
const materials={cu:{conductivitySM:58e6,state:"Benchmark copper 25 C"},d:{relativePermittivity:4.2,state:"Benchmark lossless dielectric; actual data missing"}};
const z=await a.impedance().target(a.channel({from:input,to:output})).method('layered').stackup(layers).materials(materials).frequency({startHz:1e7,stopHz:1e9,points:7,scale:"log"}).budget({maxSeconds:1800,maxMemoryMiB:2048}).run();
a.plot({title:'M7a RF_IN channel',kind:'table',data:z.solution});
