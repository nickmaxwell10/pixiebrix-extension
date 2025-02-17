/* eslint-disable @typescript-eslint/no-explicit-any -- TODO: The types around schemas are loose and complex */
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

import yaml from "js-yaml";
import { type UnknownObject } from "@/types/objectTypes";
import { produce } from "immer";
import { isPlainObject } from "lodash";
import { toExpression } from "@/utils/expressionUtils";
import { type ExpressionType } from "@/types/runtimeTypes";
import { type BrickPipeline } from "@/bricks/types";

/**
 * @param tag the tag name, without the leading `!`
 */
function createExpression(tag: ExpressionType): yaml.Type {
  // See https://github.com/nodeca/js-yaml/blob/master/examples/custom_types.js

  return new yaml.Type("!" + tag, {
    kind: "scalar",

    resolve: (data) => typeof data === "string",

    // eslint-disable-next-line local-rules/noExpressionLiterals -- untyped from YAML
    construct: (data) => ({
      __type__: tag,
      __value__: data,
    }),

    predicate: (data) =>
      typeof data === "object" &&
      "__type__" in data &&
      (data as UnknownObject).__type__ === tag,

    represent: (data) => (data as UnknownObject).__value__,
  });
}

const deferExpression = new yaml.Type("!defer", {
  kind: "mapping",

  resolve: (data) => isPlainObject(data),

  construct: (data) => toExpression("defer", data),

  predicate: (data) =>
    typeof data === "object" &&
    "__type__" in data &&
    (data as UnknownObject).__type__ === "defer",

  represent: (data) => (data as UnknownObject).__value__,
});

const pipelineExpression = new yaml.Type("!pipeline", {
  kind: "sequence",

  resolve: (data) => Array.isArray(data),

  construct: (data) => toExpression("pipeline", data as BrickPipeline),

  predicate: (data) =>
    typeof data === "object" &&
    "__type__" in data &&
    (data as UnknownObject).__type__ === "pipeline",

  represent: (data) => (data as UnknownObject).__value__,
});

const RUNTIME_SCHEMA = yaml.DEFAULT_SCHEMA.extend([
  createExpression("var"),
  createExpression("mustache"),
  createExpression("handlebars"),
  createExpression("nunjucks"),
  pipelineExpression,
  deferExpression,
]);

/**
 * Return a new definition with auxiliary fields removed.
 *
 * The PixieBrix server adds a `sharing` and `updated_at` field to the YAML/JSON configs of packages, because the
 * endpoint isn't set up to have an envelop around the package config. Therefore, we have to strip these out
 * prior to showing the YAML/JSON config, or saving the values on the server.
 *
 * @see ModDefinition.updated_at
 * @see ModDefinition.sharing
 */
function stripNonSchemaProps(brick: any) {
  return produce(brick, (draft: any) => {
    // Root-level props
    for (const prop of ["id", "sharing", "updated_at"]) {
      if (prop in draft) {
        // eslint-disable-next-line security/detect-object-injection -- constant above
        delete draft[prop];
      }
    }

    // Props in the `metadata` object
    if (draft.metadata && typeof draft.metadata === "object") {
      for (const prop of ["sharing", "updated_at"]) {
        if (prop in draft.metadata) {
          // eslint-disable-next-line security/detect-object-injection -- constant above
          delete draft.metadata[prop];
        }
      }
    }

    return draft;
  });
}

/**
 * Load brick YAML, with support for the custom tags for expressions.
 */
export function loadBrickYaml(config: string): unknown {
  return yaml.load(config, { schema: RUNTIME_SCHEMA });
}

export function dumpBrickYaml(
  brick: unknown,
  options: yaml.DumpOptions = {},
): string {
  return yaml.dump(stripNonSchemaProps(brick), {
    ...options,
    schema: RUNTIME_SCHEMA,
  });
}
