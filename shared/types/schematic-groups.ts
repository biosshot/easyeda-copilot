/** Compact, read-only context for one schematic page or concatenated page-local results. */
export interface SchematicGroups {
    maybe_blocks: string[];
    wires: {
        net: string | null;
        pins: string;
    }[];
    /** At most 10 short diagnostics; omitted on a complete, successful read. */
    errors?: string[];
}
