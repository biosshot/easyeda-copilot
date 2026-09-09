import { z } from 'zod';
import { easyEdaDeviceToComponent, easyEdaSearch, getEasyEdaDevice } from './devices/easy-eda.ts';
import { LCSC_uuid } from './types/lcsc.ts';

const inputSchema = z.object({
  MPN: z.string().min(1).nullish(),
  part_uuid: LCSC_uuid().nullish(),
}).refine(input => Boolean(input.MPN || input.part_uuid), 'Fill one: MPN or part_uuid');

export type ComponentSearchInput = z.input<typeof inputSchema>;

export async function componentSearch(input: ComponentSearchInput) {
  const data = inputSchema.parse(input);
  if (data.part_uuid) {
    const device = await getEasyEdaDevice(data.part_uuid).catch(() => undefined);
    const result = device && await easyEdaDeviceToComponent(device).catch(() => undefined);
    if (!result) throw new Error('Component not found.');
    return { bestComponent: result };
  }
  return { components: (await easyEdaSearch(data.MPN!)).slice(0, 10), bestComponent: null };
}

/** Reusable block discovery remains disabled, matching the current MCP service. */
export async function searchReusedBlock(_input?: { query: string; page?: number; limit?: number }): Promise<never[]> {
  return [];
}

export type { Component } from './types/component.ts';
