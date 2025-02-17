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

import { isExtensionContext } from "webext-detect-page";
import useUpdatableAsyncState from "@/hooks/useUpdatableAsyncState";
import { readManagedStorageByKey } from "@/store/enterprise/managedStorage";
import { StorageItem } from "webext-storage";
import { DEFAULT_SERVICE_URL } from "@/urlConstants";

type ConfiguredHost = string;

const serviceStorage = new StorageItem<ConfiguredHost>("service-url");

export function withoutTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

/**
 * Return the base URL of the PixieBrix service.
 *
 * Can be overriden by:
 * - Settings on the SettingsPage
 * - Managed storage (configured by Enterprise IT)
 */
export async function getBaseURL(): Promise<string> {
  if (isExtensionContext()) {
    const configured = await serviceStorage.get();
    if (configured) {
      return withoutTrailingSlash(configured);
    }

    const managed = await readManagedStorageByKey("serviceUrl");

    if (managed) {
      return withoutTrailingSlash(managed);
    }
  }

  return withoutTrailingSlash(DEFAULT_SERVICE_URL);
}

type ConfiguredHostResult = [
  ConfiguredHost | undefined,
  (url: string) => Promise<void>,
];

/**
 * Hook for retrieving/setting the manually configured host.
 */
export function useConfiguredHost(): ConfiguredHostResult {
  return useUpdatableAsyncState(serviceStorage.get, serviceStorage.set);
}
