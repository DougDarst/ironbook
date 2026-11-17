import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flakyTests, main } from './report-flaky';

// A trimmed Playwright JSON report: file suite → describe suite → specs.
const report = {
  suites: [
    {
      title: 'history.spec.ts',
      file: 'history.spec.ts',
      specs: [
        {
          title: 'filters to one exercise',
          file: 'history.spec.ts',
          line: 12,
          tests: [
            { projectName: 'iphone-webkit', status: 'expected' },
            { projectName: 'desktop-chromium', status: 'flaky' },
          ],
        },
      ],
      suites: [
        {
          title: 'iPhone cards',
          file: 'history.spec.ts',
          specs: [
            {
              title: 'tapping a card opens it',
              file: 'history.spec.ts',
              line: 40,
              tests: [
                { projectName: 'iphone-webkit', status: 'flaky' },
                { projectName: 'desktop-chromium', status: 'skipped' },
              ],
            },
          ],
        },
      ],
    },
    {
      title: 'shell.spec.ts',
      file: 'shell.spec.ts',
      specs: [{ title: 'loads', file: 'shell.spec.ts', line: 3, tests: [{ projectName: 'iphone-webkit', status: 'unexpected' }] }],
    },
  ],
};

describe('flakyTests', () => {
  it('lists only tests that passed on retry, with where and on which browser', () => {
    expect(flakyTests(report)).toEqual([
      'history.spec.ts:12 › filters to one exercise (desktop-chromium)',
      'history.spec.ts:40 › iPhone cards › tapping a card opens it (iphone-webkit)',
    ]);
  });

  it('is empty when nothing was flaky, or the report is empty', () => {
    expect(flakyTests({ suites: [report.suites[1]!] })).toEqual([]); // a real failure isn't "flaky"
    expect(flakyTests({})).toEqual([]);
  });
});

describe('main', () => {
  let dir: string;
  let printed: string[];
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'report-flaky-'));
    printed = [];
    vi.spyOn(console, 'log').mockImplementation((line: string) => void printed.push(line));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });
  const write = (data: unknown) => {
    const file = path.join(dir, 'results.json');
    writeFileSync(file, JSON.stringify(data));
    return file;
  };

  it('warns about each flaky test and lists them in the job summary', () => {
    const summary = path.join(dir, 'summary.md');
    vi.stubEnv('GITHUB_STEP_SUMMARY', summary);
    main(write(report));
    expect(printed).toEqual([
      '::warning title=Flaky E2E test::history.spec.ts:12 › filters to one exercise (desktop-chromium) passed only on retry',
      '::warning title=Flaky E2E test::history.spec.ts:40 › iPhone cards › tapping a card opens it (iphone-webkit) passed only on retry',
    ]);
    const text = readFileSync(summary, 'utf8');
    expect(text).toContain('### Flaky E2E tests');
    expect(text).toContain('- history.spec.ts:40 › iPhone cards › tapping a card opens it (iphone-webkit)');
  });

  it('says so when nothing was flaky, and writes no summary', () => {
    const summary = path.join(dir, 'summary.md');
    vi.stubEnv('GITHUB_STEP_SUMMARY', summary);
    main(write({ suites: [] }));
    expect(printed).toEqual(['No flaky E2E tests: every test passed on its first try.']);
    expect(() => readFileSync(summary)).toThrow();
  });

  it('only warns when there is no job summary to write to (not on GitHub)', () => {
    vi.stubEnv('GITHUB_STEP_SUMMARY', '');
    main(write({ suites: [{ title: 'Loose suite', specs: report.suites[0]!.specs }] }));
    // A suite without a file is a describe block: its title is part of the name.
    expect(printed).toEqual([
      '::warning title=Flaky E2E test::history.spec.ts:12 › Loose suite › filters to one exercise (desktop-chromium) passed only on retry',
    ]);
  });

  it('does nothing when the E2E tests never ran', () => {
    main(path.join(dir, 'missing.json'));
    expect(printed[0]).toMatch(/^No E2E report at/);
  });
});
