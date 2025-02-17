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

import React from "react";
import { propertiesToSchema } from "@/validators/generic";
import {
  type Manifest,
  type Menus,
  type Permissions,
} from "webextension-polyfill";
import {
  StarterBrickABC,
  type StarterBrickConfig,
  type StarterBrickDefinition,
} from "@/starterBricks/types";
import { castArray, cloneDeep, isEmpty } from "lodash";
import { checkAvailable, testMatchPatterns } from "@/bricks/available";
import reportError from "@/telemetry/reportError";
import notify from "@/utils/notify";
import { selectEventData } from "@/telemetry/deployments";
import { selectExtensionContext } from "@/starterBricks/helpers";
import { type BrickConfig, type BrickPipeline } from "@/bricks/types";
import { selectAllBlocks } from "@/bricks/util";
import { mergeReaders } from "@/bricks/readers/readerUtils";
import quickBarRegistry from "@/components/quickBar/quickBarRegistry";
import Icon from "@/icons/Icon";
import BackgroundLogger from "@/telemetry/BackgroundLogger";
import { CancelError } from "@/errors/businessErrors";
import { guessSelectedElement } from "@/utils/selectionController";
import {
  type InitialValues,
  reduceExtensionPipeline,
} from "@/runtime/reducePipeline";
import apiVersionOptions from "@/runtime/apiVersionOptions";
import { isSpecificError } from "@/errors/errorHelpers";
import { type ActionGenerator } from "@/components/quickBar/quickbarTypes";
import ArrayCompositeReader from "@/bricks/readers/ArrayCompositeReader";
import {
  QuickbarQueryReader,
  quickbarQueryReaderShim,
} from "@/starterBricks/quickbarQueryReader";
import { type IconConfig } from "@/types/iconTypes";
import { type Reader } from "@/types/bricks/readerTypes";
import { type StarterBrick } from "@/types/starterBrickTypes";
import { type UUID } from "@/types/stringTypes";
import { type Schema } from "@/types/schemaTypes";
import { type ResolvedModComponent } from "@/types/modComponentTypes";
import { type Brick } from "@/types/brickTypes";
import { isLoadedInIframe } from "@/utils/iframeUtils";
import makeServiceContextFromDependencies from "@/integrations/util/makeServiceContextFromDependencies";

export type QuickBarProviderConfig = {
  /**
   * A root action. If provided, produced actions will be nested under this action.
   */
  rootAction?: {
    /**
     * The title of the parent action to show in the Quick Bar
     */
    title: string;

    /**
     * (Optional) the icon to show in the Quick Bar
     */
    icon?: IconConfig;

    /**
     * (Optional) only generate actions if the root element is selected/active.
     */
    requireActiveRoot?: boolean;
  };

  /**
   * Action generator pipeline.
   */
  generator: BrickConfig | BrickPipeline;
};

export abstract class QuickBarProviderStarterBrickABC extends StarterBrickABC<QuickBarProviderConfig> {
  static isQuickBarProviderExtensionPoint(
    extensionPoint: StarterBrick,
  ): extensionPoint is QuickBarProviderStarterBrickABC {
    // Need to a access a type specific property (QuickBarProviderExtensionPoint._definition) on a base-typed entity (StarterBrick)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (extensionPoint as any)?._definition?.type === "quickBarProvider";
  }

  abstract getBaseReader(): Promise<Reader>;

  abstract readonly documentUrlPatterns: Manifest.MatchPattern[];

  private readonly generators: Map<UUID, ActionGenerator> = new Map<
    UUID,
    ActionGenerator
  >();

  inputSchema: Schema = propertiesToSchema(
    {
      rootAction: {
        type: "object",
        properties: {
          title: { type: "string" },
          icon: { $ref: "https://app.pixiebrix.com/schemas/icon#" },
          requireActiveRoot: { type: "boolean" },
        },
      },
      generator: {
        oneOf: [
          { $ref: "https://app.pixiebrix.com/schemas/effect#" },
          {
            type: "array",
            items: { $ref: "https://app.pixiebrix.com/schemas/block#" },
          },
        ],
      },
    },
    ["generator"],
  );

  async getBricks(
    extension: ResolvedModComponent<QuickBarProviderConfig>,
  ): Promise<Brick[]> {
    return selectAllBlocks(extension.config.generator);
  }

  public get kind(): "quickBarProvider" {
    return "quickBarProvider";
  }

  override uninstall(): void {
    // Remove generators and all existing actions in the Quick Bar
    this.clearModComponentInterfaceAndEvents(
      this.modComponents.map((x) => x.id),
    );
    quickBarRegistry.removeExtensionPointActions(this.id);
    this.modComponents.length = 0;
  }

  /**
   * Unregister quick bar action providers for the given extension IDs.
   * @param extensionIds the extensions IDs to unregister
   */
  clearModComponentInterfaceAndEvents(extensionIds: UUID[]): void {
    for (const extensionId of extensionIds) {
      quickBarRegistry.removeGenerator(this.generators.get(extensionId));
      this.generators.delete(extensionId);
    }
  }

  async install(): Promise<boolean> {
    const { initQuickBarApp } = await import(
      /* webpackChunkName: "quickBarApp" */
      "@/components/quickBar/QuickBarApp"
    );

    await initQuickBarApp();

    // Like for context menus, the match patterns for quick bar control which pages the extension point requires early
    // access to (so PixieBrix will ask for permissions). Whether a quick bar item actually appears is controlled by the
    // documentUrlPatterns.
    return true;
  }

  async runModComponents(): Promise<void> {
    if (this.modComponents.length === 0) {
      console.debug(
        `quickBar starter brick ${this.id} has no installed components`,
      );

      // Not sure if this is needed or not, but remove any straggler extension actions
      quickBarRegistry.removeExtensionPointActions(this.id);
      return;
    }

    await this.syncActionProvidersForUrl();
  }

  override async defaultReader(): Promise<Reader> {
    return new ArrayCompositeReader([
      // Include QuickbarQueryReader for the outputSchema. The value gets filled in by the run method
      new QuickbarQueryReader(),
      await this.getBaseReader(),
    ]);
  }

  override async previewReader(): Promise<Reader> {
    return new ArrayCompositeReader([
      quickbarQueryReaderShim as unknown as Reader,
      await this.getBaseReader(),
    ]);
  }

  private async syncActionProvidersForUrl(): Promise<void> {
    // Remove any actions that were available on the previous navigation, but are no longer available
    if (!testMatchPatterns(this.documentUrlPatterns)) {
      // Remove actions and un-attach generators
      quickBarRegistry.removeExtensionPointActions(this.id);
      this.clearModComponentInterfaceAndEvents(
        this.modComponents.map((x) => x.id),
      );
      return;
    }

    const results = await Promise.allSettled(
      this.modComponents.map(async (extension) => {
        try {
          await this.registerActionProvider(extension);
        } catch (error) {
          reportError(error, selectEventData(extension));
          throw error;
        }
      }),
    );

    const numErrors = results.filter((x) => x.status === "rejected").length;
    if (numErrors > 0) {
      notify.error(`An error occurred adding ${numErrors} quick bar items(s)`);
    }
  }

  /**
   * Add a QuickBar action for extension
   * @private
   */
  private async registerActionProvider(
    extension: ResolvedModComponent<QuickBarProviderConfig>,
  ): Promise<void> {
    const { generator, rootAction } = extension.config;

    const extensionLogger = this.logger.childLogger(
      selectExtensionContext(extension),
    );

    let rootActionId: string = null;

    if (rootAction) {
      const { title, icon: iconConfig } = rootAction;
      const icon = iconConfig ? (
        <Icon icon={iconConfig.id} library={iconConfig.library} />
      ) : (
        <Icon />
      ); // Defaults to a box

      rootActionId = `provider-${extension.id}`;

      quickBarRegistry.addAction({
        id: rootActionId,
        extensionPointId: this.id,
        name: title,
        icon,
      });
    }

    const actionGenerator: ActionGenerator = async ({
      query,
      rootActionId: currentRootActionId,
      abortSignal,
    }) => {
      // Remove the old results during re-generation because they're no longer relevant
      quickBarRegistry.removeExtensionActions(extension.id);

      if (
        rootActionId &&
        rootActionId !== currentRootActionId &&
        rootAction.requireActiveRoot
      ) {
        // User is not drilled into the current action, so skip generation
        return;
      }

      const [reader, serviceContext] = await Promise.all([
        this.getBaseReader(),
        makeServiceContextFromDependencies(extension.integrationDependencies),
      ]);

      const targetElement = guessSelectedElement() ?? document;

      const input = {
        // Make sure to match the order in defaultReader so override behavior in the schema is accurate
        query,
        ...(await reader.read(targetElement)),
      };

      const initialValues: InitialValues = {
        input,
        root: targetElement,
        serviceContext,
        optionsArgs: extension.optionsArgs,
      };

      try {
        await reduceExtensionPipeline(generator, initialValues, {
          logger: extensionLogger,
          ...apiVersionOptions(extension.apiVersion),
          abortSignal,
        });
      } catch (error) {
        if (isSpecificError(error, CancelError)) {
          // Ignore cancel errors. Creators can use to skip under certain conditions
        }

        throw error;
      }
    };

    // Remove previous generator (if any)
    quickBarRegistry.removeGenerator(this.generators.get(extension.id));

    // Register new generator
    this.generators.set(extension.id, actionGenerator);
    quickBarRegistry.addGenerator(actionGenerator, rootActionId);
  }
}

export type QuickBarProviderDefaultOptions = Record<string, string | string[]>;

export interface QuickBarProviderDefinition extends StarterBrickDefinition {
  documentUrlPatterns?: Manifest.MatchPattern[];
  defaultOptions?: QuickBarProviderDefaultOptions;
}

export class RemoteQuickBarProviderExtensionPoint extends QuickBarProviderStarterBrickABC {
  private readonly _definition: QuickBarProviderDefinition;

  public readonly permissions: Permissions.Permissions;

  public readonly documentUrlPatterns: Manifest.MatchPattern[];

  public readonly contexts: Menus.ContextType[];

  public readonly rawConfig: StarterBrickConfig<QuickBarProviderDefinition>;

  constructor(config: StarterBrickConfig<QuickBarProviderDefinition>) {
    // `cloneDeep` to ensure we have an isolated copy (since proxies could get revoked)
    const cloned = cloneDeep(config);
    super(cloned.metadata, new BackgroundLogger());
    this._definition = cloned.definition;
    this.rawConfig = cloned;
    const { isAvailable, documentUrlPatterns } = cloned.definition;
    // If documentUrlPatterns not specified show everywhere
    this.documentUrlPatterns = castArray(documentUrlPatterns ?? ["*://*/*"]);
    this.permissions = {
      origins: isAvailable?.matchPatterns
        ? castArray(isAvailable.matchPatterns)
        : [],
    };
  }

  async isAvailable(): Promise<boolean> {
    // The quick bar lives on the top-level frame. So any actions contributed will never be visible
    if (isLoadedInIframe()) {
      return false;
    }

    if (
      !isEmpty(this._definition.isAvailable) &&
      (await checkAvailable(this._definition.isAvailable))
    ) {
      return true;
    }

    return checkAvailable({
      matchPatterns: this._definition.documentUrlPatterns,
    });
  }

  async getBaseReader() {
    return mergeReaders(this._definition.reader);
  }

  public override get defaultOptions(): QuickBarProviderDefaultOptions {
    return this._definition.defaultOptions;
  }
}

export function fromJS(
  config: StarterBrickConfig<QuickBarProviderDefinition>,
): StarterBrick {
  const { type } = config.definition;
  if (type !== "quickBarProvider") {
    throw new Error(`Expected type=quickBarProvider, got ${type}`);
  }

  return new RemoteQuickBarProviderExtensionPoint(config);
}
