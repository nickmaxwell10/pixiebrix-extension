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
/* eslint-disable unicorn/no-array-callback-reference -- $.find false positives */

import { EffectABC } from "@/types/bricks/effectTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { propertiesToSchema } from "@/validators/generic";
import { boolean } from "@/utils/typeUtils";
import { $safeFind } from "@/utils/domUtils";

type ColorRule =
  | string
  | {
      selector: string;
      backgroundColor?: string;
      condition: string | boolean | number;
    };

const HEX_PATTERN = "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$";

export class HighlightEffect extends EffectABC {
  constructor() {
    super(
      "@pixiebrix/highlight",
      "Highlight",
      "Highlight one or more elements on a page",
    );
  }

  inputSchema: Schema = propertiesToSchema(
    {
      backgroundColor: {
        type: "string",
        default: "#FFFF00",
        description: "Default color hex code",
        pattern: HEX_PATTERN,
      },
      rootSelector: {
        type: "string",
        description: "Optional root selector to find the elements within",
        format: "selector",
      },
      rootMode: {
        type: "string",
        enum: ["document", "inherit"],
        description:
          "Deprecated: configure root mode on common brick options instead",
        // The correct behavior going forward is "inherit". To maintain backward compatability, the brick implementation
        // will default rootMode to "document" if the rootMode argument is not passed in.
        default: "inherit",
      },
      condition: {
        anyOf: [{ type: "string" }, { type: "boolean" }, { type: "number" }],
        description:
          "Deprecated: configure condition on common brick options instead",
      },
      elements: {
        type: "array",
        description: "An array of highlighting sub-rules",
        items: {
          oneOf: [
            {
              type: "string",
              description: "jQuery selector",
              format: "selector",
            },
            {
              type: "object",
              properties: {
                selector: {
                  type: "string",
                  description: "jQuery selector",
                  format: "selector",
                },
                condition: {
                  anyOf: [
                    { type: "string" },
                    { type: "boolean" },
                    { type: "number" },
                  ],
                  description: "Whether or not to apply the highlighting rule",
                },
                backgroundColor: {
                  type: "string",
                  description: "Color hex code",
                  pattern: HEX_PATTERN,
                },
              },
              required: ["selector"],
            },
          ],
        },
      },
    },
    [],
  );

  override async isRootAware(): Promise<boolean> {
    return true;
  }

  async effect(
    {
      condition,
      backgroundColor = "#FFFF00",
      rootSelector,
      elements,
      // Default to "document" for backward compatability. New bricks configured in the Page Editor will have
      // rootMode = "inherit" by default (see JSON Schema above)
      rootMode = "document",
    }: BrickArgs<{
      rootMode: "document" | "inherit";
      condition: string | number | boolean;
      backgroundColor: string;
      rootSelector: string | undefined;
      elements: ColorRule[];
    }>,
    { root }: BrickOptions,
  ): Promise<void> {
    if (condition !== undefined && !boolean(condition)) {
      return;
    }

    const documentRoot = rootMode === "document" ? document.body : root;
    const $roots = rootSelector
      ? $safeFind(rootSelector, documentRoot)
      : $(documentRoot);

    if (elements == null) {
      $roots.css({ backgroundColor });
      return;
    }

    for (const element of elements) {
      if (typeof element === "string") {
        $roots.find(element).css({ backgroundColor });
      } else {
        const { condition, selector, backgroundColor } = element;

        if (condition && boolean(condition)) {
          $roots.find(selector).css({ backgroundColor });
        }
      }
    }
  }
}
