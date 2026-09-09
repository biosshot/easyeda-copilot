export interface EasyEdaApiResponce<T> {
    code: number
    msg?: string
    result?: T
    success: boolean
}

export type EasyEdaProductApiResponce = EasyEdaApiResponce<{
    total: number
    pageInfo: {
        totalPage: number
    }
    paramList: EasyEdaParam[]
    productList: EasyEdaProduct[]
}>

export type EasyEdaSmtApiSmtPartInfo = EasyEdaApiResponce<SmtPartInfo[]>

interface EasyEdaParam {
    parameterName: string
    parameterValueList: string[]
    parameterIdList?: number[]
}

export interface EasyEdaProduct {
    ifRoHS: boolean
    price: [number, string, string][]
    stock: number
    mpn: string
    number: string
    package: string
    manufacturer: string
    url: string
    image: {
        sort: number
        type: string
        "900x900": string
        "224x224": string
        "96x96": string
    }[]
    mfrLink: string
    stockNumber: number
    priceList: {
        price: string
    }[]
    hasDevice: string
    "JLCPCB Part Class": string
    device_info?: EasyEdaDeviceInfo
}

interface EasyEdaUser {
    uuid: string
    username: string
    nickname: string
    avatar?: string
}

export interface EasyEdaDeviceInfo {
    uuid: string
    attributes: EasyEdaAttributes
    createTime: number
    created_at: string
    creator: EasyEdaUser
    custom_tags?: string
    description: string
    display_title: string
    footprint_type: number
    images: string[]
    modifier: EasyEdaUser
    owner: EasyEdaUser
    product_code: string
    project_uuid: string
    source: string
    symbol_type: number
    tags: {
        parent_tag: EasyEdaTag
        child_tag: EasyEdaTag
    }
    ticket: number
    title: string
    updateTime: number
    updated_at: string
    version: number
    Description: string
    symbol_info: SymbolInfo
    footprint_info: FootprintInfo
}

interface EasyEdaAttributes {
    "LCSC Part Name": string
    "Supplier Part": string
    Manufacturer: string
    "Manufacturer Part": string
    "Supplier Footprint": string
    "JLCPCB Part Class": string
    Datasheet: string
    Supplier: string
    "Add into BOM": string
    "Convert to PCB": string
    Symbol: string
    Designator: string
    Footprint: string
    "3D Model": string
    "3D Model Title": string
    "3D Model Transform": string
    Name: string
}

interface EasyEdaTag {
    uuid: string
    name: string
    name_cn: string
}

export interface SymbolInfo {
    uuid: string
    createTime: number
    created_at: string
    creator: EasyEdaUser
    custom_tags?: string
    dataStrId?: string
    description: string
    display_title: string
    docType: number
    iv?: string
    key?: string
    modifier: EasyEdaUser
    owner: EasyEdaUser
    public: boolean
    source: string
    tags: {
        parent_tag: EasyEdaTag
        child_tag: EasyEdaTag
    }
    ticket: number
    title: string
    type: number
    updateTime: number
    updated_at: string
    version: number
    std_uuid: string
    dataStr?: string
    engine?: string
}

interface FootprintInfo {
    uuid: string
    createTime: number
    created_at: string
    creator: EasyEdaUser
    dataStr?: string
    description: string
    display_title: string
    docType: number
    modifier: EasyEdaUser
    owner: EasyEdaUser
    public: boolean
    source: string
    tags: {
        parent_tag: EasyEdaTag
        child_tag: EasyEdaTag[]
    }
    ticket: number
    title: string
    type: number
    updateTime: number
    updated_at: string
    version: number
    std_uuid: string
    model_3d: {
        title: string
        uri: string
        transform: string
    }
    dataStrId?: string
    iv?: string
    key?: string
}

export interface EasyEdaDeviceApiResult {
    uuid: string;
    attributes: EasyEdaAttributes;
    createTime: number;
    created_at: string;
    creator: EasyEdaUser;
    description: string;
    display_title: string;
    footprint_type: number;
    images: string[];
    modifier: EasyEdaUser;
    owner: EasyEdaUser;
    product_code: string;
    project_uuid: string;
    source: string;
    symbol_type: number;
    tags: {
        parent_tag: EasyEdaTag
        child_tag: EasyEdaTag[]
    };
    ticket: number;
    title: string;
    updateTime: number;
    updated_at: string;
    version: number;
    isFavorite: boolean;
    symbol: {
        uuid: string;
        display_title: string;
        title: string;
    };
    footprint: {
        uuid: string;
        display_title: string;
        title: string;
    };
}

interface SmtPartInfo {
    paste_type: string
    componentProductType: number
    stock_num: number
    assemblyType: string
    onSale: number
    hotLevel: number
    component_code: string
    maxPrice: number
    priceList: PriceList[]
}

export interface PriceList {
    price: number
    startNumber: number
    endNumber: number
}
