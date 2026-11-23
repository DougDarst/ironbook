import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { main } from './compare-csv';

const dir = mkdtempSync(path.join(tmpdir(), 'compare-csv-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

function file(name: string, text: string): string {
  const p = path.join(dir, name);
  writeFileSync(p, text);
  return p;
}

async function run(args: string[]) {
  const out: string[] = [];
  const code = await main(args, (t) => out.push(t));
  return { code, text: out.join('\n') };
}

describe('compare-csv', () => {
  const sheet = file('sheet.csv', 'EXERCISE,DATE,W1,R1\nSquat,10/1/26,225,5\nSquat,10/3/26,235,5\n');

  it('exits 0 and says MATCH when the export holds the same entries', async () => {
    const live = file('same.csv', 'Exercise,Date,W1,R1,Volume\nSquat,10/1/26,225,5,1125\nSquat,10/3/26,235,5,1175\n');
    const { code, text } = await run([sheet, live]);
    expect(text).toContain('MATCH: all 2 entries are identical.');
    expect(code).toBe(0);
  });

  it('exits 1 and lists what differs', async () => {
    const live = file('short.csv', 'Exercise,Date,W1,R1,Volume\nSquat,10/1/26,225,5,1125\n');
    const { code, text } = await run([sheet, live]);
    expect(text).toContain('Only in the sheet (1):\n  Squat 10/3/26 (row 3)');
    expect(code).toBe(1);
  });

  it('exits 2 with the usage when the arguments or files are wrong', async () => {
    expect((await run([sheet])).code).toBe(2);
    const missing = await run([sheet, path.join(dir, 'nope.csv')]);
    expect(missing.code).toBe(2);
    expect(missing.text).toContain("Can't read");
    expect(missing.text).toContain('Usage: npm run compare-csv');
  });
});
