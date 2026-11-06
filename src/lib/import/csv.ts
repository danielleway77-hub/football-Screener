export type CsvResult = { delimiter: "," | ";" | "\t"; rows: string[][] };

/**
 * Small RFC 4180 CSV reader for the Import page: strips a UTF-8 BOM, detects the delimiter (comma,
 * semicolon or tab) from the header line, supports quoted fields with "" escapes and line breaks inside
 * quotes, accepts CRLF/LF/CR, and skips completely empty lines. Cells are trimmed.
 */
export function parseCsv(input: string): CsvResult {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let wasQuoted = false;

  const endCell = () => {
    row.push(wasQuoted ? cell : cell.trim());
    cell = "";
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== "")) rows.push(row.map((c) => c.trim()));
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      quoted = true;
      wasQuoted = true;
      cell = "";
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0 || wasQuoted) endRow();
  return { delimiter, rows };
}

/** Counts candidate delimiters on the first non-empty line, ignoring anything inside quotes. */
function detectDelimiter(text: string): "," | ";" | "\t" {
  const firstLine = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== "") ?? "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of firstLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch in counts) counts[ch as keyof typeof counts]++;
  }
  if (counts[";"] > counts[","] && counts[";"] >= counts["\t"]) return ";";
  if (counts["\t"] > counts[","] && counts["\t"] > counts[";"]) return "\t";
  return ",";
}
