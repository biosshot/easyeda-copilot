


/**
 * 入口文件
 *
 * 本文件为默认扩展入口文件，如果你想要配置其它文件作为入口文件，
 * 请修改 `extension.json` 中的 `entry` 字段；
 *
 * 请在此处使用 `export`  导出所有你希望在 `headerMenus` 中引用的方法，
 * 方法通过方法名与 `headerMenus` 关联。
 *
 * 如需了解更多开发细节，请阅读：
 * https://prodocs.lceda.cn/cn/api/guide/
 */
import { assembleCircuit } from './eda/assemble';
import extension from '../extension.json';
import { getAsmCircuit, getSchematic } from './eda/schematic';
import '@copilot/shared/types/eda';
import { searchComponentInSCH } from './eda/search';

eda.assembleCircuit = assembleCircuit;
eda.getSchematic = getSchematic;
eda.getAsmCircuit = getAsmCircuit;
eda.searchComponentInSCH = searchComponentInSCH;

export function activate(status?: 'onStartupFinished', arg?: string) { }

export async function about() {
	eda.sys_Dialog.showInformationMessage(`${extension.displayName} Extension\nVersion ${extension.version}\n\nRepository ${extension.repository.url}\n\nDeveloped by ${extension.publisher}`);
}

export async function openInterface() {
	eda.sys_IFrame.openIFrame('/iframe/index.html', 520, 700);
}

export async function importAsmCircuit() {
	eda.sys_FileSystem.openReadFileDialog(undefined, false).then(async (file) => {
		if (!file) return eda.sys_Message.showToastMessage("No file", ESYS_ToastMessageType.ERROR);
		const text = await file.text();
		const json = JSON.parse(text);
		assembleCircuit(json);
	});
}

export async function exportAsmCircuit() {
	const asmCircuit = await getAsmCircuit(await eda.sch_PrimitiveComponent.getAllPrimitiveId().then(r => [...r]));
	eda.sys_FileSystem.saveFile(new Blob([JSON.stringify(asmCircuit, null, 2)], { type: 'text/plain' }), `asm_circuit.json`);
}

export async function exportReused() {
	eda.sys_IFrame.openIFrame('/iframe/reused.html', 900, 700);
}