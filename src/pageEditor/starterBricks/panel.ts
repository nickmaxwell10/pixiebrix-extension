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

import { type Metadata } from "@/types/registryTypes";
import { type ModComponentBase } from "@/types/modComponentTypes";
import {
  baseFromExtension,
  baseSelectExtension,
  baseSelectExtensionPoint,
  extensionWithNormalizedPipeline,
  getImplicitReader,
  lookupExtensionPoint,
  makeInitialBaseState,
  makeIsAvailable,
  readerTypeHack,
  removeEmptyValues,
  selectIsAvailable,
} from "@/pageEditor/starterBricks/base";
import { omitEditorMetadata } from "./pipelineMapping";
import { type StarterBrickConfig } from "@/starterBricks/types";
import {
  type PanelConfig,
  type PanelDefinition,
  PanelStarterBrickABC,
} from "@/starterBricks/panelExtension";
import { getDomain } from "@/permissions/patterns";
import { faWindowMaximize } from "@fortawesome/free-solid-svg-icons";
import { type ElementConfig } from "@/pageEditor/starterBricks/elementConfig";
import PanelConfiguration from "@/pageEditor/tabs/panel/PanelConfiguration";
import { insertPanel } from "@/contentScript/messenger/api";
import {
  type DynamicDefinition,
  type PanelSelectionResult,
} from "@/contentScript/pageEditor/types";
import { type PanelFormState, type PanelTraits } from "./formStateTypes";

const DEFAULT_TRAITS: PanelTraits = {
  style: {
    mode: "inherit",
  },
};

function fromNativeElement(
  url: string,
  metadata: Metadata,
  panel: PanelSelectionResult,
): PanelFormState {
  return {
    type: "panel",
    label: `My ${getDomain(url)} panel`,
    ...makeInitialBaseState(panel.uuid),
    containerInfo: panel.containerInfo,
    extensionPoint: {
      metadata,
      definition: {
        ...panel.foundation,
        reader: getImplicitReader("panel"),
        isAvailable: makeIsAvailable(url),
      },
      traits: DEFAULT_TRAITS,
    },
    extension: {
      heading: panel.panel.heading,
      collapsible: panel.panel.collapsible ?? false,
      shadowDOM: panel.panel.shadowDOM ?? true,
      blockPipeline: [],
    },
  };
}

function selectExtensionPointConfig(
  formState: PanelFormState,
): StarterBrickConfig<PanelDefinition> {
  const { extensionPoint } = formState;
  const {
    definition: { isAvailable, position, template, reader, containerSelector },
  } = extensionPoint;

  return removeEmptyValues({
    ...baseSelectExtensionPoint(formState),
    definition: {
      type: "panel",
      reader,
      isAvailable,
      containerSelector,
      position,
      template,
    },
  });
}

function selectExtension(
  state: PanelFormState,
  options: { includeInstanceIds?: boolean } = {},
): ModComponentBase<PanelConfig> {
  const { extension } = state;
  const config: PanelConfig = {
    heading: extension.heading,
    body: options.includeInstanceIds
      ? extension.blockPipeline
      : omitEditorMetadata(extension.blockPipeline),
    collapsible: extension.collapsible,
    shadowDOM: extension.shadowDOM,
  };
  return removeEmptyValues({
    ...baseSelectExtension(state),
    config,
  });
}

function asDynamicElement(element: PanelFormState): DynamicDefinition {
  return {
    type: "panel",
    extension: selectExtension(element, { includeInstanceIds: true }),
    extensionPointConfig: selectExtensionPointConfig(element),
  };
}

async function fromExtension(
  config: ModComponentBase<PanelConfig>,
): Promise<PanelFormState> {
  const extensionPoint = await lookupExtensionPoint<
    PanelDefinition,
    PanelConfig,
    "panel"
  >(config, "panel");

  const base = baseFromExtension(config, extensionPoint.definition.type);
  const extension = await extensionWithNormalizedPipeline(
    config.config,
    "body",
    {
      heading: "",
    },
  );

  return {
    ...base,

    extension,

    containerInfo: null,

    extensionPoint: {
      metadata: extensionPoint.metadata,
      traits: {
        // We don't provide a way to set style anywhere yet so this doesn't apply yet
        style: { mode: "inherit" },
      },
      definition: {
        ...extensionPoint.definition,
        reader: readerTypeHack(extensionPoint.definition.reader),
        isAvailable: selectIsAvailable(extensionPoint),
      },
    },
  };
}

const config: ElementConfig<PanelSelectionResult, PanelFormState> = {
  displayOrder: 2,
  elementType: "panel",
  label: "Panel",
  icon: faWindowMaximize,
  baseClass: PanelStarterBrickABC,
  selectNativeElement: insertPanel,
  flag: "page-editor-extension-panel",
  EditorNode: PanelConfiguration,
  fromNativeElement,
  asDynamicElement,
  selectExtensionPointConfig,
  selectExtension,
  fromExtension,
};

export default config;
