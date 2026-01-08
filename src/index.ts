


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
import { PDFDocument, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import Papa from 'papaparse';
import { assembleCircuit } from './assembleCircuit';
import extension from '../extension.json';

(eda as any).assembleCircuit = assembleCircuit;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string) { }

export async function about() {
	// const json = await fetch("http://[::1]:3000/make-scheme/ddd").then(res => res.json());
	eda.sys_Dialog.showInformationMessage(`${extension.displayName} Extension\nVersion ${extension.version}\n\nRepository ${extension.repository.url}\n\nDeveloped by ${extension.publisher}`);
}

export async function openInterface() {
	eda.sys_IFrame.openIFrame('/iframe/index.html', 520, 700);
}

export async function importCircuit() {
	eda.sys_FileSystem.openReadFileDialog(undefined, false).then(async (file: any) => {
		const text = await file.text();
		const json = JSON.parse(text);
		assembleCircuit(json);
	});
}

function getBomCsv() {
	return eda.sch_ManufactureData.getBomFile("file.csv", 'csv', undefined, undefined,
		["Number"],
		["Designator", "Value", "Manufacturer Part", "Name", "Device", 'Footprint'],
		[
			{
				property: "Designator",
				sort: "asc",
				group: "Yes",
				orderWeight: 99
			},
		]).then(async (result) => {
			if (!result) return null;
			return await result.text();
		}).catch(() => null);
}

const ElementypeMap: [RegExp, string][] = [
	// Резисторы
	[/^R\d/, "Резисторы"],
	[/^RN\d/, "Резисторы"], // Резисторные сети
	[/^RP\d/, "Резисторы"], // Подстроечные резисторы (иногда)

	// Конденсаторы
	[/^C\d/, "Конденсаторы"],
	[/^CP\d/, "Конденсаторы"], // Подстроечные/переменные конденсаторы

	// Индуктивности
	[/^L\d/, "Индуктивности"],
	[/^T\d/, "Трансформатор"], // По ГОСТ T — трансформатор, но в международной практике часто L или T
	[/^TR\d/, "Трансформатор"], // Альтернативное обозначение

	// Диоды и полупроводники
	[/^D\d/, "Диоды"],
	[/^VD\d/, "Диоды"], // По ГОСТ
	[/^ZD\d/, "Стабилитроны"], // Иногда выделяют отдельно, но обычно входят в "Диоды"
	[/^LED\d/, "Светодиоды"],
	[/^VL\d/, "Светодиоды"], // По ГОСТ

	// Транзисторы
	[/^Q\d/, "Транзистор"],
	[/^VT\d/, "Транзистор"], // По ГОСТ
	[/^TR\d/, "Транзистор"], // Редко, но встречается

	// Микросхемы (ИМС)
	[/^U\d/, "Микросхемы"],
	[/^IC\d/, "Микросхемы"],
	[/^DD\d/, "Микросхемы"], // По ГОСТ — цифровые ИМС
	[/^DA\d/, "Микросхемы"], // По ГОСТ — аналоговые ИМС
	[/^DZ\d/, "Микросхемы"], // По ГОСТ — ИМС другого типа

	// Кварцевые резонаторы, кристаллы
	[/^X\d/, "Кварцевые резонаторы"],
	[/^Y\d/, "Кварцевые резонаторы"], // ANSI/IEEE: Y — crystal
	[/^XTAL\d/, "Кварцевые резонаторы"],

	// Разъемы
	[/^J\d/, "Разъемы"],
	[/^P\d/, "Разъемы"], // Plug (вилка) — ANSI
	[/^CN\d/, "Разъемы"],
	[/^CON\d/, "Разъемы"],
	[/^H\d/, "Разъемы"],
	[/^XP\d/, "Разъемы"], // По ГОСТ — штыревой разъём
	[/^XS\d/, "Разъемы"], // По ГОСТ — гнездовой разъём
	[/^USB\d/, "Разъемы"],
	[/^HDMI\d/, "Разъемы"],
	[/^JACK\d/, "Разъемы"],

	// Переключатели, кнопки
	[/^SW\d/, "Кнопки"],
	[/^S\d/, "Кнопки"], // Switch — ANSI
	[/^SB\d/, "Кнопки"], // По ГОСТ — кнопочные выключатели
	[/^SA\d/, "Переключатели"], // По ГОСТ — переключатели

	// Реле
	[/^K\d/, "Реле"],
	[/^RLY\d/, "Реле"],
	[/^KR\d/, "Реле"], // По ГОСТ

	// Предохранители
	[/^F\d/, "Предохранители"],
	[/^FU\d/, "Предохранители"], // По ГОСТ

	// Громкоговорители, зуммеры
	[/^SPK\d/, "Акустика"],
	[/^BZ\d/, "Зуммеры"],
	[/^HA\d/, "Акустика"], // По ГОСТ — звуковые излучатели

	// Антенны
	[/^ANT\d/, "Антенны"],
	[/^AE\d/, "Антенны"], // По ГОСТ
	[/^RF\d/, "Антенны"], // По ГОСТ

	// Источники питания, батареи
	[/^BT\d/, "Батареи"],
	[/^B\d/, "Батареи"],
	[/^G\d/, "Источники питания"], // По ГОСТ — генераторы, источники
	[/^PWR\d/, "Источники питания"],

	// Оптоэлектроника
	[/^OP\d/, "Оптоэлектроника"],
	[/^OK\d/, "Оптоэлектроника"], // По ГОСТ — оптрон

	// Печатные узлы, платы
	[/^PCB\d/, "Печатные платы"],
	[/^A\d/, "Устройства"], // По ГОСТ — сборочные единицы

	// Термисторы, варисторы и т.п.
	[/^TH\d/, "Термисторы"],
	[/^RV\d/, "Варисторы"],

	// Микрофоны
	[/^MIC\d/, "Микрофоны"],
	[/^BM\d/, "Микрофоны"], // По ГОСТ

	// Дисплеи
	[/^DS\d/, "Дисплеи"],
	[/^LCD\d/, "Дисплеи"],
	[/^OLED\d/, "Дисплеи"],

	// Прочее
	[/^TP\d/, "Контрольные точки"],
	[/^TEST\d/, "Контрольные точки"],
];

const getElementLabel = (designator: string) => {
	for (const [regex, name] of ElementypeMap)
		if (regex.test(designator.toUpperCase()))
			return [regex.toString(), name];
	return [null, null]; // или "Неизвестный элемент"
}

interface Line {
	startDesignator: string,
	endDesignator: string | null,
	desc: string,
	part: string;
	quantity: number
}

function parseLine(BOM: any[]) {
	const norm = (str: string) => str.replace(/[^a-zA-Z0-9\s.,!?;:'"()\-]/g, '');

	const lines: Line[] = [];

	const normLine = (line: any) => {
		let part = norm(line['Manufacturer Part'] || line['Name'] || line['Device']);
		if (line['Footprint'] && line['Footprint'].length < 24)
			part += ', ' + line['Footprint']
		const desc = norm(line['Name'] || line['Value']);
		return [part, desc];
	}

	for (const line of BOM) {
		const pline = lines.at(-1);

		const [preg, ptype] = getElementLabel(pline?.startDesignator ?? "");
		const [lreg, type] = getElementLabel(line.Designator);

		const [part, desc] = normLine(line);

		const isEqualsElements = (pline?.part === part || pline?.desc === desc) && preg === lreg;

		if (!pline || !isEqualsElements) {

			lines.push({
				startDesignator: line.Designator,
				endDesignator: null,
				part: part,
				desc: desc,
				quantity: 1
			});

			continue;
		}

		if (ptype === type && preg === lreg && isEqualsElements) {
			pline.endDesignator = line.Designator;
			pline.quantity++;
		}
	}

	return lines;
}

export async function exportBomGOST() {

	let projectName = "Мой проект";
	let projectId = "";
	let projectGroup = "";

	await eda.dmt_Project.getCurrentProjectInfo().then(info => {
		const board = info?.data[0];
		if (!board || board.itemType !== EDMT_ItemType.BOARD) return;
		if (!board.schematic.page[0].titleBlockData) return;
		const { titleBlockData } = board.schematic.page[0];

		if (titleBlockData["@Project Name"].value)
			projectName = titleBlockData["@Project Name"].value;

		if (titleBlockData["Company"].value)
			projectGroup = titleBlockData["Company"].value;

		if (titleBlockData["Description"].value)
			projectId = titleBlockData["Description"].value;
	}).catch(() => { });

	const fetchResource = (resource: string) => eda.sys_FileSystem.getExtensionFile(resource).then((file) => file?.arrayBuffer?.())

	let csvData = await getBomCsv();
	if (!csvData) return eda.sys_Dialog.showInformationMessage('Error with export BOM');;

	csvData = csvData.replaceAll('Ω', 'R');

	const BOM: any[] = Papa.parse(csvData, {
		header: true,
		skipEmptyLines: true,
		delimiter: '\t'
	}).data;

	const lines: Line[] = parseLine(BOM);

	const grouped: Record<string, Line[]> = {};

	for (const line of lines) {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const [_, type] = getElementLabel(line.startDesignator);

		if (!type) {
			eda.sys_Message.showToastMessage("Not found label for line: " + JSON.stringify(line, null, 2), ESYS_ToastMessageType.ERROR)
			continue;
		}

		if (!grouped[type]) {
			grouped[type] = [];
		}

		grouped[type].push(line);
	}

	const getGroupTexts = (group: Line[]) => {
		let designators = [];
		let names = [];
		let quantities = [];
		let descs = [];

		for (const line of group) {
			if (!line.endDesignator)
				designators.push(line.startDesignator);
			else if (line.quantity === 2)
				designators.push(line.startDesignator + ',' + line.endDesignator);
			else
				designators.push(line.startDesignator + '-' + line.endDesignator);

			names.push(line.part);
			quantities.push(line.quantity);
			descs.push(line.desc);
		}

		return {
			designators,
			names,
			quantities,
			descs,
		}
	}

	const firstPageBytes = await fetchResource('/templates/gost/gostLE_fp.pdf');
	if (!firstPageBytes) return eda.sys_Message.showToastMessage('Cannot load first page template PDF file', ESYS_ToastMessageType.ERROR);

	const nextPageBytes = await fetchResource('/templates/gost/gostLE_np.pdf');
	if (!nextPageBytes) return eda.sys_Message.showToastMessage('Cannot load next page template PDF file', ESYS_ToastMessageType.ERROR);

	const pdfDoc = await PDFDocument.load(firstPageBytes);
	const pdfNpDoc = await PDFDocument.load(nextPageBytes);

	const fontBytes = await fetchResource('/templates/gost/GOST_B.TTF')
	if (!fontBytes) return eda.sys_Message.showToastMessage('Cannot load font file', ESYS_ToastMessageType.ERROR);

	pdfDoc.registerFontkit(fontkit as any);
	const customFont = await pdfDoc.embedFont(fontBytes);

	let page = pdfDoc.getPage(0); // или pages[n] для другой страницы

	const fontSize = 11;
	const lineHeight = 22.65;

	const offset = 768;

	let currentLine = -1;

	const linesInFirstPage = 27;
	const linesInNextPage = 30;

	const getCurrentY = () => offset - lineHeight * (currentLine + 1);
	const getCurrentPageMaxLines = () => pdfDoc.getPages().length === 1 ? linesInFirstPage : linesInNextPage;

	const newPage = async () => {
		const copiedPages = await pdfDoc.copyPages(pdfNpDoc, [0])
		page = pdfDoc.addPage(copiedPages[0]);

		// Добавляем текст
		page.drawText(pdfDoc.getPageCount().toString(), {
			x: 560,
			y: 20,
			size: fontSize,
			color: rgb(0, 0, 0), // черный цвет
			lineHeight: lineHeight,
			font: customFont,
		});

		// Добавляем текст
		page.drawText(projectId, {
			x: 260,
			y: 30,
			size: fontSize * 1.4,
			color: rgb(0, 0, 0), // черный цвет
			lineHeight: lineHeight,
			font: customFont,
		});

	};

	// Добавляем текст
	page.drawText(projectName, {
		x: 250,
		y: 65,
		size: fontSize * 1.4,
		color: rgb(0, 0, 0), // черный цвет
		lineHeight: lineHeight,
		font: customFont,
	});

	// Добавляем текст
	page.drawText(projectId, {
		x: 260,
		y: 105,
		size: fontSize * 1.1,
		color: rgb(0, 0, 0), // черный цвет
		lineHeight: lineHeight,
		font: customFont,
	});

	// Добавляем текст
	page.drawText(projectGroup, {
		x: 445,
		y: 30,
		size: fontSize * 1.4,
		color: rgb(0, 0, 0), // черный цвет
		lineHeight: lineHeight,
		font: customFont,
	});


	for (const [group, data] of Object.entries(grouped)) {
		let {
			designators,
			names,
			quantities,
			descs,
		} = getGroupTexts(data)

		let avalLines = getCurrentPageMaxLines() - currentLine;

		if (avalLines < 4) {
			await newPage();
			currentLine = -1;
		}

		currentLine += 1;

		// Добавляем текст
		page.drawText(group, {
			x: 240,
			y: getCurrentY(),
			size: fontSize,
			color: rgb(0, 0, 0), // черный цвет
			lineHeight: lineHeight,
			font: customFont,
		});

		currentLine += 2;

		while (true) {
			let avalLines = getCurrentPageMaxLines() - currentLine;
			if (!descs.length) break;

			if (avalLines <= 0) {
				await newPage();
				currentLine = 0;
				avalLines = getCurrentPageMaxLines();
			}

			const subDes = designators.slice(0, avalLines);
			const designatorsText = subDes.slice(0, avalLines).join('\n')
			designators = designators.slice(avalLines);

			const namesText = names.slice(0, avalLines).join('\n')
			names = names.slice(avalLines);

			const quantitiesText = quantities.slice(0, avalLines).join('\n')
			quantities = quantities.slice(avalLines);

			// const descsText = descs.slice(0, avalLines).join('\n')
			// descs = descs.slice(avalLines);


			// Добавляем текст
			page.drawText(designatorsText, {
				x: 60,
				y: getCurrentY(),
				size: fontSize,
				color: rgb(0, 0, 0), // черный цвет
				lineHeight: lineHeight,
				font: customFont,
			});

			// Добавляем текст
			page.drawText(namesText, {
				x: 120,
				y: getCurrentY(),
				size: fontSize,
				color: rgb(0, 0, 0), // черный цвет
				lineHeight: lineHeight,
				font: customFont,
			});

			// Добавляем текст
			page.drawText(quantitiesText, {
				x: 430,
				y: getCurrentY(),
				size: fontSize,
				color: rgb(0, 0, 0), // черный цвет
				lineHeight: lineHeight,
				font: customFont,
			});

			// Добавляем текст
			// page.drawText(descsText, {
			// 	x: 460,
			// 	y: getCurrentY(),
			// 	size: fontSize,
			// 	color: rgb(0, 0, 0), // черный цвет
			// 	lineHeight: lineHeight,
			// 	font: customFont,
			// });

			currentLine += subDes.length;
		}
	}

	eda.sys_Message.showToastMessage('Export completed successfully', ESYS_ToastMessageType.SUCCESS);

	// Сохраняем изменённый PDF
	const modifiedPdfBytes: Uint8Array = await pdfDoc.save();

	// @ts-ignore
	eda.sys_FileSystem.saveFile(new Blob([modifiedPdfBytes]), `${projectName}_LE.pdf`);
}
