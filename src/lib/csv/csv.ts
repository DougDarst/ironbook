/**
 * Reading and writing CSV text (RFC 4180): fields with commas, quotes or
 * line breaks are quoted, and quotes inside them are doubled. Pure and
 * dependency-free; unit-tested in csv.test.ts.
 */

/** Quotes a field when it needs it. */
function field(value: string): string {
  return /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Rows of fields as CSV text, one line per row (CRLF, as the standard says). */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(field).join(',')).join('\r\n') + '\r\n';
}

/**
 * The separator a file uses: a tab if its first line has one (tab-separated
 * files, and rows copied from a spreadsheet), otherwise a comma.
 */
export function detectSeparator(text: string): ',' | '\t' {
  const firstLine = text.split(/\r\n|\r|\n/, 1)[0] ?? '';
  return firstLine.includes('\t') ? '\t' : ',';
}

/**
 * CSV text as rows of fields. Accepts CRLF, LF or CR line endings, a byte
 * order mark at the start (spreadsheet exports often have one), and no
 * final line break. A quote that never closes runs to the end of the text.
 * `separator` is a comma, or a tab for tab-separated text.
 */
export function parseCsv(text: string, separator: ',' | '\t' = ','): string[][] {
  const input = text.startsWith('﻿') ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let i = 0;
  const endField = () => {
    row.push(value);
    value = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < input.length) {
    const c = input[i]!;
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        value += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else value += c;
      i += 1;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === separator) endField();
    else if (c === '\r' || c === '\n') {
      endRow();
      if (c === '\r' && input[i + 1] === '\n') i += 1;
    } else value += c;
    i += 1;
  }
  if (value !== '' || row.length > 0) endRow();
  return rows;
}
