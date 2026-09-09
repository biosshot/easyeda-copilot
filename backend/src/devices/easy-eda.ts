import { type Component } from "#types/component.ts";
import { extractPinsFromComponent, getSymbol } from "./symbols/symbol-parser.ts";
import { fetchWithRetry } from "#utils/fetch-with-retry.ts";
import type { EasyEdaProductApiResponce, EasyEdaProduct, EasyEdaDeviceInfo, EasyEdaDeviceApiResult, EasyEdaApiResponce, SymbolInfo } from "#types/easy-eda-api.ts";
import { memoize } from "#utils/memoize.ts";
import { normalizeEasyEdaSymbolInfo } from "./easy-eda-datastr.ts";

export const getEasyEdaSymbolInfo = memoize(async (symUuid: string) => {
    const res = await fetchWithRetry(`https://pro.easyeda.com/api/v2/components/${symUuid}?uuid=${symUuid}&path=lcsc`);
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json() as EasyEdaApiResponce<SymbolInfo>;
    if (!json.success || !json.result) {
        throw new Error(`Not success: ${json.success} ${json.msg}`);
    }
    return normalizeEasyEdaSymbolInfo(json.result);
});

export const getEasyEdaDevice = memoize(async (uuid: string) => {
    const res = await fetchWithRetry(`https://pro.easyeda.com/api/devices/${uuid}?uuid=${uuid}&path=lcsc`);
    if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
    }
    const json = await res.json() as EasyEdaApiResponce<EasyEdaDeviceApiResult>;
    if (!json.success || !json.result) {
        throw new Error(`Not success: ${json.success} ${json.msg}`);
    }
    return json.result;
});

export function easyEdaProductToComponent(product: EasyEdaProduct): Component {
    const pins = extractPinsFromComponent(product);
    return {
        pins: pins ?? [],
        price: Number(product.price?.[0]?.[1]) || 0, // Fallback to 0 if price missing
        name: product.device_info?.attributes?.["Manufacturer Part"] || 'Unknown',
        manufacturer: product.manufacturer || 'Unknown',
        description: product.device_info?.description || '',
        part_uuid: product.device_info?.uuid ?? '',
        datasheet: product.device_info?.attributes?.Datasheet || '',
        designatorPattern: product.device_info?.attributes?.Designator ?? null,
        footprintName: product.device_info?.footprint_info.title ?? null
    };
}

export async function normalizeEasyEdaProductSymbolInfo(product: EasyEdaProduct) {
    const symbolInfo = product.device_info?.symbol_info;
    if (!symbolInfo) return product;

    product.device_info!.symbol_info = await normalizeEasyEdaSymbolInfo(symbolInfo);
    return product;
}

export async function easyEdaDeviceToComponent(device: EasyEdaDeviceInfo | EasyEdaDeviceApiResult): Promise<Component | undefined> {
    return easyEdaSearch(device.product_code).then(r => r[0]);
}

export async function easyEdaSearch(
    data: { catalogId: number, params: { [key: string]: string | string[] } | null, currPage: number, pageSize: number } | string,
    filter: (comp: Component) => boolean = () => true,
    fullPage = true
): Promise<Component[]> {
    const MAX_PER_PAGE = 50; // API enforces maximum 50 items per page
    const pathParam = '0819f05c4eef4c71ace90d822a990e87'; // Fixed path for keyword search
    let targetPageSize: number;
    let startingPage: number;
    let urlParamsForCatalog: string | null = null;

    // Determine search mode and initialize parameters
    if (typeof data === "string") {
        targetPageSize = 5; // Default to max page size for keyword search
        startingPage = 1;
    } else {
        targetPageSize = data.pageSize;
        startingPage = Math.max(1, data.currPage); // Ensure valid starting page
        // Precompute catalog parameters to avoid recalculating in loop
        urlParamsForCatalog = Object.entries(data.params ?? {})
            .map(([key, value]) => (Array.isArray(value) ? value : [value])
                .map(v => `${v}@${key}`)
                .join('$'))
            .join('$');
    }

    const collected: EasyEdaProduct[] = []; // Stores raw component data before mapping
    let result: Component[] = []; // Stores raw component data before mapping

    let currentPage = startingPage;

    // Continue fetching until we have enough components or run out of pages
    while (result.length < targetPageSize) {
        let response: Response;
        let json: EasyEdaProductApiResponce;

        try {
            // Handle keyword search (POST request)
            if (typeof data === "string") {
                const body = new URLSearchParams({
                    keyword: data,
                    currPage: currentPage.toString(),
                    pageSize: MAX_PER_PAGE.toString(),
                    path: pathParam
                });
                response = await fetchWithRetry('https://pro.easyeda.com/api/v2/eda/product/search', {
                    method: 'POST',
                    body
                }) as unknown as Response;;
            }
            // Handle catalog search (GET request)
            else {
                const apiUrl = `https://pro.easyeda.com/api/v2/eda/product/list?` +
                    `catalog=${encodeURIComponent(data.catalogId)}` +
                    `&currPage=${currentPage}` +
                    `&pageSize=${MAX_PER_PAGE}` +
                    `&param=${encodeURIComponent(urlParamsForCatalog!)}`;
                response = await fetchWithRetry(apiUrl) as unknown as Response;
            }

            json = await response.json();
        } catch (error) {
            throw new Error(`Network error on page ${currentPage}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        // Validate API response
        if (json.code !== 200 && json.code !== 0 || !json.result) {
            throw new Error(`API error (page ${currentPage}): Code ${json.code}, Message: ${json.msg}`);
        }

        // Filter valid components (with symbol data and datasheet)
        const productsWithDatasheet = json.result.productList.filter(element =>
            (element?.device_info?.symbol_info?.dataStr || element?.device_info?.symbol_info?.dataStrId) &&
            element?.device_info?.attributes?.Datasheet
        );

        const validComponents = (await Promise.all(productsWithDatasheet.map(async element => {
            try {
                return await normalizeEasyEdaProductSymbolInfo(element);
            } catch {
                return null;
            }
        }))).filter((element): element is EasyEdaProduct =>
            Boolean(element?.device_info?.symbol_info?.dataStr)
        );

        // Add needed components without exceeding target page size
        const remainingSlots = targetPageSize - collected.length;
        collected.push(...validComponents.slice(0, remainingSlots));

        // Determine if more pages exist
        const pageInfo = json.result.pageInfo;
        const isLastPage = pageInfo
            ? currentPage >= pageInfo.totalPage // Use API-provided pagination
            : json.result.productList.length < MAX_PER_PAGE; // Fallback for missing pageInfo


        result = collected.map(easyEdaProductToComponent).filter(filter);

        // Termination conditions
        if (result.length >= targetPageSize || isLastPage || fullPage) {
            break;
        }

        currentPage++;
    }

    // Map raw components to final Component structure
    return result;
}

export async function easyEdaSearcPassiveComponent({ componentType = '', value = '', currPage = 1, pageSize = 10 }) {
    const catalogIdMap: { [key: string]: number } = {
        'capacitor': 312,
        'inductor': 316,
        'resistor': 308,
        'connector': 644,

        "Конденсаторы": 312,
        "Резисторы": 308,
        "Индуктивности": 316,
        "Разъемы": 644
    };
    const catalogId = catalogIdMap[componentType];

    const params: { [key: string]: string[] } = {};

    if (catalogId === 312) {
        params["Capacitance"] = [value + "F"];
    } else if (catalogId === 316) {
        params["Inductance"] = [value + "H"];
    } else if (catalogId === 308) {
        params["Resistance"] = [value + 'Ω'];
    } else if (catalogId === 644) {
        params["Number of Pins"] = [value + 'P'];
    }

    return await easyEdaSearch({ catalogId, params, currPage: currPage ?? 1, pageSize: pageSize ?? 25 });
}
