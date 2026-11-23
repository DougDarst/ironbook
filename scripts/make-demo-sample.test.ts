import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { demoSampleCsv } from '../src/lib/demo/sample';
import { addDays, localToday } from '../src/lib/model/dates';
import { main } from './make-demo-sample';

const dir = mkdtempSync(path.join(tmpdir(), 'demo-sample-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function run(args: string[]) {
  const out: string[] = [];
  const code = await main(args, (t) => out.push(t), dir);
  return { code, text: out.join('\n') };
}

describe('make-demo-sample', () => {
  it('writes the sample for the chosen end date and says what it wrote', async () => {
    const out = path.join(dir, 'chosen.csv');
    const { code, text } = await run(['--end', '2026-11-21', '--out', out]);
    expect(code).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe(demoSampleCsv({ end: '2026-11-21' }));
    expect(text).toMatch(/: \d+ entries, \d+ workouts, 2026-07-27 to 2026-11-20\.$/);
  });

  it('ends yesterday by default, into the given folder, named by its end date', async () => {
    const out: string[] = [];
    expect(await main([], (t) => out.push(t), dir)).toBe(0);
    const end = addDays(localToday(), -1);
    expect(readFileSync(path.join(dir, `demo-sample-${end}.csv`), 'utf8')).toBe(demoSampleCsv({ end }));
    expect(out[0]).toContain(`demo-sample-${end}.csv`);
  });

  it('exits 2 with the usage for a bad date or an unknown flag', async () => {
    for (const args of [['--end', '11/21/26'], ['--end'], ['--days', '3']]) {
      const { code, text } = await run(args);
      expect(code, args.join(' ')).toBe(2);
      expect(text).toContain('Usage: npm run demo-sample');
    }
  });
});
