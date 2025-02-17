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

import { getDefaultRegistry } from "@rjsf/core";
import { type FieldProps } from "@rjsf/utils";
import React from "react";
import { type SchemaDefinition } from "@/types/schemaTypes";

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Loose types
const RjsfSchemaField = getDefaultRegistry().fields.SchemaField!;

/**
 * A base field used by RJSF to render a field preview.
 */
const FormPreviewSchemaField: React.FC<FieldProps> = (props) => {
  let fieldProps: FieldProps;
  // The value of oneOf/enum is a string when we render a @var
  // or in some special cases when the dropdown should be disabled (e.g. database selector)
  // In such case use this string value as a single option
  if (typeof props.schema.oneOf === "string") {
    // Not using immer.produce to clone `props` because it accesses `props.key` that throws an error
    fieldProps = {
      ...props,
      disabled: true,
      schema: {
        ...props.schema,
        oneOf: [
          {
            const: props.schema.oneOf,
          } as SchemaDefinition,
        ],
      },
    };
  } else if (typeof props.schema.enum === "string") {
    // Not using immer.produce to clone `props` because it accesses `props.key` that throws an error
    fieldProps = {
      ...props,
      disabled: true,
      schema: {
        ...props.schema,
        enum: [props.schema.enum],
        default: props.schema.enum,
      },
    };
  } else {
    fieldProps = props;
  }

  return <RjsfSchemaField {...fieldProps} />;
};

export default FormPreviewSchemaField;
