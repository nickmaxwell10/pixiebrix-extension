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

import { type SidebarState } from "@/types/sidebarTypes";
import { getOpenPanelEntries } from "@/sidebar/eventKeyUtils";

export const getVisiblePanelCount = ({
  panels,
  forms,
  temporaryPanels,
  staticPanels,
  modActivationPanel,
  closedTabs,
}: SidebarState) => {
  // Temporary Panels are removed from the sidebar state when they are closed, so we don't need to filter them out
  const closablePanels = [...panels, ...staticPanels];
  const openPanels = getOpenPanelEntries(closablePanels, closedTabs);

  return (
    openPanels.length +
    forms.length +
    temporaryPanels.length +
    (modActivationPanel ? 1 : 0)
  );
};
