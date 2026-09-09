import { Schema, z } from "zod"

const parseJsonIfString = (arg: unknown) => {
    if (typeof arg === 'string') {
        try {
            return JSON.parse(arg);
        } catch (e) {
            return arg;
        }
    }
    return arg;
};

const normalizeNull = (val: unknown) => {
    if (val === "null" || val === "undefined" || val === null || val === '0' || val === 'None' || val === 'none' || val === '') {
        return null;
    }
    return val;
};

const parseBoolean = (arg: unknown) => {
    if (typeof arg === 'boolean') {
        return arg;
    }
    else if (typeof arg === 'string') {
        if (['true', '1', 't'].includes(arg.trim().toLowerCase())) return true;
        return false;
    }
    else if (arg === null || arg === undefined) {
        return arg;
    }

    return Boolean(arg);
}

// for fix china llm
export const zodWrapDeepObject = <T extends Schema>(schema: T) => z.preprocess(parseJsonIfString, schema);
export const zodWrapNullable = <T extends Schema>(schema: T) => z.preprocess(normalizeNull, schema);
export const zodWrapBoolean = <T extends Schema>(schema: T) => z.preprocess(parseBoolean, schema);