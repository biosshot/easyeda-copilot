import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { args, fail, isMain, output } from './common.mjs';

const exec = promisify(execFile);
const topics = /pin\s*(?:configuration|description|assignment|functions?)|absolute maximum|recommended operating|electrical characteristics|thermal|typical application|layout|ordering information|引脚|电气特性|热阻|目录/i;

export function summarize(text, query) {
  const pages = text.replace(/\r/g, '').split('\f');
  if (!pages.at(-1)?.trim()) pages.pop();
  const entries = [];
  let totalMatches = 0;
  for (let i = 0; i < pages.length; i++) {
    const lines = pages[i].split('\n').map(s => s.trim()).filter(Boolean);
    const toc = lines.some(s => /^(?:table of )?contents$|^目录$/i.test(s));
    const hits = query
      ? lines.filter(s => s.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
      : lines.filter(s => topics.test(s) || (toc && /\S.*\s\d+\s*$/.test(s)));
    totalMatches += hits.length;
    if (hits.length && entries.length < 30) entries.push({ pdfPage: i + 1, kind: query ? 'text_match' : toc ? 'contents_page' : 'suggested_page', lines: hits.slice(0, 10).map(s => s.slice(0, 300)), truncated: hits.length > 10 || hits.some(s => s.length > 300) });
  }
  return { scannedPages: pages.length, totalMatches, entries, truncated: entries.reduce((n, e) => n + e.lines.length, 0) < totalMatches || entries.some(e => e.truncated), note: 'pdfPage is 1-based. Numbers printed in contents lines are document labels, not resolved PDF page numbers. Suggestions are heuristic; this is not an exhaustive review.' };
}

export async function outline(pdf, options = {}) {
  const path = resolve(pdf);
  await access(path);
  try {
    const { stdout } = await exec(options.pdftotext || process.env.DATASHEETS_PDFTOTEXT || 'pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], { windowsHide: true, timeout: 15_000, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' });
    if (!stdout.trim()) return { status: 'no_text', path, message: 'Use the environment PDF/image reader; this may be a scanned PDF.' };
    return { status: 'ok', path, ...summarize(stdout, options.find) };
  } catch (error) {
    return { status: error.code === 'ENOENT' ? 'unavailable' : 'failed', path, message: error.code === 'ENOENT' ? 'pdftotext is not available. Read the PDF with the environment tools, or supply --pdftotext /path/to/executable.' : `Text extraction failed (${error.code || error.message}). Use the environment PDF reader.`, scanComplete: false };
  }
}

if (isMain(import.meta.url)) {
  try {
    const options = args(process.argv.slice(2), ['find', 'pdftotext']);
    if (options.help) output({ usage: 'node pdf-outline.mjs file.pdf [--find "pin configuration"] [--pdftotext /path/to/pdftotext]' });
    else {
      if (options._.length !== 1) throw new Error('Provide one local PDF path.');
      const result = await outline(options._[0], options);
      output(result);
      if (result.status !== 'ok') process.exitCode = 2;
    }
  } catch (error) { fail(error); }
}
