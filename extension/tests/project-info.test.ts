import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeProjectInfo } from '../src/eda/project-info.ts';

const itemTypes = { BOARD: 'Board', SCHEMATIC: 'Schematic', PCB: 'PCB' };
const page = { name: 'Main', itemType: 'SchematicPage', uuid: 'page-1' };

test('serializes boards with missing linked documents without failing the whole project read', () => {
    const result = serializeProjectInfo({
        uuid: 'project-1',
        friendlyName: 'Robot',
        description: 'Carrier boards',
        data: [
            {
                name: 'PCB only', itemType: 'Board', uuid: 'board-1', page: [], schematic: null,
                pcb: { name: 'Drive PCB', itemType: 'PCB', uuid: 'pcb-1', parentBoardName: 'PCB only' },
            },
            {
                name: 'Schematic only', itemType: 'Board', uuid: 'board-2', page: [], pcb: null,
                schematic: { name: 'Control', itemType: 'Schematic', uuid: 'sch-1', page: [page] },
            },
        ],
    }, itemTypes);

    assert.equal(result.project_uuid, 'project-1');
    assert.equal(result.project_name, 'Robot');
    assert.equal(result.project_data[0].schematic, null);
    assert.equal(result.project_data[0].pcb?.uuid, 'pcb-1');
    assert.equal(result.project_data[1].pcb, null);
    assert.equal(result.project_data[1].schematic?.page[0].uuid, 'page-1');
});

test('preserves standalone schematic and PCB records', () => {
    const result = serializeProjectInfo({
        uuid: 'project-2',
        data: [
            { name: 'Loose schematic', itemType: 'Schematic', uuid: 'sch-2', page: [page], parentBoardUuid: undefined },
            { name: 'Loose PCB', itemType: 'PCB', uuid: 'pcb-2', page: [], parentBoardName: undefined },
        ],
    }, itemTypes);

    assert.deepEqual(result.project_data.map(item => item.uuid), ['sch-2', 'pcb-2']);
});
