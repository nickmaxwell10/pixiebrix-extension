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

import React, { useMemo } from "react";
import { type ModDefinition } from "@/types/modDefinitionTypes";
import genericOptionsFactory from "@/components/fields/schemaFields/genericOptionsFactory";
import FieldRuntimeContext, {
  type RuntimeContext,
} from "@/components/fields/schemaFields/FieldRuntimeContext";

import { DEFAULT_RUNTIME_API_VERSION } from "@/runtime/apiVersionOptions";

const OPTIONS_FIELD_RUNTIME_CONTEXT: RuntimeContext = {
  apiVersion: DEFAULT_RUNTIME_API_VERSION,
  allowExpressions: false,
};

const OptionsBody: React.FunctionComponent<{
  mod: Pick<ModDefinition, "options">;
}> = ({ mod }) => {
  const OptionsGroup = useMemo(
    () => genericOptionsFactory(mod.options.schema, mod.options.uiSchema),
    [mod.options.schema, mod.options.uiSchema],
  );

  return (
    <FieldRuntimeContext.Provider value={OPTIONS_FIELD_RUNTIME_CONTEXT}>
      <OptionsGroup name="optionsArgs" />
    </FieldRuntimeContext.Provider>
  );
};

export default OptionsBody;
