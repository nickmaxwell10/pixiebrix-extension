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
import ConsoleLogger from "@/utils/ConsoleLogger";
import CustomEventEffect from "@/bricks/effects/customEvent";
import { uuidSequence } from "@/testUtils/factories/stringFactories";
import { brickOptionsFactory } from "@/testUtils/factories/runtimeFactories";

const brick = new CustomEventEffect();

const logger = new ConsoleLogger({
  extensionId: uuidSequence(0),
});

describe("CustomEventEffect", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <html>
        <body>
           <div>
            <button>Click me</button>
          </div>
        </body>
      </html>
    `;
  });

  test("isRootAware", async () => {
    await expect(brick.isRootAware()).resolves.toBe(true);
  });

  test("it fires custom event", async () => {
    const eventHandler = jest.fn();
    document.querySelector("button").addEventListener("foo", eventHandler);

    await brick.run(
      unsafeAssumeValidArg({ eventName: "foo" }),
      brickOptionsFactory({
        root: document.querySelector("button"),
        logger,
      }),
    );

    expect(eventHandler).toHaveBeenCalled();
  });

  test("it bubbles custom event", async () => {
    const eventHandler = jest.fn();
    document.querySelector("div").addEventListener("foo", eventHandler);

    await brick.run(
      unsafeAssumeValidArg({ eventName: "foo" }),
      brickOptionsFactory({
        root: document.querySelector("button"),
        logger,
      }),
    );

    expect(eventHandler).toHaveBeenCalled();
  });
});
