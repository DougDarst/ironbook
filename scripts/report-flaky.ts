/**
 * Lists the E2E tests that failed and then passed on CI's retry ("flaky").
 * CI retries a failed test once and stays green if the retry passes, so
 * without this a flaky test goes unnoticed. Reads Playwright's JSON report;
 * prints a GitHub warning per flaky test and adds them to the job summary.
 * Never fails the build.
 *
 * Usage (CI): node scripts/report-flaky.ts [playwright-results.json]
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

interface Suite {
  title: string;
  file?: string;
  specs?: { title: string; file: string; line: number; tests: { projectName: string; status: string }[] }[];
  suites?: Suite[];
}

/** "file:line › describe › title (project)" for each flaky test in the report. */
export function flakyTests(report: { suites?: Suite[] }): string[] {
  const found: string[] = [];
  const walk = (suite: Suite, titles: string[]) => {
    const path = suite.file && suite.title === suite.file ? titles : [...titles, suite.title];
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests) {
        if (test.status === 'flaky') {
          found.push(`${spec.file}:${spec.line} › ${[...path, spec.title].join(' › ')} (${test.projectName})`);
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child, path);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return found;
}

/** Reads the report at `file` and reports its flaky tests (see the top of this file). */
export function main(file: string): void {
  if (!existsSync(file)) {
    console.log(`No E2E report at ${file} (the E2E tests didn't run); nothing to check.`);
    return;
  }
  const flaky = flakyTests(JSON.parse(readFileSync(file, 'utf8')));
  if (flaky.length === 0) {
    console.log('No flaky E2E tests: every test passed on its first try.');
    return;
  }
  for (const test of flaky) console.log(`::warning title=Flaky E2E test::${test} passed only on retry`);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    appendFileSync(
      summary,
      `### Flaky E2E tests\n\nThese failed, then passed on retry. Fix them before they hide a real failure.\n\n${flaky
        .map((t) => `- ${t}`)
        .join('\n')}\n`,
    );
  }
}

// Run from the command line (not when imported by the tests).
/* v8 ignore next */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main(process.argv[2] ?? 'playwright-results.json');
