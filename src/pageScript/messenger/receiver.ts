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

import { cleanValue } from "@/utils/objectUtils";
import { type Handler } from "@/utils/legacyMessengerUtils";

type AttachHandler = (type: string, handler: Handler) => void;

// Message Type -> Handler
const handlers = new Map<string, Handler>();

async function messageHandler(event: MessageEvent): Promise<void> {
  const type: string = event.data?.type;

  const handler = handlers.get(type);

  if (handler == null) {
    return;
  }

  const { meta, payload } = event.data;

  console.debug("RECEIVE", type, event.data);

  try {
    const result = await handler(payload);

    let cleanResult;
    try {
      // Chrome will drop the whole detail if it contains non-serializable values, e.g., methods
      cleanResult = cleanValue(result ?? null);
    } catch (error) {
      console.error("Cannot serialize result", { result, error });
      throw new Error(`Cannot serialize result for result ${type}`);
    }

    const detail = {
      id: meta.id,
      result: cleanResult,
    };
    console.debug("pageScript responding %s_FULFILLED", type, detail);
    document.dispatchEvent(
      new CustomEvent(`${type}_FULFILLED`, {
        detail,
      }),
    );
  } catch (error) {
    try {
      const detail = {
        id: meta.id,
        error,
      };
      console.warn("pageScript responding %s_REJECTED", type, detail);
      document.dispatchEvent(
        new CustomEvent(`${type}_REJECTED`, {
          detail,
        }),
      );
    } catch (error_) {
      console.error(
        "An error occurred while dispatching an error for %s",
        type,
        { error: error_, originalError: error },
      );
    }
  }
}

export function initialize(): AttachHandler {
  window.addEventListener("message", messageHandler);

  return (messageType: string, handler: Handler) => {
    handlers.set(messageType, handler);
  };
}
