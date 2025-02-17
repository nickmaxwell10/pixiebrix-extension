/*
 * Copyright (C) 2023 PixieBrix, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { compact, isEmpty, zip, zipObject } from "lodash";
import objectHash from "object-hash";
import slugify from "slugify";

export interface ParsingOptions {
  orientation?: "vertical" | "horizontal" | "infer";
}

type Cell = { type: "value" | "header"; value: string };

type FieldNames = Array<number | string>;
export type TableRecord = Record<string, string>;

/** Flattened data extracted from table */
type RawTableContent = Cell[][];

/** Normalized data extracted from table, after transposition, if required */
interface NormalizedData {
  fieldNames: FieldNames;
  body: string[][];
}

/** Final parsed records and field names */
export interface ParsedTable {
  fieldNames: FieldNames;
  records: TableRecord[];
}

function guessDirection(
  table: HTMLTableElement,
): ParsingOptions["orientation"] {
  const labelRatio =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Empty tables are filtered out early
    table.rows[0]!.querySelectorAll("th").length /
    table.querySelectorAll("th").length;
  return labelRatio < 0.5 ? "horizontal" : "vertical";
}

function flattenTableContent(table: HTMLTableElement): RawTableContent {
  // This table will be pre-filled in the adjacent rows and columns when rowspan and colspan are found.
  // Colspan means that the current cell exists on [X, Y] and [X + 1, Y]
  // Rowspan means that the current cell exists on [X, Y] and [X, Y + 1]
  // Having both means that a colspan × rowspan matrix will be pre-filled.
  // When a pre-filled cell is found, +1 until the first available column and fill the whole matrix there.
  const flattened: RawTableContent = [];

  let maxRowLength = 0;

  /* eslint-disable security/detect-object-injection -- Native indexes */
  for (const [rowIndex, row] of [...table.rows].entries()) {
    const cells = [...row.cells];

    // Skip empty rows
    if (isEmpty(cells)) {
      continue;
    }

    maxRowLength = Math.max(maxRowLength, cells.length);

    for (let [cellIndex, cell] of cells.entries()) {
      // Find the first available column. Cells are only pushed right, never down
      while (flattened[rowIndex]?.[cellIndex]) {
        cellIndex++;
      }

      // Explore the behavior of spans at https://codepen.io/fregante/pen/oNoYGYE
      const { rowSpan, colSpan, tagName, textContent } = cell;
      for (let rowSpanIndex = 0; rowSpanIndex < rowSpan; rowSpanIndex++) {
        for (let colSpanIndex = 0; colSpanIndex < colSpan; colSpanIndex++) {
          const row = rowIndex + rowSpanIndex;
          const col = cellIndex + colSpanIndex;
          flattened[row] = flattened[row] ?? [];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- It was just created
          flattened[row]![col] = {
            type: tagName === "TH" ? "header" : "value",
            value: textContent.trim(),
          };
        }
      }
    }
    /* eslint-enable security/detect-object-injection */
  }

  const compacted = compact(flattened);

  // In case of malformed tables, ensure that the result is a perfect matrix so we don't have runtime errors
  for (const row of compacted) {
    while (row.length < maxRowLength) {
      row.push({ type: "value", value: "" });
    }
  }

  return compacted;
}

function extractData(
  table: RawTableContent,
  orientation: ParsingOptions["orientation"],
): NormalizedData {
  if (orientation === "horizontal") {
    // Transpose table so we only deal with one orientation
    table = zip(...table) as RawTableContent; // _.zip types are too loose
  }

  // Carefully deal with cells because the "table" could just be an empty array
  const [firstRow] = table;
  const lastCell = firstRow?.[firstRow.length - 1];
  const hasHeader = lastCell?.type === "header";

  const textTable = table.map((row) => row.map((cell) => cell.value));
  if (hasHeader) {
    const [headers, ...body] = textTable;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-unnecessary-type-assertion -- Empty tables are filtered out early
    return { fieldNames: headers!, body };
  }

  // If it has no headers, use a 0-based index as header
  return { fieldNames: [...(firstRow ?? []).keys()], body: textTable };
}

export function parseDomTable(
  table: HTMLTableElement,
  { orientation = "infer" }: ParsingOptions = {},
): ParsedTable {
  if (!table.rows[0]?.cells.length) {
    // Empty table
    return { fieldNames: [], records: [] };
  }

  const { fieldNames, body } = extractData(
    flattenTableContent(table),
    orientation === "infer" ? guessDirection(table) : orientation,
  );

  const records = body.map((row) => zipObject(fieldNames, row));
  return { records, fieldNames };
}

function getAriaDescription(element: HTMLElement): string | undefined {
  const describedBy = element.getAttribute("aria-describedby");
  if (describedBy) {
    return element.ownerDocument?.querySelector("#" + describedBy)?.textContent;
  }
}

function getNameFromFields(fields: Array<number | string>): string {
  return "Table_" + objectHash(fields).slice(0, 5);
}

export function describeTable(
  table: HTMLTableElement | HTMLDListElement,
  parsedTable: ParsedTable,
): string {
  // Uses || instead of ?? to exclude empty strings
  const tableName =
    table.querySelector("caption")?.textContent ||
    getAriaDescription(table) ||
    table.getAttribute("aria-label") ||
    // TODO: Exclude random identifiers #2498
    table.id ||
    getNameFromFields(parsedTable.fieldNames);

  return slugify(tableName, { replacement: "_", lower: true });
}

export function getAllTables(
  root: HTMLElement | Document = document,
): Map<string, ParsedTable> {
  const tables = new Map();
  for (const table of $<HTMLTableElement>("table", root)) {
    // Skip empty tables
    if (!table.rows[0]?.cells.length) {
      continue;
    }

    const parsedTable = parseDomTable(table);

    tables.set(describeTable(table, parsedTable), parsedTable);
  }

  return tables;
}
