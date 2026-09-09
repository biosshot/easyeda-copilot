import assert from 'assert';
import test from 'node:test';
import { readFile } from 'fs/promises';
import path from 'path';
import { decryptEasyEdaDataStr } from '../src/devices/easy-eda-datastr.ts';

const buf = Buffer.from([98, 221, 194, 183, 224, 235, 75, 218, 100, 187, 37, 225, 54, 92, 36, 35, 75, 226,
    70, 190, 36, 207, 207, 245, 111, 101, 175, 89, 238, 234, 56, 166, 212, 62, 134, 137, 144, 255, 127, 235,
    35, 138, 40, 193, 99, 177, 182, 12, 158, 241, 60, 13, 176, 64, 144, 65, 60, 123, 248, 111, 199, 140, 85,
    44, 128, 164, 63, 46, 41, 153, 91, 187, 7, 225, 119, 162, 135, 246, 50, 217, 47, 80, 197, 169, 225, 230,
    113, 77, 57, 102, 43, 12, 40, 161, 148, 184, 90, 153, 53, 239, 226, 113, 88, 21, 47, 5, 72, 96, 57, 23,
    57, 61, 186, 32, 108, 171, 21, 63, 36, 109, 123, 254, 3, 45, 185, 231, 46, 78, 64, 17, 170, 11, 156, 26,
    213, 156, 54, 93, 206, 112, 149, 149, 214, 56, 168, 86, 208, 154, 32, 251, 222, 241, 79, 18, 125, 144,
    39, 217, 13, 252, 237, 107, 85, 253, 108, 25, 86, 101, 174, 139, 58, 37, 41, 242, 84, 129, 18, 225, 221,
    120, 88, 20, 174, 188, 100, 229, 186, 204, 49, 104, 32, 229, 30, 214, 64, 157, 50, 63, 60, 235, 246, 10,
    46, 39, 114, 43, 45, 26, 229, 33, 130, 193, 205, 228, 5, 226, 69, 51, 249, 142, 251, 122, 25, 133, 185,
    226, 164, 8, 181, 244, 187, 139, 200, 157, 142, 86, 152, 91, 64, 196, 149, 202, 89, 117, 133, 78, 78,
    222, 242, 181, 88, 52, 139, 106, 162, 218, 203, 194, 182, 113, 12, 125, 194, 127, 227, 60, 188, 242,
    129, 100, 3, 236, 2, 213, 64, 211, 151, 51, 163, 108, 109, 86, 117, 227, 188, 174, 250, 199, 153, 222,
    8, 115, 175, 34, 56, 104, 236, 52, 23, 61, 244, 43, 62, 236, 13, 65, 189, 117, 196, 247, 10, 84, 193,
    201, 95, 189, 187, 109, 122, 108, 132, 80, 233, 101, 123, 147, 116, 226, 46, 120, 86, 215, 39, 98,
    219, 2, 142, 19, 148, 234, 251, 236, 197, 3, 168, 77, 102, 131, 71, 129, 184, 34, 207, 216, 52, 101,
    105, 93, 56, 136, 131, 132, 4, 120, 239, 178, 54, 101, 101, 191, 130, 69, 47, 234, 228, 64, 42, 240, 29,
    15, 112, 144, 88, 219, 100, 24, 45, 179, 3, 224, 3, 96, 115, 11, 96, 195, 155, 182, 123, 65, 5, 7, 65,
    244, 93, 9, 83, 182, 12, 68, 207, 239, 6, 114, 127, 119, 105, 17, 143, 44, 251, 122, 233, 60, 3, 105, 110,
    9, 94, 145]);

const key = 'aa2c8f263371f0066bc705e87042a830993579486e3dadab28817076ece17d92';
const iv = 'f239bd4f7c6fc41726c3b26a';

const expectedLines = [
    '["DOCTYPE","SYMBOL","1.1"]',
    '["HEAD",{"symbolType":2,"originX":0,"originY":0,"version":"0.13.0"}]',
    '["LINESTYLE","st1",null,null,null,null,null]',
    '["FONTSTYLE","st2",null,null,null,null,null,null,null,null,null,0]',
    '["FONTSTYLE","st3",null,null,null,null,0,0,0,0,2,0]',
    '["FONTSTYLE","st4",null,null,null,null,0,0,0,0,2,2]',
    '["PART","FRC0603J2R2TS.1",{"BBOX":[-10,-5,10,5]}]',
    '["ATTR","e1","","Symbol","FRC0603J2R2TS",false,false,null,null,0,"st3",0]',
    '["ATTR","e2","","Designator","R?",false,false,null,null,0,"st3",0]',
    '["RECT","e3",-10,-5,10,5,0,0,0,"st1",0]',
    '["PIN","e4",1,null,20,0,10,180,null,0,0,1]',
    '["ATTR","e5","e4","NAME","2",false,false,6,-1.91498,0,"st4",0]',
    '["ATTR","e6","e4","NUMBER","2",false,false,14,2.08502,0,"st3",0]',
    '["ATTR","e7","e4","Pin Type","Undefined",false,false,20,0,0,"st2",0]',
    '["PIN","e8",1,null,-20,0,10,0,null,0,0,1]',
    '["ATTR","e9","e8","NAME","1",false,false,-6,-1.91498,0,"st3",0]',
    '["ATTR","e10","e8","NUMBER","1",false,false,-14,2.08502,0,"st4",0]',
    '["ATTR","e11","e8","Pin Type","Undefined",false,false,-20,0,0,"st2",0]'
];

test('decryptEasyEdaDataStr should decode fixture and match expected lines', async () => {
    const decoded = decryptEasyEdaDataStr(buf, key, iv);
    const lines = decoded.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    assert.strictEqual(lines.length, expectedLines.length, `lines count mismatch: got ${lines.length}`);
    for (let i = 0; i < expectedLines.length; i++) {
        assert.strictEqual(lines[i], expectedLines[i], `line ${i} mismatch`);
    }
});
