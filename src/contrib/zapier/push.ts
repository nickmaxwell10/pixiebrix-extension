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

import { performConfiguredRequestInBackground } from "@/background/messenger/api";
import { pixiebrixConfigurationFactory } from "@/integrations/locator";
import { getBaseURL } from "@/services/baseService";
import { validateInput } from "@/validators/generic";
import { type Webhook } from "@/contrib/zapier/contract";
import { type Permissions } from "webextension-polyfill";
import { uuidv4, validateRegistryId } from "@/types/helpers";
import { BusinessError } from "@/errors/businessErrors";
import { type Schema, type SchemaProperties } from "@/types/schemaTypes";
import { EffectABC } from "@/types/bricks/effectTypes";
import { type UnknownObject } from "@/types/objectTypes";
import { type BrickArgs, type BrickOptions } from "@/types/runtimeTypes";

export const ZAPIER_ID = validateRegistryId("@pixiebrix/zapier/push-data");

export const ZAPIER_PROPERTIES: SchemaProperties = {
  pushKey: {
    type: "string",
    description: "The identifier for the Zap configured in Zapier",
    default: "my_zap",
  },
  data: {
    type: "object",
    additionalProperties: true,
  },
};

export const ZAPIER_PERMISSIONS: Permissions.Permissions = {
  origins: ["https://hooks.zapier.com/hooks/*"],
};

export class PushZap extends EffectABC {
  constructor() {
    super(ZAPIER_ID, "Push data to Zapier", "Push data to Zapier");
  }

  inputSchema: Schema = {
    $schema: "https://json-schema.org/draft/2019-09/schema#",
    type: "object",
    required: ["data"],
    properties: ZAPIER_PROPERTIES,
  };

  /**
   * Additional permissions required for CORS
   */
  override permissions: Permissions.Permissions = ZAPIER_PERMISSIONS;

  async effect(
    { pushKey, data }: BrickArgs<{ pushKey: string; data: UnknownObject }>,
    options: BrickOptions,
  ): Promise<void> {
    const { data: webhooks } = await performConfiguredRequestInBackground<{
      new_push_fields: Webhook[];
    }>(await pixiebrixConfigurationFactory(), {
      baseURL: await getBaseURL(),
      url: "/api/webhooks/hooks/",
      method: "get",
    });

    const webhook = webhooks.new_push_fields.find(
      (x) => x.display_name === pushKey,
    );

    if (!webhook) {
      throw new BusinessError(`No Zapier hook found for name: ${pushKey}`);
    }

    const validation = await validateInput(webhook.input_schema, data);

    if (!validation.valid) {
      options.logger.warn("Invalid data for Zapier effect");
    }

    await performConfiguredRequestInBackground(null, {
      url: webhook.url,
      method: "post",
      data: {
        ...data,
        id: uuidv4(),
      },
    });
  }
}
