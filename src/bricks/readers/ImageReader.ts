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

import { ReaderABC } from "@/types/bricks/readerTypes";
import { type Schema } from "@/types/schemaTypes";

// Copied from https://stackoverflow.com/questions/934012/get-image-data-url-in-javascript
// TODO: Replace with `getData` from ImageExifReader?
function getBase64Image(img: HTMLImageElement) {
  // Create an empty canvas element
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  // Copy the image contents to the canvas
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- 2d always exists
  const context = canvas.getContext("2d")!;
  context.drawImage(img, 0, 0);

  // Get the data-URL formatted image
  // Firefox supports PNG and JPEG. You could check img.src to
  // guess the original format, but be aware the using "image/jpg"
  // will re-encode the image.
  const dataURL = canvas.toDataURL("image/png");

  return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
}

export class ImageReader extends ReaderABC {
  defaultOutputKey = "image";

  constructor() {
    super(
      "@pixiebrix/image",
      "Image reader",
      "Read base64 encoding of the image from an image (img) tag",
    );
  }

  async read(elementOrDocument: HTMLElement | Document) {
    const element = elementOrDocument as HTMLImageElement;

    if (element?.tagName === "IMG") {
      return {
        src: element.src,
        img: getBase64Image(element),
      };
    }

    throw new Error(`Expected an image, got ${element.tagName ?? "document"}`);
  }

  override async isPure(): Promise<boolean> {
    // This is Pure, but produces very large values. So let's leave as impure for now
    return false;
  }

  override outputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    properties: {
      src: {
        type: "string",
      },
      img: {
        type: "string",
        // https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data
        pattern:
          "^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$",
      },
    },
    required: ["img"],
    additionalProperties: false,
  };

  async isAvailable() {
    return true;
  }
}
