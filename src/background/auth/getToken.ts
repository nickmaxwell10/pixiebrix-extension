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
  type AuthData,
  type Integration,
  type IntegrationConfig,
} from "@/integrations/integrationTypes";
import { expectContext } from "@/utils/expectContext";
import axios from "axios";
import { setCachedAuthData } from "@/background/auth/authStorage";
import { memoizeUntilSettled } from "@/utils/promiseUtils";

/**
 * Exchange credentials for a token, and cache the token response.
 *
 * If a request for the token is already in progress, return the existing promise.
 */

export const getToken = memoizeUntilSettled(_getToken, {
  cacheKey: ([, auth]) => auth.id,
});

async function _getToken(
  service: Integration,
  auth: IntegrationConfig,
): Promise<AuthData> {
  expectContext("background");

  if (!service.isToken) {
    throw new Error(`Service ${service.id} does not use token authentication`);
  }

  const { url, data: tokenData } = service.getTokenContext(auth.config);

  const {
    status,
    statusText,
    data: responseData,
  } = await axios.post<AuthData>(url, tokenData);

  if (status >= 400) {
    throw new Error(statusText);
  }

  await setCachedAuthData(auth.id, responseData);

  return responseData;
}
