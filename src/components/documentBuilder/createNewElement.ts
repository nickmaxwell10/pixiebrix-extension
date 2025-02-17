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

import {
  type DocumentElement,
  type DocumentElementType,
} from "./documentBuilderTypes";
import { validateRegistryId } from "@/types/helpers";
import { type DeferExpression } from "@/types/runtimeTypes";
import { toExpression } from "@/utils/expressionUtils";

const elementExtras: Record<"form", DocumentElementType> = {
  form: "pipeline",
};

export function createNewElement(
  elementType: DocumentElementType | keyof typeof elementExtras,
): DocumentElement {
  const element: DocumentElement = {
    // Writing as map to make it easier to add similar shortcuts in the future
    // eslint-disable-next-line security/detect-object-injection -- check for valid element type
    type: elementType === "form" ? elementExtras[elementType] : elementType,
    config: {},
  };

  switch (elementType) {
    case "header": {
      element.config.title = "Header";
      element.config.heading = "h1";
      break;
    }

    case "text": {
      element.config.text = "Paragraph text. **Markdown** is supported.";
      element.config.enableMarkdown = true;
      break;
    }

    case "image": {
      element.config.url = null;
      break;
    }

    case "container": {
      element.children = [createNewElement("row")];
      break;
    }

    case "row": {
      element.children = [createNewElement("column")];
      break;
    }

    case "column": {
      element.children = [];
      break;
    }

    case "card": {
      element.config.heading = "Header";
      element.children = [];
      break;
    }

    case "form": {
      element.config.label = "Form";
      element.config.pipeline = toExpression("pipeline", [
        {
          id: validateRegistryId("@pixiebrix/form"),
          config: {
            storage: {
              type: "state",
              namespace: "blueprint",
            },
            submitCaption: "Save",
            schema: {
              type: "object",
              properties: {
                notes: {
                  title: "Example Notes Field",
                  type: "string",
                  description: "An example notes field",
                },
              },
            },
            uiSchema: {
              notes: {
                "ui:widget": "textarea",
              },
            },
            className: "p-0",
          },
        },
      ]);
      break;
    }

    case "pipeline": {
      element.config.label = "Brick";
      element.config.pipeline = toExpression("pipeline", []);
      break;
    }

    case "button": {
      element.config.label = "Button";
      element.config.title = "Action";
      element.config.size = "md";
      element.config.variant = "primary";
      element.config.fullWidth = false;
      element.config.disabled = false;
      element.config.hidden = false;

      element.config.onClick = toExpression("pipeline", []);

      break;
    }

    case "list": {
      // ListElement uses "element" as the default. But be explicit
      element.config.elementKey = "element";

      element.config.element = toExpression(
        "defer",
        createNewElement("text"),
      ) as DeferExpression<DocumentElement>;
      break;
    }

    default: {
      throw new Error(
        `Can't create new element. Type "${elementType} is not supported.`,
      );
    }
  }

  return element;
}
