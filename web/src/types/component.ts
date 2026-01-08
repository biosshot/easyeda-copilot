import { z } from "zod";
import { LCSC_uuid } from "./lcsc.ts";

export const ComponentStruct = () => z.object({
    pins: z.array(
        z.object({
            name: z.string(),
            pin_number: z.number(),
        })
    ),
    price: z.number(),
    name: z.string(),
    manufacturer: z.string(),
    description: z.string(),
    part_uuid: LCSC_uuid(),
    datasheet: z.string().nullable(),
});

export type Component = z.infer<ReturnType<typeof ComponentStruct>>;