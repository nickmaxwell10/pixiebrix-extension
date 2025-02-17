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

import { fromJS as deserializePanel } from "@/starterBricks/panelExtension";
import { fromJS as deserializeMenuItem } from "@/starterBricks/menuItemExtension";
import { fromJS as deserializeTrigger } from "@/starterBricks/triggerExtension";
import { fromJS as deserializeContextMenu } from "@/starterBricks/contextMenu";
import { fromJS as deserializeSidebar } from "@/starterBricks/sidebarExtension";
import { fromJS as deserializeQuickBar } from "@/starterBricks/quickBarExtension";
import { fromJS as deserializeQuickBarProvider } from "@/starterBricks/quickBarProviderExtension";
import { fromJS as deserializeTour } from "@/starterBricks/tourExtension";
import { type StarterBrick } from "@/types/starterBrickTypes";
import { type StarterBrickConfig } from "@/starterBricks/types";

const TYPE_MAP = {
  panel: deserializePanel,
  menuItem: deserializeMenuItem,
  trigger: deserializeTrigger,
  contextMenu: deserializeContextMenu,
  actionPanel: deserializeSidebar,
  quickBar: deserializeQuickBar,
  quickBarProvider: deserializeQuickBarProvider,
  tour: deserializeTour,
};

export function fromJS(config: StarterBrickConfig): StarterBrick {
  if (config.kind !== "extensionPoint") {
    // Is `never` due to check, but needed because this method is called dynamically
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    throw new Error(`Expected kind extensionPoint, got ${config.kind}`);
  }

  if (!Object.hasOwn(TYPE_MAP, config.definition.type)) {
    throw new Error(`Unexpected starter brick type: ${config.definition.type}`);
  }

  // TODO: Find a better solution than casting to any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument -- the factory methods perform validation
  return TYPE_MAP[config.definition.type](config as any);
}
