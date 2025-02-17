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
  INNER_SCOPE,
  type Metadata,
  type RegistryId,
} from "@/types/registryTypes";
import { castArray, cloneDeep, isEmpty } from "lodash";
import {
  assertStarterBrickConfig,
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import { type StarterBrickType } from "@/types/starterBrickTypes";
import { registry } from "@/background/messenger/api";
import type React from "react";
import { createSitePattern } from "@/permissions/patterns";
import { type Except } from "type-fest";
import {
  isInnerDefinitionRegistryId,
  uuidv4,
  validateRegistryId,
  validateSemVerString,
} from "@/types/helpers";
import {
  type BrickPipeline,
  type NormalizedAvailability,
  type ReaderConfig,
} from "@/bricks/types";
import { type UnknownObject } from "@/types/objectTypes";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { hasInnerExtensionPointRef } from "@/registry/internal";
import { normalizePipelineForEditor } from "./pipelineMapping";
import { emptyPermissionsFactory } from "@/permissions/permissionsUtils";
import { type ApiVersion } from "@/types/runtimeTypes";
import { type ModComponentBase } from "@/types/modComponentTypes";
import { type Schema } from "@/types/schemaTypes";
import { type SafeString, type UUID } from "@/types/stringTypes";
import { isExpression } from "@/utils/expressionUtils";
import { isNullOrBlank } from "@/utils/stringUtils";
import { deepPickBy } from "@/utils/objectUtils";
import { freshIdentifier } from "@/utils/variableUtils";
import {
  type BaseExtensionState,
  type BaseFormState,
  type SingleLayerReaderConfig,
} from "@/pageEditor/baseFormStateTypes";
import { emptyModOptionsDefinitionFactory } from "@/utils/modUtils";

export interface WizardStep {
  step: string;
  Component: React.FunctionComponent<{
    eventKey: string;
  }>;
}

/**
 * Brick definition API controlling how the PixieBrix runtime interprets brick configurations
 * @see ApiVersion
 */
export const PAGE_EDITOR_DEFAULT_BRICK_API_VERSION: ApiVersion = "v3";

/**
 * Default definition entry for the inner definition of the extensionPoint for the extension
 */
export const DEFAULT_EXTENSION_POINT_VAR = "extensionPoint";

export function makeIsAvailable(url: string): NormalizedAvailability {
  return {
    matchPatterns: [createSitePattern(url)],
    urlPatterns: [],
    selectors: [],
  };
}

/**
 * Return common extension properties for the Page Editor form state
 */
export function baseFromExtension<T extends StarterBrickType>(
  config: ModComponentBase,
  type: T,
): Pick<
  BaseFormState,
  | "uuid"
  | "apiVersion"
  | "installed"
  | "label"
  | "integrationDependencies"
  | "permissions"
  | "optionsArgs"
  | "recipe"
> & { type: T } {
  return {
    uuid: config.id,
    apiVersion: config.apiVersion,
    installed: true,
    label: config.label,
    // Normalize here because the fields aren't optional/nullable on the BaseFormState destination type.
    integrationDependencies: config.integrationDependencies ?? [],
    permissions: config.permissions ?? {},
    optionsArgs: config.optionsArgs ?? {},
    type,
    recipe: config._recipe,
  };
}

/**
 * Add the recipe options to the form state if the extension is a part of a recipe
 */
export function initRecipeOptionsIfNeeded<TElement extends BaseFormState>(
  element: TElement,
  recipes: ModDefinition[],
) {
  if (element.recipe?.id) {
    const recipe = recipes?.find((x) => x.metadata.id === element.recipe.id);

    if (recipe?.options == null) {
      element.optionsDefinition = emptyModOptionsDefinitionFactory();
    } else {
      element.optionsDefinition = {
        schema: recipe.options.schema.properties
          ? recipe.options.schema
          : ({
              type: "object",
              properties: recipe.options.schema,
            } as Schema),
        uiSchema: recipe.options.uiSchema,
      };
    }
  }
}

export function baseSelectExtension({
  apiVersion,
  uuid,
  label,
  optionsArgs,
  integrationDependencies,
  permissions,
  extensionPoint,
  recipe,
}: BaseFormState): Pick<
  ModComponentBase,
  | "id"
  | "apiVersion"
  | "extensionPointId"
  | "_recipe"
  | "label"
  | "integrationDependencies"
  | "permissions"
  | "optionsArgs"
> {
  return {
    id: uuid,
    apiVersion,
    extensionPointId: extensionPoint.metadata.id,
    _recipe: recipe,
    label,
    integrationDependencies,
    permissions,
    optionsArgs,
  };
}

export function makeInitialBaseState(
  uuid: UUID = uuidv4(),
): Except<BaseFormState, "type" | "label" | "extensionPoint"> {
  return {
    uuid,
    apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
    integrationDependencies: [],
    permissions: emptyPermissionsFactory(),
    optionsArgs: {},
    extension: {
      blockPipeline: [],
    },
    recipe: undefined,
  };
}

/**
 * Create metadata for a temporary extension point definition. When the extension point is saved, it will be assigned
 * an id based on its hash, and included in the `definitions` section of the recipe/extension.
 *
 * @see makeInternalId
 */
export function internalStarterBrickMetaFactory(): Metadata {
  return {
    id: validateRegistryId(`${INNER_SCOPE}/${uuidv4()}`),
    name: "Temporary extension point",
  };
}

/**
 * Map availability from extension point configuration to state for the page editor.
 */
export function selectIsAvailable(
  extensionPoint: StarterBrickConfig,
): NormalizedAvailability {
  assertStarterBrickConfig(extensionPoint);

  const availability: NormalizedAvailability = {};

  // All 3 fields in NormalizedAvailability are optional, so we should only set each one if
  // the StarterBrickConfig has a value set for that field. Normalizing here makes testing
  // harder because we then have to account for the normalized value in assertions.
  const { isAvailable } = extensionPoint.definition;

  if (isAvailable.matchPatterns) {
    availability.matchPatterns = castArray(isAvailable.matchPatterns);
  }

  if (isAvailable.urlPatterns) {
    availability.urlPatterns = castArray(isAvailable.urlPatterns);
  }

  if (isAvailable.selectors) {
    availability.selectors = castArray(isAvailable.selectors);
  }

  return availability;
}

/**
 * Exclude malformed matchPatterns and selectors from an isAvailable section that may have found their way over from the
 * Page Editor.
 *
 * Currently, excludes:
 * - Null values
 * - Blank values
 */
export function cleanIsAvailable({
  matchPatterns = [],
  urlPatterns = [],
  selectors = [],
}: NormalizedAvailability): NormalizedAvailability {
  return {
    matchPatterns: matchPatterns.filter((x) => !isNullOrBlank(x)),
    urlPatterns: urlPatterns.filter((x) => isEmpty(x)),
    selectors: selectors.filter((x) => !isNullOrBlank(x)),
  };
}

export async function lookupExtensionPoint<
  TDefinition extends StarterBrickDefinition,
  TConfig extends UnknownObject,
  TType extends string,
>(
  config: ModComponentBase<TConfig>,
  type: TType,
): Promise<StarterBrickConfig<TDefinition> & { definition: { type: TType } }> {
  if (!config) {
    throw new Error("config is required");
  }

  if (hasInnerExtensionPointRef(config)) {
    const definition = config.definitions[config.extensionPointId];
    console.debug(
      "Converting extension definition to temporary extension point",
      definition,
    );
    const innerExtensionPoint = {
      apiVersion: PAGE_EDITOR_DEFAULT_BRICK_API_VERSION,
      kind: "extensionPoint",
      metadata: internalStarterBrickMetaFactory(),
      ...definition,
    } as unknown as StarterBrickConfig<TDefinition> & {
      definition: { type: TType };
    };

    assertStarterBrickConfig(innerExtensionPoint);
    return innerExtensionPoint;
  }

  const brick = await registry.find(config.extensionPointId);
  if (!brick) {
    throw new Error(
      `Cannot find starter brick definition: ${config.extensionPointId}`,
    );
  }

  const extensionPoint =
    brick.config as unknown as StarterBrickConfig<TDefinition>;
  if (extensionPoint.definition.type !== type) {
    throw new Error(`Expected ${type} starter brick type`);
  }

  return extensionPoint as StarterBrickConfig<TDefinition> & {
    definition: { type: TType };
  };
}

export function baseSelectExtensionPoint(
  formState: BaseFormState,
): Except<StarterBrickConfig, "definition"> {
  const { metadata } = formState.extensionPoint;

  return {
    apiVersion: formState.apiVersion,
    kind: "extensionPoint",
    metadata: {
      id: metadata.id,
      // The server requires the version to save the brick, even though it's not marked as required
      // in the front-end schemas
      version: metadata.version ?? validateSemVerString("1.0.0"),
      name: metadata.name,
      // The server requires the description to save the brick, even though it's not marked as required
      // in the front-end schemas
      description: metadata.description ?? "Created using the Page Editor",
    },
  };
}

export function extensionWithInnerDefinitions(
  extension: ModComponentBase,
  extensionPointDefinition: StarterBrickDefinition,
): ModComponentBase {
  if (isInnerDefinitionRegistryId(extension.extensionPointId)) {
    const extensionPointId = freshIdentifier(
      DEFAULT_EXTENSION_POINT_VAR as SafeString,
      Object.keys(extension.definitions ?? {}),
    );

    const result = cloneDeep(extension);
    result.definitions = {
      ...result.definitions,
      [extensionPointId]: {
        kind: "extensionPoint",
        definition: extensionPointDefinition,
      },
    };

    // XXX: we need to fix the type of ModComponentBase.extensionPointId to support variable names
    result.extensionPointId = extensionPointId as RegistryId;

    return result;
  }

  return extension;
}

/**
 * Remove object entries undefined and empty-string values.
 *
 * - Formik/React need real blank values in order to control `input` tag components.
 * - PixieBrix does not want those because it treats an empty string as "", not null/undefined
 */
// eslint-disable-next-line @typescript-eslint/ban-types -- support interfaces that don't have index types
export function removeEmptyValues<T extends object>(obj: T): T {
  // Technically the return type is Partial<T> (with recursive partials). However, we'll trust that the PageEditor
  // requires the user to set values that actually need to be set. They'll also get caught by input validation
  // when the bricks are run.
  return deepPickBy(
    obj,
    (value: unknown, parent: unknown) =>
      isExpression(parent) || (value !== undefined && value !== ""),
  ) as T;
}

/**
 * Return a composite reader to automatically include in new extensions created with the Page Editor.
 */
export function getImplicitReader(
  type: StarterBrickType,
): SingleLayerReaderConfig {
  // Reminder: when providing a composite array reader, the later entries override the earlier ones

  const base = [
    validateRegistryId("@pixiebrix/document-metadata"),
    // Include @pixiebrix/document-context because it reads the current URL, instead of the original URL on the page.
    // Necessary to avoid confusion when working with SPAs
    validateRegistryId("@pixiebrix/document-context"),
  ] as ReaderConfig[];

  const elementAddons = [
    { element: validateRegistryId("@pixiebrix/html/element") },
  ] as const;

  if (type === "trigger") {
    return readerTypeHack([...base, ...elementAddons]);
  }

  if (type === "quickBar" || type === "quickBarProvider") {
    return readerTypeHack([
      ...base,
      ...elementAddons,
      validateRegistryId("@pixiebrix/selection"),
    ]);
  }

  if (type === "contextMenu") {
    // NOTE: we don't need to provide "@pixiebrix/context-menu-data" here because it's automatically attached by
    // the contextMenu extension point.
    return readerTypeHack([...base, ...elementAddons]);
  }

  if (type === "menuItem") {
    return readerTypeHack([...base, ...elementAddons]);
  }

  return readerTypeHack(base);
}

/**
 * Hack to use SingleLayerReaderConfig to prevent TypeScript reporting problems with infinite type instantiation
 */
export function readerTypeHack(reader: ReaderConfig): SingleLayerReaderConfig {
  return reader as SingleLayerReaderConfig;
}

/**
 * Normalize the pipeline prop name and assign instance ids for tracing.
 * @param config the extension configuration
 * @param pipelineProp the name of the pipeline prop, currently either "action" or "body"
 */
export async function extensionWithNormalizedPipeline<
  T extends UnknownObject,
  Prop extends keyof T,
>(
  config: T,
  pipelineProp: Prop,
  defaults: Partial<T> = {},
): Promise<BaseExtensionState & Omit<T, Prop>> {
  const { [pipelineProp]: pipeline, ...rest } = { ...config };
  return {
    blockPipeline: await normalizePipelineForEditor(
      castArray(pipeline) as BrickPipeline,
    ),
    ...defaults,
    ...rest,
  };
}
