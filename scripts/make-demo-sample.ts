/**
 * Writes the invented demo history (src/lib/demo/sample.ts) as a CSV to
 * import into a demo account (Settings › Data › Import CSV).
 *
 *   npm run demo-sample                      # ends yesterday → ~/Downloads/demo-sample-<end>.csv
 *   npm run demo-sample -- --end 2026-11-21  # a chosen last day
 *   npm run demo-sample -- --out docs/demo-data/sample.csv   # refresh the committed copy
 *
 * The same end date always gives the same file. Exit code 2 on bad arguments.
 */
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runnerImport } from 'vite';

type DemoModule = typeof import('../src/lib/demo/sample');
type DatesModule = typeof import('../src/lib/model/dates');

const USAGE = 'Usage: npm run demo-sample -- [--end YYYY-MM-DD] [--out file.csv]';

/** The app's modules use extension-less imports, so they're loaded through Vite (see compare-csv.ts). */
async function load<T>(file: string): Promise<T> {
  const { module } = await runnerImport<T>(fileURLToPath(new URL(file, import.meta.url)), {
    configFile: false,
    logLevel: 'silent',
  });
  return module;
}

/**
 * Writes the sample and returns the exit code. Without --out it goes to
 * `folder` (your Downloads), outside the repo, so the working tree stays
 * clean for deploys.
 */
export async function main(
  args: readonly string[],
  print: (text: string) => void = console.log,
  folder: string = path.join(homedir(), 'Downloads'),
): Promise<number> {
  const dates = await load<DatesModule>('../src/lib/model/dates.ts');
  let end = dates.addDays(dates.localToday(), -1);
  let out: string | null = null;
  for (let i = 0; i < args.length; i += 2) {
    const [flag, value] = [args[i], args[i + 1]];
    if (flag === '--end' && dates.isValidDate(value)) end = value;
    else if (flag === '--out' && value) out = value;
    else {
      print(USAGE);
      return 2;
    }
  }
  const { demoSampleCsv, demoSessions } = await load<DemoModule>('../src/lib/demo/sample.ts');
  out ??= path.join(folder, `demo-sample-${end}.csv`);
  writeFileSync(out, demoSampleCsv({ end }));
  const sessions = demoSessions({ end });
  const days = [...new Set(sessions.map((s) => s.date))];
  print(`Wrote ${out}: ${sessions.length} entries, ${days.length} workouts, ${days[0]} to ${days.at(-1)}.`);
  return 0;
}

// Run from the command line (not when imported by the tests).
/* v8 ignore next 3 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
