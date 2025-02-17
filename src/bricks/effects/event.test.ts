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

import { unsafeAssumeValidArg } from "@/runtime/runtimeTypes";
import { ElementEvent } from "@/bricks/effects/event";
import { brickOptionsFactory } from "@/testUtils/factories/runtimeFactories";

const brick = new ElementEvent();

describe("ElementEvent", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <html>
        <body>
          <button>Click me</button>
        </body>
      </html>
    `;
  });

  test("isRootAware", async () => {
    await expect(brick.isRootAware()).resolves.toBe(true);
  });

  test.each([undefined, false])(
    "it clicks element for isRootAware: %s",
    async (isRootAware) => {
      const clickHandler = jest.fn();
      document.querySelector("button").addEventListener("click", clickHandler);

      await brick.run(
        unsafeAssumeValidArg({
          selector: "button",
          isRootAware,
          event: "click",
        }),
        brickOptionsFactory(),
      );

      expect(clickHandler).toHaveBeenCalled();
    },
  );

  test("it clicks element for isRootAware: true", async () => {
    const clickHandler = jest.fn();
    document.querySelector("button").addEventListener("click", clickHandler);

    await brick.run(
      unsafeAssumeValidArg({
        isRootAware: true,
        event: "click",
      }),
      brickOptionsFactory({ root: document.querySelector("button") }),
    );

    expect(clickHandler).toHaveBeenCalled();
  });
});
