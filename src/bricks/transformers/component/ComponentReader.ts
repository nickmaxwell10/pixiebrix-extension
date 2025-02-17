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

import { TransformerABC } from "@/types/bricks/transformerTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import {
  type FrameworkConfig,
  frameworkReadFactory,
} from "@/bricks/readers/frameworkReader";
import { KNOWN_READERS } from "@/pageScript/messenger/constants";
import { validateRegistryId } from "@/types/helpers";

export const COMPONENT_READER_ID = validateRegistryId(
  "@pixiebrix/component-reader",
);

export class ComponentReader extends TransformerABC {
  constructor() {
    super(
      COMPONENT_READER_ID,
      "[Deprecated] Component Reader",
      "Extract data from a front-end component (e.g., React, Vue, Ember, etc.)",
    );
  }

  defaultOutputKey = "data";

  inputSchema: Schema = {
    type: "object",
    required: ["framework"],
    properties: {
      framework: {
        type: "string",
        enum: KNOWN_READERS.filter((x) => x !== "jquery"),
      },
      selector: {
        type: "string",
        format: "selector",
        description:
          "CSS/jQuery selector to select the HTML element that corresponds to the component. Or, leave blank to use root context.",
      },
      optional: {
        type: "boolean",
        description: "Whether or not the selector is always available",
        default: false,
      },
      traverseUp: {
        type: "number",
        description: "Traverse non-visible framework elements",
        default: 0,
      },
    },
  };

  override async isRootAware(): Promise<boolean> {
    return true;
  }

  override async isPure(): Promise<boolean> {
    return true;
  }

  async transform(
    args: BrickArgs<FrameworkConfig>,
    { root }: BrickOptions,
  ): Promise<unknown> {
    return frameworkReadFactory(args.framework)(
      args as unknown as FrameworkConfig,
      root,
    );
  }
}
