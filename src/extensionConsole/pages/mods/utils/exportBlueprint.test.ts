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

import { makeBlueprint } from "@/extensionConsole/pages/mods/utils/exportBlueprint";
import { validateRegistryId } from "@/types/helpers";
import { type UnresolvedModComponent } from "@/types/modComponentTypes";
import { modComponentFactory } from "@/testUtils/factories/modComponentFactories";

describe("makeBlueprint", () => {
  it("smoke test", () => {
    const result = makeBlueprint(
      modComponentFactory() as UnresolvedModComponent,
      {
        id: validateRegistryId("test/blueprint"),
        name: "test",
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "recipe",
      }),
    );
  });

  it("infers mod options", () => {
    const modComponent = modComponentFactory({
      optionsArgs: {
        foo: "hello world!",
      },
    }) as UnresolvedModComponent;

    const result = makeBlueprint(modComponent, {
      id: validateRegistryId("test/blueprint"),
      name: "test",
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "recipe",
        options: {
          schema: {
            $schema: "http://json-schema.org/draft-04/schema#",
            properties: {
              foo: {
                type: "string",
              },
            },
            title: "Mod Options",
            type: "object",
          },
        },
      }),
    );
  });
});
