
import type { CircuitComponent } from "./circuit.ts";
import { type ElkNode } from 'elkjs';

export interface SymbolPin {
    num: number | string; // Номер пина, например "1", "2", "3"...
    name: string; // Имя пина, например "VIN", "GND", "FB"...
    x: number;   // X координата относительно центра компонета
    y: number;   // Y координата
    signal_name: string,
    part: string
}

export interface SymbolData {
    width: number;
    height: number;
    pins: SymbolPin[];
    center: {
        x: number;
        y: number;
    };
}

export interface SymbolWithMeta {
    designator: string;
    block_name: string;
    symbol: SymbolData
};

export interface ShortSymbol {
    component: CircuitComponent;
    node: ElkNode;
}