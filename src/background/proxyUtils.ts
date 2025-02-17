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

import { type AxiosResponse } from "axios";
import {
  type ProxyResponseData,
  type ProxyResponseErrorData,
} from "@/types/contract";
import { safeGuessStatusText } from "@/errors/networkErrorHelpers";

/**
 * Return the error message from a 3rd party API proxied through the PixieBrix API proxy
 * @param errorData an error response from the PixieBrix API proxy.
 */
export function selectRemoteResponseErrorMessage(
  errorData: ProxyResponseErrorData,
): string {
  if (errorData.message) {
    return errorData.message;
  }

  if (typeof errorData.json === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Loose parsing of 3rd party error object, uses ?.
    const errorPayload = errorData.json as any;
    // OpenAI uses error.message payload
    const customMessage = errorPayload?.error?.message ?? errorPayload?.message;
    if (typeof customMessage === "string") {
      return customMessage;
    }
  }

  return errorData.reason ?? safeGuessStatusText(errorData.status_code);
}

/**
 * Convert a proxied response from the PixieBrix API proxy /api/proxy/ to an Axios-like response
 * @param data the response from the PixieBrix proxy
 */
export function proxyResponseToAxiosResponse(
  data: ProxyResponseData,
): Pick<AxiosResponse, "data" | "status" | "statusText"> {
  if (isProxiedErrorResponse(data)) {
    return {
      data: data.json,
      status: data.status_code,
      statusText: data.reason ?? data.message,
    };
  }

  return {
    data: data.json,
    status: data.status_code,
    // A bit of a hack, since our proxy doesn't return statusText on success
    statusText: safeGuessStatusText(data.status_code),
  };
}

/**
 * Returns true if the response is an error response
 * @param data response from the PixieBrix proxy
 * @see ProxyResponseErrorData
 */
export function isProxiedErrorResponse(
  data: ProxyResponseData,
): data is ProxyResponseErrorData {
  return data.status_code >= 400;
}
