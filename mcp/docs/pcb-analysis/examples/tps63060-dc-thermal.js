// M4 assembled: TPS63060DSCR DC (J1 3.7V in, U1 9/7 5V out, loads like dc.js, one case) -> a.thermal().losses(dc.lossMap) steady. All values test hypotheses.
const a=analysis({board});
const source1=a.port({positive:pad("J1","1"),negative:pad("J1","2")});
const source2=a.port({positive:pad("U1","9"),negative:pad("U1","7")});
const load1=a.port({positive:pad("J2","1"),negative:pad("J2","2")});
const swPath=a.port({positive:pad("U1","10"),negative:pad("U1","1")}); // 9.1 hypothesis: IC returns coil current SW2->SW1
const stack=stackup({boardThicknessMm:1.6,viaPlatingThicknessUm:25,platingMaterial:"test-copper",diameterConvention:"finished_hole",layers:[
 {kind:"copper",name:"TOP",thicknessMm:0.035,material:"test-copper"},{kind:"dielectric",name:"assumed-gap-1",thicknessMm:1.53,material:"resin"},{kind:"copper",name:"BOTTOM",thicknessMm:0.035,material:"test-copper"}]});
const dc=await a.dc().components([ic({designator:"U1"}),inductor({designator:"L1",inductanceH:1e-6,seriesResistanceOhm:0.03}),resistor({designator:"R1",resistanceOhm:1e6})]).stackup(stack)
 .materials({"test-copper":{conductivitySM:58e6,state:"constant isotropic at 20 C; test assumption",source:"explicit test profile"},resin:{state:"Authored electrically insulating core"}})
 .temperatureC(20).inputPolicy({cadFill:"snapshot"}).idleNets([net("VAUX"),net("PG")])
 .sources([{port:source1,voltageV:3.7,model:"ideal"},{port:source2,voltageV:5,model:"ideal"}])
 .budget({maxSeconds:500,maxMemoryMiB:1024}).name('m4-dc').mesh({maxAreaMm2:1,minAngleDeg:0,maxRefinementSteps:64})
 .loads([{designator:"U1",rail:net("VIN"),currentA:0.5,pins:["2","3"],returnPins:["4","7","11"]},{port:load1,currentA:2},{port:swPath,currentA:2.5}]).run();
const materials={cu:{thermalConductivityWPerMK:390,source:'Authored copper',state:'constant'},resin:{thermalConductivityWPerMK:.3,source:'Authored resin',state:'constant'}};
const t=await a.thermal().losses(dc.lossMap).materials(materials).stackup(stackup({viaPlatingThicknessUm:25,platingMaterial:'cu',diameterConvention:'finished_hole',layers:[{kind:'copper',name:'TOP',thicknessMm:.035,material:'cu',backgroundMaterial:'resin'},{kind:'dielectric',name:'core',thicknessMm:1.53,material:'resin'},{kind:'copper',name:'BOTTOM',thicknessMm:.035,material:'cu',backgroundMaterial:'resin'}]})).mesh({maxEdgeMm:2,maxNodes:50000}).cooling({boardSurfaces:a.model({kind:'cooling',resistanceKPerW:35})}).environment({name:'room',ambientC:25}).domain('steady').inputPolicy({cadFill:'snapshot'}).run();
a.check({name:'transferred losses give finite temperature',actual:t.temperatureMap.min(),min:25,unit:'degC'});
