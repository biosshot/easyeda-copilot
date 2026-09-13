"""Optional geometry example tests; run with Shapely installed."""
import math
import sys
sys.dont_write_bytecode = True
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'docs/execution/examples/shapely'))
from eda_geometry import path_points,source_geometry,pad_geometry
from shapely.geometry import Polygon,Point
from easyeda_copilot.units import convert_length,mil_to_mm,mm_to_mil,assert_unit_scale

class GeometryTests(unittest.TestCase):
    def test_units(self):
        self.assertAlmostEqual(mil_to_mm(100),2.54)
        self.assertAlmostEqual(mm_to_mil(2.54),100)
        self.assertAlmostEqual(convert_length(10,.254),2.54)
        assert_unit_scale(10,2.54,.254,.001)
        for args in [(10,2.54,.0254,.001),(0,0,.254,.001),(10,2.54,.254,2)]:
            with self.assertRaises(ValueError):assert_unit_scale(*args)
        for args in [(True,1),(math.nan,1),(1,0),(1,-1),(1,1,0)]:
            with self.assertRaises(ValueError):convert_length(*args)

    def test_holes_and_nested_islands(self):
        src=[['R',0,10,10,10,0,0],['R',2,8,6,6,0,0],['R',4,6,2,2,0,0]]
        g=source_geometry(src,mm_per_unit=1)
        self.assertAlmostEqual(g.area,68)
        self.assertFalse(g.covers(Point(3,3)))
        self.assertTrue(g.covers(Point(5,5)))
        self.assertAlmostEqual(source_geometry(src,mm_per_unit=.1).area,.68)

    def test_signed_arc_and_angle_not_scaled(self):
        src=[1,0,'ARC',180,-1,0,'L',1,0]
        g=source_geometry(src,mm_per_unit=1,max_error_mm=.0001)
        self.assertAlmostEqual(g.area,math.pi/2,delta=.001)
        self.assertGreater(g.centroid.y,0)
        reverse=source_geometry([1,0,'ARC',-180,-1,0,'L',1,0],mm_per_unit=1,max_error_mm=.0001)
        self.assertLess(reverse.centroid.y,0)
        scaled=source_geometry(src,mm_per_unit=10,max_error_mm=.001)
        self.assertAlmostEqual(scaled.area,g.area*100,delta=.001)

    def test_circle_stroke_and_cubic(self):
        g=source_geometry(['CIRCLE',0,0,2],mm_per_unit=1,max_error_mm=.001)
        self.assertAlmostEqual(g.area,4*math.pi,delta=.02)
        stroke=source_geometry([0,0,'L',10,0],mm_per_unit=.1,filled=False,line_width=2,max_error_mm=.0001)
        self.assertAlmostEqual(stroke.area,.2+math.pi*.01,delta=.001)
        points=path_points([0,0,'C',0,1,1,1,1,0],mm_per_unit=1,max_error_mm=.001)
        self.assertEqual(points[0],(0,0));self.assertEqual(points[-1],(1,0))
        self.assertAlmostEqual(max(y for x,y in points),.75)

    def test_pads_pose_and_shapes(self):
        g=pad_geometry(['RECT',2,4,0],10,20,90,mm_per_unit=1)
        self.assertEqual(g.bounds,(8,19,12,21))
        self.assertAlmostEqual(pad_geometry(['ELLIPSE',2,2],0,0,0,mm_per_unit=1,max_error_mm=.0001).area,math.pi,delta=.002)
        self.assertAlmostEqual(pad_geometry(['OVAL',4,2],0,0,0,mm_per_unit=1,max_error_mm=.0001).area,4+math.pi,delta=.002)

    def test_unsupported_and_invalid_are_explicit(self):
        for src in [[0,0,'BOGUS',1,2],['R',0,0,2,2,45,0],[0,0,'L',1],['CIRCLE',0,0,-1],[0,0,'ARC',360,0,0]]:
            with self.assertRaises(ValueError):source_geometry(src,mm_per_unit=1)
        bowtie=[0,0,'L',2,2,0,2,2,0,0,0]
        with self.assertRaises(ValueError):source_geometry(bowtie,mm_per_unit=1)
        with self.assertWarns(RuntimeWarning):
            g=source_geometry(bowtie,mm_per_unit=1,repair_invalid=True)
        self.assertTrue(g.is_valid)
        diagnostics=[]
        with self.assertWarns(RuntimeWarning):
            spur=source_geometry([0,0,'L',2,0,2,2,1,2,1,3,1,2,0,2,0,0],mm_per_unit=1,repair_invalid=True,diagnostics=diagnostics)
        self.assertAlmostEqual(spur.area,4)
        self.assertIn('LineString',diagnostics[0]['discarded_non_area_types'])
        with self.assertRaises(ValueError):source_geometry(['R',0,0,1,1,0,0],mm_per_unit=1,fill_rule='nonzero')

if __name__=='__main__':unittest.main()
