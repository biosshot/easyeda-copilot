"""Finite, synthetic geometry tests. No live CAD dependencies."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile
import xml.etree.ElementTree as ET

worker=Path(__file__).resolve().parents[1]/'python/easyeda_copilot/pcb_offline.py'
spec=importlib.util.spec_from_file_location('pcb_offline',worker)
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)


def fixture():
    return {'schema':'pcb-offline/v1','units':'mm','frame':'x-right-y-up',
            'obstacle_coverage':'pads-tracks-through-vias-npth-only',
            'board':{'outline':[[-5,-5],[5,-5],[5,5],[-5,5]],'holes':[],'thickness_mm':1.6},
            'pads':[{'id':'p1','reference':'D1','number':'1','net':'GND','xy':[0,0],
                     'rotation_deg':0,'shape':'rect','size_mm':[1,1],'layer':1}],
            'tracks':[],'vias':[], 'components':[]}


class OfflineTests(unittest.TestCase):
    def test_ground_escapes_without_via_in_pad(self):
        result=m.ground(fixture(),{})
        self.assertEqual(len(result['returns']),1)
        x,y=result['new_vias'][0]['xy']
        self.assertGreater(max(abs(x),abs(y)),.85)
        self.assertFalse(result['connectivity_verified'])

    def test_blocked_reports_failure(self):
        s=fixture(); s['pads'].append({**s['pads'][0],'id':'p2','net':'VCC','size_mm':[8,8]})
        result=m.ground(s,{})
        self.assertFalse(result['returns']); self.assertEqual(len(result['failures']),1)

    def test_no_crossing_other_net_wall(self):
        s=fixture(); s['tracks']=[{'net':'VCC','layer':1,'width_mm':.2,'points':[[.7,-5],[.7,5]]}]
        result=m.ground(s,{})
        self.assertLess(result['returns'][0]['via'][0],.7-.1-.3-.155)

    def test_reuse_exact_existing_via(self):
        s=fixture(); s['vias']=[{'xy':[.61,.017],'net':'GND','diameter_mm':.6,'drill_mm':.3,'through':True}]
        r=m.ground(s,{})
        self.assertFalse(r['returns'][0]['new_via'])
        self.assertEqual(r['returns'][0]['points'][-1],[.61,.017])

    def test_hole_and_edge_clearance(self):
        s=fixture(); s['pads'][0]['xy']=[4,0]
        s['board']['holes']=[{'xy':[3,0],'diameter_mm':.4,'plated':False,'copper_keepout_mm':.2}]
        r=m.ground(s,{})
        for v in r['new_vias']:
            x,y=v['xy']; self.assertLess(abs(x),4.45); self.assertLess(abs(y),4.45)
            self.assertGreater(((x-3)**2+y*y)**.5,.2+.2+.3)

    def test_fail_closed_and_bounded(self):
        for change in ({'units':'mil'},{'zones':[]},{'obstacle_coverage':'unknown'}):
            with self.subTest(change=change), self.assertRaises(ValueError): m.ground({**fixture(),**change},{})
        with self.assertRaises(ValueError): m.ground(fixture(),{'radius_mm':10,'step_mm':.01})
        with self.assertRaises(ValueError): m.ground(fixture(),{'via_drill_mm':.8})
        with self.assertRaises(ValueError): m.ground(fixture(),{'pad_ids':['missing']})
        s=fixture(); s['board']['outline']=[[-1,-1],[1,1],[-1,1],[1,-1]]
        with self.assertRaises(ValueError): m.ground(s,{})

    def test_duplicate_pad_conflicts(self):
        s=fixture(); s['pads'].append(copy.deepcopy(s['pads'][0]))
        self.assertEqual(len(m.ground(s,{})['returns']),1)
        s=fixture(); s['pads'].append({**s['pads'][0],'net':'VCC'})
        with self.assertRaises(ValueError): m.ground(s,{})

    def test_mechanical_optical_axis_and_unknown_height(self):
        s=fixture(); s['pads'][0]['xy']=[0,2]
        s['pads'].append({**s['pads'][0],'id':'p2','number':'2','xy':[0,-2]})
        s['components']=[{'reference':'D1','xy':[0,0],'rotation_deg':-90,'side':'top'}]
        r=m.mechanical(s,{'optical_datums':[{'name':'die','from_pad':'p1','toward_pad':'p2','offset_from_midpoint_mm':.18,'source':'datasheet'}]})
        self.assertEqual(r['optical_datums'][0]['xy'],[0,-.18])
        self.assertIsNone(r['components'][0]['height_mm'])
        self.assertEqual(r['bottom_surface_z_mm'],-1.6)

    def test_gerber_drills_and_bottom_mirroring(self):
        gerber='%FSLAX46Y46*%\n%MOMM*%\n%ADD10C,0.1*%\nD10*\nX0000000000Y0000000000D02*\nX0010000000Y0000000000D01*\nX0010000000Y0010000000D01*\nX0000000000Y0010000000D01*\nX0000000000Y0000000000D01*\nM02*\n'
        drill='M48\nMETRIC,TZ\nT01C1.000\n%\nT01\nX2.000Y3.000\nM30\n'
        with tempfile.TemporaryDirectory() as tmp:
            out=Path(tmp); archive=out/'board.zip'
            with zipfile.ZipFile(archive,'w') as z:
                for name in ['top.gtl','bottom.gbl','outline.gko']: z.writestr(name,gerber)
                for name in ['pth.drl','duplicate.drl']: z.writestr(name,drill)
                z.writestr('npth.drl',drill.replace('X2.000','X4.000'))
            before=archive.read_bytes()
            result=m.gerbers(archive,out,{'layers':{'top copper':'top.gtl','bottom copper':'bottom.gbl','mechanical outline':'outline.gko'},
                'drills':[{'file':'pth.drl','plated':True},{'file':'duplicate.drl','plated':True},{'file':'npth.drl','plated':False}]})
            self.assertEqual(result['duplicate_drill_hits_omitted_from_preview'],1)
            self.assertEqual(result['drill_objects_rendered'],2)
            for side in ('top','bottom'):
                root=ET.parse(result['svg'][side]).getroot()
                self.assertEqual(len([e for e in root.iter() if e.attrib.get('id','').startswith('l-drill-')]),3)
                groups=[e for e in root.iter() if e.attrib.get('id','').startswith('l-drill-')]
                self.assertTrue(all('filter' not in e.attrib for e in groups))
                self.assertEqual(sum(len(e) for e in groups),2)
            self.assertIn('scale(-1 1)',Path(result['svg']['bottom']).read_text())
            self.assertNotIn('scale(-1 1)',Path(result['svg']['top']).read_text())
            self.assertEqual(before,archive.read_bytes())


if __name__=='__main__': unittest.main()
