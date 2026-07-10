import { z } from "zod";
import { LCSC_uuid } from "./lcsc";
import { ReusedCategory, ReusedTags } from "./reused";

export const PinSchema = () => z.object({
    pin_number: z.union([z.number(), z.string()]).describe('Pin number.'),
    name: z.string().describe('Pin name (e.g., "VCC").'),
    signal_name: z.string().describe('The name of the signal the pin is connected to. (Name only). The signal name assigned to the pin must be identical to the signal name of the target output.'),
});

export const BaseComponentSchema = () => z.object({
    designator: z.string().describe('Component identifier (e.g., "U1", "R5", "J1", "X1").'),
    value: z.string().describe('Minimum description: for simple components — only the nominal value; for microcircuits — only the name. Only ASCII symbols (e.g., "LM358", "10nF", "100k").'),
    pins: z.array(PinSchema()).describe('Pin details.'),
    block_name: z.string().describe('Reference to the block.'),
    search_query: z.string().describe('A component search question. For example: "1k 1W smd resistor", "LM358", "2-pin power connector"'),
    part_uuid: LCSC_uuid().nullable().describe("If you know the part_uuid of the lcsc component, be sure to fill in this field; otherwise, fill in null.")
});

export const CircuitReusedBlockSchema = () => z.object({
    block_uuid: z.string(),
    parameters_to_recalc: z.array(z.object({
        name: z.string(),
        new_value: z.number()
    })).describe("Parameters that will be recalculated to suit your needs"),
    ports: z.array(z.object({
        port_number: z.string().or(z.number()).describe("Port number"),
        signal_name: z.string().describe("Port signal_name"),
    }))
});

export const ComponentAsmSchema = () => BaseComponentSchema().extend({
    sub_part_name: z.string().optional(),
    pos: z.object({
        x: z.number().describe("X position"),
        y: z.number().describe("Y position"),
        center: z.object({
            x: z.number(),
            y: z.number()
        }),
        width: z.number().describe("width position"),
        height: z.number().describe("height position"),
        rotate: z.number().optional(),
        mirror: z.boolean().optional()
    }).describe("Position of the component on the Circuit"),
});

const BlockSchema = () => z.object({
    name: z.string().describe('A unique short name for the block (e.g. "Preamp").'),
    description: z.string().describe('Block functionality.'),
    next_block_names: z.array(z.string().describe("The `name` of the next block must be an existing block `name`."))
});

const MetadataSchema = () => z.object({
    project_name: z.string().describe('Project name.'),
    description: z.string().describe('Circuit description.'),
});

export const CircuitStruct = () => z.object({
    metadata: (MetadataSchema().describe('Metadata')),
    blocks: (z.array(BlockSchema()).describe('Blocks')),
    components: (z.array(BaseComponentSchema()).describe('Components')),
    reused_blocks: (z.array(CircuitReusedBlockSchema()).describe('reuded blocks'))
});

export const CircuitBlocksStruct = () => z.object({
    metadata: (MetadataSchema().describe('Metadata')),
    blocks: (z.array(BlockSchema()).describe('Blocks')),
});

export const CircuitWithoutBlocksStruct = () => z.object({
    metadata: MetadataSchema().describe('Metadata'),
    components: z.array(BaseComponentSchema()).describe('Components'),
});

const ElkPoint = () => z.object({
    x: z.number(),
    y: z.number()
})

export const CircuitAssemblyStruct = () => z.object({
    metadata: MetadataSchema().describe('Metadata'),
    components: z.array(ComponentAsmSchema()).describe('Components'),
    reused_blocks: z.array(z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        description: z.string(),
        category: ReusedCategory(),
        tags: z.array(ReusedTags()),
    })).optional(),
    edges: z.array(z.object({
        sources: z.array(z.string()),
        targets: z.array(z.string()),
        container: z.string(),
        sections: z.array(z.object({
            id: z.string(),
            startPoint: ElkPoint(),
            endPoint: ElkPoint(),
            bendPoints: z.array(ElkPoint()).optional(),
            incomingShape: z.string().optional(),
            outgoingShape: z.string().optional(),
            incomingSections: z.array(z.string()).optional(),
            outgoingSections: z.array(z.string()).optional(),
        })),
    })),
    blocks: z.array(BlockSchema()).describe('Blocks'),
    blocks_rect: z.array(z.object({
        name: z.string().describe('Block short name (e.g., "Preamp").'),
        description: z.string().describe('Block functionality.'),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    })).optional(),
    assembly_options: z.object({
        centered: z.boolean().optional(),
        draw_blocks: z.boolean().optional(),
    }).optional(),
    added_net: z.array(z.object({
        designator: z.string(),
        pin_number: z.union([z.number(), z.string()]),
        net: z.string(),
    })).optional(),
    rm_net: z.array(z.object({
        designator: z.string(),
        pin_number: z.union([z.number(), z.string()]),
        net: z.string(),
    })).optional(),
    rm_components: z.array(z.string()).optional(),
    replace_components: z.array(z.string()).optional(),
});

const ExplainPinSchema = () => z.object({
    pin_number: z.union([z.number(), z.string()]).describe('Pin number.'),
    name: z.string().describe('Pin name (e.g., "VCC").'),
    signal_name: z.string().describe('The name of the signal the pin is connected to. (Name only). The signal name assigned to the pin must be identical to the signal name of the target output.'),
});

export const ExplainComponentSchema = () => z.object({
    designator: z.string().describe('Component identifier (e.g., "U1", "R5", "J1", "X1").'),
    value: z.string().describe('Minimum description: for simple components — only the nominal value; for microcircuits — only the name. Only ASCII symbols (e.g., "LM358", "10nF", "100k").'),
    pins: z.array(ExplainPinSchema()).describe('Pin details.'),
    part_uuid: LCSC_uuid().nullable().describe('Unique component identifier.'),
    pos: z.object({
        x: z.number(),
        y: z.number(),
        rotate: z.number().optional(),
        mirror: z.boolean().optional()
    }).optional(),
    footprint_name: z.string().nullish(),
    footprint_uuid: z.string().nullish(),
});

export const ExplainCircuitStruct = () => z.object({
    components: z.array(ExplainComponentSchema()).describe('Components'),
});

export const CircuitModStruct = () => z.object({
    add_components: (z.array(BaseComponentSchema().omit({ part_uuid: true }).extend({
        part_uuid: LCSC_uuid().describe("part_uuid of the lcsc component")
    })).describe('Components to add')),
    add_reused_blocks: (z.array(CircuitReusedBlockSchema()).describe('reuded blocks to add')),
    rm_components: ((z.array(z.string().describe('component designator')).nullable().describe('Components to remove from the circuit'))),
    external_rm_connect: ((z.array(z.object({
        designator: z.string().describe('Target component designator'),
        pin_number: z.union([z.number(), z.string()]).describe('Target component pin number'),
    })).nullable())).describe('Use only if you need to remove/break the connection from an external component\'s pin. Remember to remove external_rm_connect first and then add external_connect.'),
    external_connect: ((z.array(z.object({
        designator: z.string().describe('Target component designator'),
        pin_number: z.union([z.number(), z.string()]).describe('Target component pin number'),
        signal_name: z.string().describe('Signal name'),
    })).nullable())).describe('Use only when you need to connect to a pin of an external component that you have not modified and that does not have a signal_name')
});

export type CircuitMod = z.infer<ReturnType<typeof CircuitModStruct>>;
export type ExplainCircuit = z.infer<ReturnType<typeof ExplainCircuitStruct>>;
export type CircuitAssembly = z.infer<ReturnType<typeof CircuitAssemblyStruct>>;
export type CircuitWithoutBlocks = z.infer<ReturnType<typeof CircuitWithoutBlocksStruct>>;
export type Circuit = z.infer<ReturnType<typeof CircuitStruct>>;
export type CircuitComponent = z.infer<ReturnType<typeof BaseComponentSchema>>;
export type Pin = z.infer<ReturnType<typeof PinSchema>>;
export type CircuitBlocks = z.infer<ReturnType<typeof CircuitBlocksStruct>>;