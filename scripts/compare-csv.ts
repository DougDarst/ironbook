/**
 * Compares the Google Sheet's CSV with a CSV exported from the app, entry
 * by entry (Story 22: check the imported history before retiring the
 * sheet). Both files are read with the importer's own reader; the report
 * lists per-exercise entry counts and volumes, then every entry that's
 * missing on either side or has different sets.
 *
 *   npm run compare-csv -- <sheet.csv> <export.csv>
 *
 * Reads the two files locally and prints to the terminal; it sends and
 * saves nothing. Exit code 0 when they match, 1 when they differ, 2 when a
 * file can't be read.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runnerImport } from 'vite';

type CsvModule = typeof import('../src/lib/csv');
type DatesModule = typeof import('../src/lib/model/dates');

const USAGE = 'Usage: npm run compare-csv -- <sheet.csv> <export.csv>';

/**
 * The app's modules use extension-less imports, which Node can't resolve
 * on its own, so they're loaded through Vite (no extra dependency).
 */
async function load<T>(file: string): Promise<T> {
  const id = fileURLToPath(new URL(file, import.meta.url));
  const { module } = await runnerImport<T>(id, { configFile: false, logLevel: 'silent' });
  return module;
}

/** Runs the comparison and returns the exit code. */
export async function main(args: readonly string[], print: (text: string) => void = console.log): Promise<number> {
  if (args.length !== 2) {
    print(USAGE);
    return 2;
  }
  const texts: string[] = [];
  for (const file of args) {
    try {
      texts.push(readFileSync(file, 'utf8'));
    } catch {
      print(`Can't read ${file}.\n${USAGE}`);
      return 2;
    }
  }
  const csv = await load<CsvModule>('../src/lib/csv/index.ts');
  const { localToday } = await load<DatesModule>('../src/lib/model/dates.ts');
  const today = localToday();
  const comparison = csv.compareLogbooks(csv.readCsv(texts[0]!, today), csv.readCsv(texts[1]!, today));
  print(csv.formatComparison(comparison));
  return csv.logbooksMatch(comparison) ? 0 : 1;
}

// Run from the command line (not when imported by the tests).
/* v8 ignore next 3 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = await main(process.argv.slice(2));
}
