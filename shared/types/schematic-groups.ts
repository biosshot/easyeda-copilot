/** Compact, read-only context for the current schematic page. */
export interface SchematicGroups {
    maybe_blocks: string[];
    wires: {
        net: string | null;
        pins: string;
    }[];
    /** At most 10 short diagnostics; omitted on a complete, successful read. */
    errors?: string[];
}
