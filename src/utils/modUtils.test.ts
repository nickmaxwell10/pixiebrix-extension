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
  getSharingSource,
  isResolvedModComponent,
  isUnavailableMod,
  normalizeModOptionsDefinition,
} from "./modUtils";
import { uuidv4 } from "@/types/helpers";
import { UserRole } from "@/types/contract";
import { type Mod, type UnavailableMod } from "@/types/modTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { modComponentFactory } from "@/testUtils/factories/modComponentFactories";
import { sharingDefinitionFactory } from "@/testUtils/factories/registryFactories";
import { defaultModDefinitionFactory } from "@/testUtils/factories/modDefinitionFactories";
import { InvalidTypeError } from "@/errors/genericErrors";

describe("getSharingType", () => {
  test("throws on invalid type", () => {
    const mod: Mod = {} as any;
    expect(() =>
      getSharingSource({
        mod,
        organizations: [],
        scope: "test_scope",
        installedExtensions: [],
      }),
    ).toThrow(InvalidTypeError);
  });

  test("personal extension", () => {
    const mod: Mod = modComponentFactory() as any;
    const { type, label } = getSharingSource({
      mod,
      organizations: [],
      scope: "test_scope",
      installedExtensions: [],
    });

    expect(type).toBe("Personal");
    expect(label).toBe("Personal");
  });

  test("public deployment", () => {
    const mod: Mod = modComponentFactory({
      _deployment: {
        id: uuidv4(),
        active: true,
        timestamp: new Date().toISOString(),
      },
    }) as any;
    const { type, label } = getSharingSource({
      mod,
      organizations: [],
      scope: "test_scope",
      installedExtensions: [],
    });

    expect(type).toBe("Deployment");
    expect(label).toBe("Deployment");
  });

  test("organization deployment", () => {
    const orgId = uuidv4();
    const mod: Mod = modComponentFactory({
      _deployment: {
        id: orgId,
        active: true,
        timestamp: new Date().toISOString(),
      },
    }) as any;

    // @ts-expect-error -- we are generating a test extension
    mod._recipe = {
      id: "test_org",
      sharing: {
        organizations: [orgId],
      },
    };

    const testOrganizations = [
      {
        id: orgId,
        name: "test_org",
        role: UserRole.admin,
      },
    ];

    const { type, label } = getSharingSource({
      mod,
      organizations: testOrganizations,
      scope: "test_scope",
      installedExtensions: [],
    });

    expect(type).toBe("Deployment");
    expect(label).toBe("test_org");
  });

  test("team mod", () => {
    const mod = defaultModDefinitionFactory();
    const orgId = uuidv4();

    mod.sharing.organizations = [orgId];

    const testOrganizations = [
      {
        id: orgId,
        name: "test_org",
        role: UserRole.admin,
      },
    ];

    const { type, label } = getSharingSource({
      mod,
      organizations: testOrganizations,
      scope: "test_scope",
      installedExtensions: [],
    });

    expect(type).toBe("Team");
    expect(label).toBe("test_org");
  });

  test("public mod", () => {
    const mod: Mod = defaultModDefinitionFactory({
      sharing: sharingDefinitionFactory({ public: true }),
    }) as any;

    const { type, label } = getSharingSource({
      mod,
      organizations: [],
      scope: "test_scope",
      installedExtensions: [],
    });

    expect(type).toBe("Public");
    expect(label).toBe("Public");
  });
});

describe("isExtension", () => {
  it("returns true for an extension", () => {
    const mod = modComponentFactory() as ResolvedModComponent;
    expect(isResolvedModComponent(mod)).toBe(true);
  });

  it("returns false for a recipe", () => {
    const mod = defaultModDefinitionFactory();
    expect(isResolvedModComponent(mod)).toBe(false);
  });
});

describe("isUnavailableMod", () => {
  it("returns false for a recipe definition", () => {
    const mod = defaultModDefinitionFactory();
    expect(isUnavailableMod(mod)).toBe(false);
  });

  it("returns true for UnavailableRecipe", () => {
    const mod = {
      isStub: true,
    } as UnavailableMod;
    expect(isUnavailableMod(mod)).toBe(true);
  });

  it("returns false for an extension", () => {
    const mod = modComponentFactory() as ResolvedModComponent;
    expect(isUnavailableMod(mod)).toBe(false);
  });
});

describe("normalizeModOptionsDefinition", () => {
  it("normalizes null", () => {
    expect(normalizeModOptionsDefinition(null)).toStrictEqual({
      schema: {
        type: "object",
        properties: {},
      },
      uiSchema: {
        "ui:order": ["*"],
      },
    });
  });

  it("normalizes legacy schema", () => {
    expect(
      normalizeModOptionsDefinition({
        schema: {
          foo: {
            type: "string",
          },
        },
      } as any),
    ).toStrictEqual({
      schema: {
        type: "object",
        $schema: "https://json-schema.org/draft/2019-09/schema#",
        properties: {
          foo: {
            type: "string",
          },
        },
        required: ["foo"],
      },
      uiSchema: {
        "ui:order": ["foo", "*"],
      },
    });
  });
});
