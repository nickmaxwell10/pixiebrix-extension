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

import type {
  SidebarEntries,
  SidebarEntry,
  SidebarState,
} from "@/types/sidebarTypes";
import {
  isModActivationPanelEntry,
  isPanelEntry,
  isStaticPanelEntry,
} from "@/types/sidebarTypes";
import hash from "object-hash";
import { sortBy } from "lodash";

export function eventKeyForEntry(
  entry: SidebarEntry | undefined | null,
): string | null {
  if (entry == null) {
    return null;
  }

  if (isModActivationPanelEntry(entry)) {
    return `activate-${hash(sortBy(entry.modIds))}`;
  }

  if (isPanelEntry(entry)) {
    return `panel-${entry.extensionId}`;
  }

  if (isStaticPanelEntry(entry)) {
    return `static-${entry.key}-panel`;
  }

  // Use nonce to keep eventKeys unique for forms and temporary panels from the same extension
  return `${entry.type}-${entry.nonce}`;
}

/**
 * Return the default tab to show.
 *
 * Give preference to:
 * - Most recent ephemeral form
 * - Most recent temporary panel
 * - First panel
 */
export function defaultEventKey(
  {
    forms = [],
    panels = [],
    temporaryPanels = [],
    staticPanels = [],
    modActivationPanel = null,
  }: SidebarEntries,
  closedTabs: SidebarState["closedTabs"],
): string | null {
  if (forms.length > 0) {
    return eventKeyForEntry(forms.at(-1));
  }

  if (temporaryPanels.length > 0) {
    return eventKeyForEntry(temporaryPanels.at(-1));
  }

  const openPanels = getOpenPanelEntries(panels, closedTabs);
  if (openPanels.length > 0) {
    return eventKeyForEntry(openPanels.at(0));
  }

  if (modActivationPanel) {
    return eventKeyForEntry(modActivationPanel);
  }

  const openStaticPanels = getOpenPanelEntries(staticPanels, closedTabs);
  if (openStaticPanels.length > 0) {
    return eventKeyForEntry(openStaticPanels.at(0));
  }

  return null;
}

export function getOpenPanelEntries(
  entries: SidebarEntry[],
  closedTabs: SidebarState["closedTabs"],
): SidebarEntry[] {
  return entries.filter((entry) => {
    const key = eventKeyForEntry(entry);
    return !key || !closedTabs[key];
  });
}
