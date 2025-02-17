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

/* Do not use `getMethod` in this file; Keep only registrations here, not implementations */
import { registerMethods } from "webext-messenger";
import { expectContext } from "@/utils/expectContext";
import { handleMenuAction } from "@/contentScript/contextMenus";
import {
  ensureInstalled,
  getActiveExtensionPoints,
  handleNavigate,
  queueReactivateTab,
  reactivateTab,
  removePersistedExtension,
} from "@/contentScript/lifecycle";
import {
  getFormDefinition,
  resolveForm,
  cancelForm,
} from "@/contentScript/ephemeralFormProtocol";
import {
  hideSidebar,
  showSidebar,
  rehydrateSidebar,
  removeExtensions as removeSidebars,
  reloadSidebar,
  getReservedPanelEntries,
} from "@/contentScript/sidebarController";
import { insertPanel } from "@/contentScript/pageEditor/insertPanel";
import { insertButton } from "@/contentScript/pageEditor/insertButton";
import {
  clearDynamicElements,
  disableOverlay,
  enableOverlay,
  runExtensionPointReader,
  updateDynamicElement,
} from "@/contentScript/pageEditor/dynamic";
import { getProcesses, initRobot } from "@/contentScript/uipath";
import {
  runBlockPreview,
  resetTab,
  runRendererBlock,
  navigateTab,
} from "@/contentScript/pageEditor";
import { checkAvailable } from "@/bricks/available";
import notify from "@/utils/notify";
import { runBrick } from "@/contentScript/executor";
import {
  cancelSelect,
  selectElement,
} from "@/contentScript/pageEditor/elementPicker";
import {
  runHeadlessPipeline,
  runMapArgs,
  runRendererPipeline,
} from "@/contentScript/pipelineProtocol";
import { toggleQuickBar } from "@/components/quickBar/QuickBarApp";
import { getPageState, setPageState } from "@/contentScript/pageState";
import {
  cancelTemporaryPanels,
  getPanelDefinition,
  resolveTemporaryPanel,
  stopWaitingForTemporaryPanels,
} from "@/bricks/transformers/temporaryInfo/temporaryPanelProtocol";
import { reloadActivationEnhancements } from "@/contentScript/loadActivationEnhancementsCore";
import { getAttributeExamples } from "@/contentScript/pageEditor/elementInformation";
import { closeWalkthroughModal } from "@/contentScript/walkthroughModalProtocol";
import showWalkthroughModal from "@/components/walkthroughModal/showWalkthroughModal";
import { getCopilotHostData } from "@/contrib/automationanywhere/SetCopilotDataEffect";

expectContext("contentScript");

declare global {
  interface MessengerMethods {
    FORM_GET_DEFINITION: typeof getFormDefinition;
    FORM_RESOLVE: typeof resolveForm;
    FORM_CANCEL: typeof cancelForm;
    WALKTHROUGH_MODAL_CLOSE: typeof closeWalkthroughModal;
    WALKTHROUGH_MODAL_SHOW: typeof showWalkthroughModal;
    TEMPORARY_PANEL_CLOSE: typeof stopWaitingForTemporaryPanels;
    TEMPORARY_PANEL_CANCEL: typeof cancelTemporaryPanels;
    PANEL_GET_DEFINITION: typeof getPanelDefinition;
    TEMPORARY_PANEL_RESOLVE: typeof resolveTemporaryPanel;
    QUEUE_REACTIVATE_TAB: typeof queueReactivateTab;
    REACTIVATE_TAB: typeof reactivateTab;
    REMOVE_INSTALLED_EXTENSION: typeof removePersistedExtension;

    NAVIGATE_TAB: typeof navigateTab;
    RESET_TAB: typeof resetTab;

    TOGGLE_QUICK_BAR: typeof toggleQuickBar;
    HANDLE_MENU_ACTION: typeof handleMenuAction;
    REHYDRATE_SIDEBAR: typeof rehydrateSidebar;
    SHOW_SIDEBAR: typeof showSidebar;
    HIDE_SIDEBAR: typeof hideSidebar;
    GET_RESERVED_SIDEBAR_ENTRIES: typeof getReservedPanelEntries;
    RELOAD_SIDEBAR: typeof reloadSidebar;
    REMOVE_SIDEBARS: typeof removeSidebars;

    INSERT_PANEL: typeof insertPanel;
    INSERT_BUTTON: typeof insertButton;

    UIPATH_INIT: typeof initRobot;
    UIPATH_GET_PROCESSES: typeof getProcesses;

    GET_ATTRIBUTE_EXAMPLES: typeof getAttributeExamples;
    RUN_SINGLE_BLOCK: typeof runBlockPreview;
    RUN_RENDERER_BLOCK: typeof runRendererBlock;

    CLEAR_DYNAMIC_ELEMENTS: typeof clearDynamicElements;
    UPDATE_DYNAMIC_ELEMENT: typeof updateDynamicElement;
    RUN_EXTENSION_POINT_READER: typeof runExtensionPointReader;
    ENABLE_OVERLAY: typeof enableOverlay;
    DISABLE_OVERLAY: typeof disableOverlay;
    INSTALLED_EXTENSION_POINTS: typeof getActiveExtensionPoints;
    ENSURE_EXTENSION_POINTS_INSTALLED: typeof ensureInstalled;
    CHECK_AVAILABLE: typeof checkAvailable;
    HANDLE_NAVIGATE: typeof handleNavigate;
    RUN_BRICK: typeof runBrick;
    CANCEL_SELECT_ELEMENT: typeof cancelSelect;
    SELECT_ELEMENT: typeof selectElement;

    RUN_RENDERER_PIPELINE: typeof runRendererPipeline;
    RUN_HEADLESS_PIPELINE: typeof runHeadlessPipeline;
    RUN_MAP_ARGS: typeof runMapArgs;

    NOTIFY_INFO: typeof notify.info;
    NOTIFY_ERROR: typeof notify.error;
    NOTIFY_SUCCESS: typeof notify.success;

    GET_PAGE_STATE: typeof getPageState;
    SET_PAGE_STATE: typeof setPageState;

    GET_COPILOT_HOST_DATA: typeof getCopilotHostData;

    RELOAD_MARKETPLACE_ENHANCEMENTS: typeof reloadActivationEnhancements;
  }
}

export default function registerMessenger(): void {
  registerMethods({
    FORM_GET_DEFINITION: getFormDefinition,
    FORM_RESOLVE: resolveForm,
    FORM_CANCEL: cancelForm,

    WALKTHROUGH_MODAL_CLOSE: closeWalkthroughModal,
    WALKTHROUGH_MODAL_SHOW: showWalkthroughModal,

    TEMPORARY_PANEL_CLOSE: stopWaitingForTemporaryPanels,
    TEMPORARY_PANEL_CANCEL: cancelTemporaryPanels,
    TEMPORARY_PANEL_RESOLVE: resolveTemporaryPanel,
    PANEL_GET_DEFINITION: getPanelDefinition,

    QUEUE_REACTIVATE_TAB: queueReactivateTab,
    REACTIVATE_TAB: reactivateTab,
    REMOVE_INSTALLED_EXTENSION: removePersistedExtension,
    GET_RESERVED_SIDEBAR_ENTRIES: getReservedPanelEntries,
    RESET_TAB: resetTab,
    NAVIGATE_TAB: navigateTab,

    TOGGLE_QUICK_BAR: toggleQuickBar,
    HANDLE_MENU_ACTION: handleMenuAction,
    REHYDRATE_SIDEBAR: rehydrateSidebar,
    SHOW_SIDEBAR: showSidebar,
    HIDE_SIDEBAR: hideSidebar,
    RELOAD_SIDEBAR: reloadSidebar,
    REMOVE_SIDEBARS: removeSidebars,

    INSERT_PANEL: insertPanel,
    INSERT_BUTTON: insertButton,

    UIPATH_INIT: initRobot,
    UIPATH_GET_PROCESSES: getProcesses,

    GET_ATTRIBUTE_EXAMPLES: getAttributeExamples,
    RUN_SINGLE_BLOCK: runBlockPreview,
    RUN_RENDERER_BLOCK: runRendererBlock,

    CLEAR_DYNAMIC_ELEMENTS: clearDynamicElements,
    UPDATE_DYNAMIC_ELEMENT: updateDynamicElement,
    RUN_EXTENSION_POINT_READER: runExtensionPointReader,
    ENABLE_OVERLAY: enableOverlay,
    DISABLE_OVERLAY: disableOverlay,
    INSTALLED_EXTENSION_POINTS: getActiveExtensionPoints,
    ENSURE_EXTENSION_POINTS_INSTALLED: ensureInstalled,
    CHECK_AVAILABLE: checkAvailable,
    HANDLE_NAVIGATE: handleNavigate,

    RUN_BRICK: runBrick,
    CANCEL_SELECT_ELEMENT: cancelSelect,
    SELECT_ELEMENT: selectElement,

    RUN_RENDERER_PIPELINE: runRendererPipeline,
    RUN_HEADLESS_PIPELINE: runHeadlessPipeline,
    RUN_MAP_ARGS: runMapArgs,

    NOTIFY_INFO: notify.info,
    NOTIFY_ERROR: notify.error,
    NOTIFY_SUCCESS: notify.success,

    GET_PAGE_STATE: getPageState,
    SET_PAGE_STATE: setPageState,

    GET_COPILOT_HOST_DATA: getCopilotHostData,

    RELOAD_MARKETPLACE_ENHANCEMENTS: reloadActivationEnhancements,
  });
}
