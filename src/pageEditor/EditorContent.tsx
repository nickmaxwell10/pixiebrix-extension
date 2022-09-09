/*
 * Copyright (C) 2022 PixieBrix, Inc.
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

import React, { useContext, useEffect } from "react";
import { PageEditorTabContext } from "@/pageEditor/context";
import { useSelector } from "react-redux";
import { selectExtensions } from "@/store/extensionsSelectors";
import { selectSessionId } from "@/pageEditor/slices/sessionSelectors";
import { reportEvent } from "@/telemetry/events";
import { useGetMarketplaceListingsQuery } from "@/services/api";
import useInstallState from "@/pageEditor/hooks/useInstallState";
import PermissionsPane from "@/pageEditor/panes/PermissionsPane";
import BetaPane from "@/pageEditor/panes/BetaPane";
import EditorPane from "@/pageEditor/panes/EditorPane";
import RecipePane from "@/pageEditor/panes/RecipePane";
import NoExtensionSelectedPane from "@/pageEditor/panes/NoExtensionSelectedPane";
import NoExtensionsPane from "@/pageEditor/panes/NoExtensionsPane";
import WelcomePane from "@/pageEditor/panes/WelcomePane";
import {
  selectActiveElementId,
  selectActiveRecipeId,
  selectElements,
  selectErrorState,
} from "@/pageEditor/slices/editorSelectors";

const EditorContent: React.FC = () => {
  const { tabState, connecting: isConnectingToContentScript } =
    useContext(PageEditorTabContext);
  const installed = useSelector(selectExtensions);
  const sessionId = useSelector(selectSessionId);
  const elements = useSelector(selectElements);
  const { isBetaError, editorError } = useSelector(selectErrorState);
  const activeElementId = useSelector(selectActiveElementId);
  const activeRecipeId = useSelector(selectActiveRecipeId);

  const {
    availableDynamicIds,
    unavailableCount,
    loading: isLoadingExtensions,
  } = useInstallState(installed, elements);

  // Fetch-and-cache marketplace content for rendering in the Brick Selection modal
  useGetMarketplaceListingsQuery();

  useEffect(() => {
    reportEvent("PageEditorSessionStart", {
      sessionId,
    });

    return () => {
      reportEvent("PageEditorSessionEnd", {
        sessionId,
      });
    };
  }, [sessionId]);

  // Need to explicitly check for `false` because hasPermissions will be undefined if pending/error
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
  if (tabState.hasPermissions === false && !isConnectingToContentScript) {
    // Check `connecting` to optimistically show the main interface while the devtools are connecting to the page.
    return <PermissionsPane />;
  }

  // Show generic error for beta features
  if (isBetaError) {
    return <BetaPane />;
  }

  if (editorError) {
    return (
      <div className="p-2">
        <span className="text-danger">{editorError}</span>
      </div>
    );
  }

  if (activeElementId) {
    return <EditorPane />;
  }

  if (activeRecipeId) {
    return <RecipePane />;
  }

  if (isLoadingExtensions || isConnectingToContentScript) {
    // Avoid flashing the panes below while the state is loading. This condition should probably
    // not be moved below <NoExtensionSelectedPane>, <NoExtensionsPane>, or <WelcomePane>.
    // It loads fast enough to not require a <Loader> either.
    // https://github.com/pixiebrix/pixiebrix-extension/pull/3611
    return null;
  }

  if (availableDynamicIds?.size > 0 || installed.length > unavailableCount) {
    return <NoExtensionSelectedPane />;
  }

  if (installed.length > 0) {
    return <NoExtensionsPane unavailableCount={unavailableCount} />;
  }

  return <WelcomePane />;
};

export default EditorContent;
