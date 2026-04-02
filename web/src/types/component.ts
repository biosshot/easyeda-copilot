import { z } from "zod";
import { LCSC_uuid } from "./lcsc";


export const ComponentStruct = () => z.object({
    pins: z.array(
        z.object({
            name: z.string(),
            pin_number: z.union([z.number(), z.string()]),
        })
    ),
    price: z.number(),
    name: z.string(),
    manufacturer: z.string(),
    description: z.string(),
    part_uuid: LCSC_uuid(),
    datasheet: z.string().nullable(),
    designatorPattern: z.string().nullable().default(null).describe("example: R?, D?, U?, VT?, J? etc."),
    footprintName: z.string().nullable().default(null)
});

export type Component = z.infer<ReturnType<typeof ComponentStruct>>;