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

import { createSelector } from "@reduxjs/toolkit";
import { type SettingsRootState } from "@/store/settings/settingsTypes";

export const selectUpdatePromptState = createSelector(
  [
    ({ settings }: SettingsRootState) => settings,
    (
      state: SettingsRootState,
      args: { now: number; enforceUpdateMillis: number | null },
    ) => args,
  ],
  (state, { now, enforceUpdateMillis }) => {
    const { nextUpdate, updatePromptTimestamp } = state;

    const timeRemaining =
      updatePromptTimestamp != null && enforceUpdateMillis
        ? enforceUpdateMillis - (now - updatePromptTimestamp)
        : Number.MAX_SAFE_INTEGER;

    const isUpdateOverdue = timeRemaining <= 0;

    return {
      isSnoozed: nextUpdate != null && nextUpdate > now,
      isUpdateOverdue,
      updatePromptTimestamp,
      timeRemaining,
    };
  },
);

export const selectSettings = ({ settings }: SettingsRootState) => settings;

export const selectBrowserWarningDismissed = ({
  settings,
}: SettingsRootState) => settings.browserWarningDismissed;
