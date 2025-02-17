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

import { renderExplicit, renderImplicit } from "@/runtime/mapArgs";
import Mustache from "mustache";
import { engineRenderer } from "@/runtime/renderers";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { toExpression } from "@/utils/expressionUtils";
import { type TemplateEngine } from "@/types/runtimeTypes";
import { validateRegistryId } from "@/types/helpers";

describe("renderExplicit", () => {
  test("render var path", async () => {
    const rendered = await renderExplicit(
      { foo: toExpression("var", "array.0") },
      { array: ["bar"] },
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({
      foo: "bar",
    });
  });

  test("render mustache", async () => {
    const rendered = await renderExplicit(
      { foo: toExpression("mustache", "{{ array.0 }}!") },
      { array: ["bar"] },
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({
      foo: "bar!",
    });
  });

  test.each([
    ["mustache", { foo: "" }],
    ["nunjucks", { foo: "" }],
    ["handlebars", { foo: "" }],
    // `foo` gets stripped out because the renderExplicit drops entries with nullish values
    ["var", {}],
  ])(
    "doesn't fail on empty %s template",
    async (templateType: TemplateEngine, expectedValue) => {
      const rendered = await renderExplicit(
        { foo: toExpression(templateType, undefined) },
        {},
        apiVersionOptions("v3"),
      );

      expect(rendered).toEqual(expectedValue);
    },
  );
});

// This is stupid implicit behavior, with prevent passing null to APIs. Capturing here to clarify how to work around.
// it if it becomes a blocker in practice.
// https://github.com/pixiebrix/pixiebrix-extension/issues/3282
describe("exclude null", () => {
  test("exclude null literal", async () => {
    const rendered = await renderExplicit(
      { foo: null },
      {},
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({});
  });

  test("convert null nunjucks template to string", async () => {
    const rendered = await renderExplicit(
      { foo: toExpression("nunjucks", undefined) },
      {},
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({ foo: "" });
  });

  test("remove null var value", async () => {
    const rendered = await renderExplicit(
      { foo: toExpression("var", undefined) },
      {},
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({});
  });
});

describe("renderImplicit", () => {
  test("prefer path to renderer", async () => {
    await expect(
      renderImplicit({ foo: "array.0" }, { array: ["bar"] }, Mustache.render),
    ).resolves.toEqual({
      foo: "bar",
    });
  });

  test("render path as string if it doesn't exist in the context", async () => {
    await expect(
      renderImplicit(
        { foo: "array.0" },
        { otherVar: ["bar"] },
        Mustache.render,
      ),
    ).resolves.toEqual({
      foo: "array.0",
    });
  });
});

describe("handlebars", () => {
  test("render array item", async () => {
    await expect(
      renderImplicit(
        { foo: "{{ obj.prop }}" },
        { obj: { prop: 42 } },
        engineRenderer("handlebars", apiVersionOptions("v3")),
      ),
    ).resolves.toEqual({
      foo: "42",
    });
  });

  // NOTE: Handlebars doesn't work with @-prefixed variable because it uses @ to denote data variables
  // see: https://handlebarsjs.com/api-reference/data-variables.html
  test("cannot render @-prefixed variable", async () => {
    await expect(
      renderImplicit(
        { foo: "{{ obj.prop }}" },
        { "@obj": { prop: 42 } },
        engineRenderer("handlebars", apiVersionOptions("v3")),
      ),
    ).resolves.toEqual({
      foo: "",
    });
  });
});

describe("identity - deep clone", () => {
  const config = {
    filter: {
      operator: "and",
      operands: [
        {
          operator: "or",
          operands: [
            {
              operator: "substring",
              field: "process",
              value: "Email Proof of Funds",
            },
          ],
        },
      ],
    },
    sort: {
      field: "id",
      direction: "desc",
    },
    page: {
      offset: 0,
      length: 80,
    },
  };

  test("deep clone object/arrays", async () => {
    const rendered = await renderExplicit(config, {}, apiVersionOptions("v3"));

    expect(rendered).toEqual(config);
  });

  test("deep clone complex var", async () => {
    const rendered = await renderExplicit(
      toExpression("var", "@payload"),
      { "@payload": config },
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual(config);
  });
});

describe("defer", () => {
  test("render !defer stops at defer", async () => {
    const config = {
      foo: toExpression("var", "foo"),
    };

    const rendered = await renderExplicit(
      {
        foo: toExpression("defer", config),
        bar: config,
      },
      { foo: 42 },
      { autoescape: false },
    );

    expect(rendered).toEqual({
      foo: toExpression("defer", config),
      bar: { foo: 42 },
    });
  });
});

describe("pipeline", () => {
  test("render !pipeline", async () => {
    const expression = toExpression("pipeline", [
      { id: validateRegistryId("@pixiebrix/confetti"), config: {} },
    ]);

    const rendered = await renderExplicit(
      {
        foo: expression,
      },
      { array: ["bar"] },
      { autoescape: false },
    );

    expect(rendered).toEqual({
      foo: expression,
    });
  });

  test("render !pipeline stops at pipeline", async () => {
    const config = {
      foo: toExpression("var", "foo"),
    };

    const rendered = await renderExplicit(
      {
        foo: toExpression("pipeline", [
          {
            id: validateRegistryId("@pixiebrix/confetti"),
            config,
          },
        ]),
        bar: config,
      },
      { foo: 42 },
      apiVersionOptions("v3"),
    );

    expect(rendered).toEqual({
      foo: toExpression("pipeline", [
        { id: validateRegistryId("@pixiebrix/confetti"), config },
      ]),
      bar: { foo: 42 },
    });
  });
});

describe("autoescape", () => {
  test.each([["mustache"], ["nunjucks"], ["handlebars"]])(
    "should autoescape for %s",
    async (templateEngine: TemplateEngine) => {
      const rendered = await renderExplicit(
        { foo: toExpression(templateEngine, "{{ special }}") },
        { special: "a & b" },
        { autoescape: true },
      );

      expect(rendered).toEqual({ foo: "a &amp; b" });
    },
  );

  test.each([["mustache"], ["nunjucks"], ["handlebars"]])(
    "should not autoescape for %s",
    async (templateEngine: TemplateEngine) => {
      const rendered = await renderExplicit(
        { foo: toExpression(templateEngine, "{{ special }}") },
        { special: "a & b" },
        { autoescape: false },
      );

      expect(rendered).toEqual({ foo: "a & b" });
    },
  );
});
