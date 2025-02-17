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

import { type DependencyList, useCallback } from "react";
import notify from "@/utils/notify";
import { type Event } from "@/telemetry/events";
import { CancelError } from "@/errors/businessErrors";
import reportEvent from "@/telemetry/reportEvent";

type Options = {
  event?: Event;
  errorMessage?: string;
  successMessage?: string;
};

/**
 * Replacement for useCallback that handles success/error notifications and telemetry.
 */
function useUserAction<T extends (...args: never[]) => unknown>(
  callback: T,
  options: Options,
  deps: DependencyList,
): T {
  const { event, successMessage, errorMessage = "An error occurred" } = options;

  const enhancedCallback = (async (...args) => {
    try {
      const rv = await callback(...args);

      if (successMessage) {
        notify.success(successMessage);
      }

      if (event) {
        reportEvent(event);
      }

      return rv;
    } catch (error) {
      if (error instanceof CancelError) {
        return;
      }

      notify.error({ message: errorMessage, error });
    }
  }) as T;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally leaving callback out of deps
  return useCallback<T>(enhancedCallback, [
    ...deps,
    options,
    errorMessage,
    event,
    successMessage,
  ]);
}

export default useUserAction;
