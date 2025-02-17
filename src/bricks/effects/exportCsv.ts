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

import { EffectABC } from "@/types/bricks/effectTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { PropError } from "@/errors/businessErrors";
import { isUnknownObjectArray } from "@/utils/objectUtils";

export class ExportCsv extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/export/csv",
      "Export as CSV",
      "Export records as a CSV file",
    );
  }

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {
      filename: {
        type: "string",
        description:
          'The exported filename, ".csv" will be appended to the value provided',
        default: "exported",
      },
      useBOM: {
        type: "boolean",
        description:
          "True to include a byte-order-mark (BOM), which is required for old versions of Microsoft Excel",
        default: false,
      },
      data: {
        type: "array",
        description: "An array of rows/records",
        items: {
          type: "object",
        },
      },
    },
  };

  async effect(
    { filename = "exported", useBOM = false, data }: BrickArgs,
    { ctxt }: BrickOptions,
  ): Promise<void> {
    const { mkConfig, generateCsv, download } = await import(
      /* webpackChunkName: "export-to-csv" */ "export-to-csv"
    );

    const csvConfig = mkConfig({
      useKeysAsHeaders: true,
      filename,
      useBom: useBOM,
    });

    const rows = data ?? ctxt;

    if (!Array.isArray(rows)) {
      // Don't pass `value` because it may be a large amount of data
      throw new PropError(
        `Expected array for data, got ${typeof rows}`,
        this.id,
        "data",
        null,
      );
    }

    if (!isUnknownObjectArray(rows)) {
      // Don't pass `value` because it may be a large amount of data
      throw new PropError(
        `Expected array of array for data, got ${typeof rows[0]}`,
        this.id,
        "data",
        null,
      );
    }

    const csv = generateCsv(csvConfig)(rows);

    download(csvConfig)(csv);
  }
}
