import { readFile } from 'node:fs/promises';

export async function readRaw(path) {
  const text = await readFile(path, 'utf8');
  const fields = Object.fromEntries([...text.matchAll(/^([^:\r\n]+):\s*(.*)$/gm)].map(m => [m[1].trim(), m[2].trim()]));
  const count = Number(fields['No. Variables']), points = Number(fields['No. Points']);
  const start = text.search(/^Variables:/m), end = text.search(/^Values:/m);
  if (start < 0 || end < 0 || !count || !Number.isInteger(points) || points < 1) throw new Error(`Expected ngspice ASCII raw data: ${path}`);
  const variables = text.slice(start + 10, end).trim().split(/\r?\n/).map(line => {
    const [, name, type] = line.trim().split(/\s+/); return { name, type };
  });
  if (variables.length !== count) throw new Error('Invalid raw variable count');
  const tokens = text.slice(end + 7).trim().split(/\s+/);
  const complex = fields.Flags?.includes('complex');
  const vectors = variables.map(v => ({ ...v, real: [], ...(complex ? { imaginary: [] } : {}) }));
  let offset = 0;
  for (let point = 0; point < points; point++) {
    if (Number(tokens[offset++]) !== point) throw new Error('Invalid raw point sequence');
    for (const vector of vectors) {
      const values = tokens[offset++]?.split(',').map(Number);
      if (!values || values.length !== (complex ? 2 : 1) || values.some(v => !Number.isFinite(v))) throw new Error('Invalid or non-finite raw value');
      vector.real.push(values[0]); if (complex) vector.imaginary.push(values[1]);
    }
  }
  if (offset !== tokens.length) throw new Error('Unexpected trailing raw data');
  return { title: fields.Title, analysis: fields.Plotname, points, complex, vectors };
}
export function csv(data) {
  const columns = data.vectors.flatMap(v => [{ name: data.complex ? `${v.name}.real` : v.name, values: v.real }, ...(data.complex ? [{ name: `${v.name}.imaginary`, values: v.imaginary }] : [])]);
  const lines = [columns.map(v => `"${v.name.replaceAll('"', '""')}"`).join(',')];
  for (let i = 0; i < data.points; i++) lines.push(columns.map(v => v.values[i]).join(','));
  return lines.join('\n') + '\n';
}
