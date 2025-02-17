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

import { type WizardValues } from "@/activation/wizardTypes";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import { useCallback } from "react";
import { reactivateEveryTab } from "@/background/messenger/api";
import { useDispatch, useSelector } from "react-redux";
import extensionsSlice from "@/store/extensionsSlice";
import reportEvent from "@/telemetry/reportEvent";
import { getErrorMessage } from "@/errors/errorHelpers";
import { uninstallRecipe } from "@/store/uninstallUtils";
import { selectExtensions } from "@/store/extensionsSelectors";
import { ensurePermissionsFromUserGesture } from "@/permissions/permissionsUtils";
import { checkModDefinitionPermissions } from "@/modDefinitions/modDefinitionPermissionsHelpers";
import { isEmpty } from "lodash";
import { useCreateDatabaseMutation } from "@/services/api";
import { isDatabaseField } from "@/components/fields/schemaFields/fieldTypeCheckers";
import { isUUID, validateUUID } from "@/types/helpers";
import { Events } from "@/telemetry/events";

export type ActivateResult = {
  success: boolean;
  error?: string;
};

export type ActivateRecipeFormCallback =
  /**
   * Callback for activating a recipe.
   *
   * @param {WizardValues} formValues - The form values for recipe configuration options
   * @param {ModDefinition} recipe - The recipe definition to install
   * @returns {Promise<ActivateResult>} a promise that resolves to an ActivateResult
   */
  (formValues: WizardValues, recipe: ModDefinition) => Promise<ActivateResult>;

type ActivationSource = "marketplace" | "extensionConsole";

function selectActivateEventData(recipe: ModDefinition) {
  return {
    blueprintId: recipe.metadata.id,
    extensions: recipe.extensionPoints.map((x) => x.label),
  };
}

/**
 * React hook to install a recipe.
 *
 * Prompts the user to grant permissions if PixieBrix does not already have the required permissions.
 *
 * @param {ActivationSource} source - The source of the activation, only used for reporting purposes
 * @param {boolean} checkPermissions - Whether to check for permissions before activating the recipe
 * @returns {ActivateRecipeFormCallback} - A callback that can be used to activate a recipe
 * @see useActivateRecipeWizard
 */
function useActivateRecipe(
  source: ActivationSource,
  { checkPermissions = true }: { checkPermissions?: boolean } = {},
): ActivateRecipeFormCallback {
  const dispatch = useDispatch();
  const extensions = useSelector(selectExtensions);

  const [createDatabase] = useCreateDatabaseMutation();

  return useCallback(
    async (formValues: WizardValues, recipe: ModDefinition) => {
      const recipeExtensions = extensions.filter(
        (extension) => extension._recipe?.id === recipe.metadata.id,
      );
      const isReactivate = !isEmpty(recipeExtensions);

      if (source === "extensionConsole") {
        // Note: The prefix "Marketplace" on the telemetry event name
        // here is legacy terminology from before the public marketplace
        // was created. It refers to the mod-list part of the extension
        // console, to distinguish that from the workshop.
        // It's being kept to keep our metrics history clean.
        reportEvent(Events.MARKETPLACE_ACTIVATE, {
          ...selectActivateEventData(recipe),
          reactivate: isReactivate,
        });
      }

      const configuredDependencies = formValues.integrationDependencies.filter(
        ({ configId }) => Boolean(configId),
      );

      try {
        const recipePermissions = await checkModDefinitionPermissions(
          recipe,
          configuredDependencies,
        );

        if (checkPermissions) {
          const isPermissionsAcceptedByUser =
            await ensurePermissionsFromUserGesture(recipePermissions);

          if (!isPermissionsAcceptedByUser) {
            if (source === "extensionConsole") {
              // Note: The prefix "Marketplace" on the telemetry event name
              // here is legacy terminology from before the public marketplace
              // was created. It refers to the mod-list part of the extension
              // console, to distinguish that from the workshop.
              // It's being kept like this so our metrics history stays clean.
              reportEvent(Events.MARKETPLACE_REJECT_PERMISSIONS, {
                ...selectActivateEventData(recipe),
                reactivate: isReactivate,
              });
            }

            return {
              success: false,
              error: "You must accept browser permissions to activate.",
            };
          }
        }

        const { optionsArgs, integrationDependencies } = formValues;

        // Create databases for any recipe options database fields where the
        // schema format is "preview", and the field value is a string to use
        // as the database name
        const autoCreateDatabaseFieldNames = Object.entries(
          recipe.options?.schema?.properties ?? {},
        )
          .filter(
            ([name, fieldSchema]) =>
              typeof fieldSchema !== "boolean" &&
              isDatabaseField(fieldSchema) &&
              fieldSchema.format === "preview" &&
              typeof optionsArgs[name] === "string" &&
              !isEmpty(optionsArgs[name]) &&
              // If the value is a UUID, then it's a database ID for an existing database
              !isUUID(optionsArgs[name] as string),
          )
          .map(([name]) => name);
        await Promise.all(
          autoCreateDatabaseFieldNames.map(async (name) => {
            // Type-checked in the filter above
            const databaseName: string = optionsArgs[name] as string;
            const result = await createDatabase({ name: databaseName });

            if ("error" in result) {
              throw result.error;
            }

            optionsArgs[name] = validateUUID(result.data.id);
          }),
        );

        const recipeExtensions = extensions.filter(
          (extension) => extension._recipe?.id === recipe.metadata.id,
        );

        await uninstallRecipe(recipe.metadata.id, recipeExtensions, dispatch);

        dispatch(
          extensionsSlice.actions.installMod({
            modDefinition: recipe,
            configuredDependencies: integrationDependencies,
            optionsArgs,
            screen: source,
            isReinstall: recipeExtensions.length > 0,
          }),
        );

        reactivateEveryTab();
      } catch (error) {
        const errorMessage = getErrorMessage(error);

        console.error(`Error activating mod: ${recipe.metadata.id}`, {
          error,
        });

        if (typeof errorMessage === "string") {
          return {
            success: false,
            error: errorMessage,
          };
        }
      }

      return {
        success: true,
      };
    },
    [createDatabase, dispatch, extensions, source],
  );
}

export default useActivateRecipe;
