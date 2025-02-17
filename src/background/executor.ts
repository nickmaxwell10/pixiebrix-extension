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

import { type Tabs } from "webextension-polyfill";
import { expectContext } from "@/utils/expectContext";
import {
  errorTabDoesntExist,
  errorTargetClosedEarly,
  type MessengerMeta,
} from "webext-messenger";
import { runBrick } from "@/contentScript/messenger/api";
import { type Target } from "@/types/messengerTypes";
import pDefer from "p-defer";
import { getErrorMessage } from "@/errors/errorHelpers";
import type { RunBrickRequest } from "@/contentScript/messenger/runBrickTypes";
import { BusinessError } from "@/errors/businessErrors";
import { canAccessTab } from "@/permissions/permissionsUtils";
import { SessionMap } from "@/mv3/SessionStorage";
import { groupPromisesByStatus } from "@/utils/promiseUtils";
import { TOP_LEVEL_FRAME_ID } from "@/domConstants";
import { forEachTab } from "@/utils/extensionUtils";
import reportEvent from "@/telemetry/reportEvent";
import { Events } from "@/telemetry/events";

type TabId = number;

// Arbitrary number of tabs above which performance *might* be degraded
const LARGE_AMOUNT_OF_TABS = 20;

// TODO: One tab could have multiple targets, but `tabToTarget` currently only supports one at a time
const tabToTarget = new SessionMap<TabId>("tabToTarget", import.meta.url);

// We shouldn't need to store this value, but Chrome loses it often
// https://bugs.chromium.org/p/chromium/issues/detail?id=967150
const tabToOpener = new SessionMap<TabId>("tabToOpener", import.meta.url);

function rememberOpener(newTabId: TabId, openerTabId: TabId): void {
  // FIXME: include frame information in tabToTarget
  void tabToTarget.set(String(openerTabId), newTabId);
  void tabToOpener.set(String(newTabId), openerTabId);
}

async function safelyRunBrick(
  { tabId, frameId }: Target,
  request: RunBrickRequest,
): Promise<unknown> {
  try {
    return await runBrick({ tabId, frameId }, request);
  } catch (error) {
    const errorMessage = getErrorMessage(error);

    // Re-package tab-lifecycle-related errors as BusinessErrors
    if ([errorTargetClosedEarly, errorTabDoesntExist].includes(errorMessage)) {
      throw new BusinessError(errorMessage);
    }

    // This must follow the tab existence checks or else it returns false even if the tab simply doesn't exist
    if (!(await canAccessTab(tabId))) {
      throw new BusinessError("PixieBrix doesn't have access to the tab");
    }

    throw error;
  }
}

export async function waitForTargetByUrl(url: string): Promise<Target> {
  const { promise, resolve } = pDefer<Target>();

  // This uses RE2, which is a regex-like syntax
  const urlMatches = url.replaceAll("?", "\\?");
  function wait({ tabId, frameId }: Target): void {
    resolve({ tabId, frameId });
    browser.webNavigation.onCommitted.removeListener(wait);
  }

  browser.webNavigation.onCommitted.addListener(wait, {
    url: [{ urlMatches }],
  });
  return promise;
}

/**
 * Run a brick in the window that opened the source window
 */
export async function requestRunInOpener(
  this: MessengerMeta,
  request: RunBrickRequest,
): Promise<unknown> {
  let { id: sourceTabId, openerTabId } = this.trace[0].tab;

  // Chrome may have lost this data in the meanwhile
  // https://bugs.chromium.org/p/chromium/issues/detail?id=967150
  openerTabId ??= await tabToOpener.get(String(sourceTabId));

  if (openerTabId == null) {
    throw new BusinessError("Sender tab has no opener");
  }

  const opener = {
    tabId: openerTabId,
    frameId: TOP_LEVEL_FRAME_ID,
  };
  const subRequest = { ...request, sourceTabId };
  return safelyRunBrick(opener, subRequest);
}

/**
 * Run a brick in the last window that was opened from the source window
 * @see openTab
 */
export async function requestRunInTarget(
  this: MessengerMeta,
  request: RunBrickRequest,
): Promise<unknown> {
  const sourceTabId = this.trace[0].tab.id;
  const target = await tabToTarget.get(String(sourceTabId));

  if (!target) {
    throw new BusinessError("Sender tab has no target");
  }

  const subRequest = { ...request, sourceTabId };
  return safelyRunBrick(
    { tabId: target, frameId: TOP_LEVEL_FRAME_ID },
    subRequest,
  );
}

/**
 * Run a brick in the topmost frame of the window/tab
 */
export async function requestRunInTop(
  this: MessengerMeta,
  request: RunBrickRequest,
): Promise<unknown> {
  const sourceTabId = this.trace[0].tab.id;

  const subRequest = { ...request, sourceTabId };
  return safelyRunBrick(
    { tabId: sourceTabId, frameId: TOP_LEVEL_FRAME_ID },
    subRequest,
  );
}

/**
 * Run a brick in the top-level frame of all OTHER tabs.
 * @param request the run request
 */
export async function requestRunInOtherTabs(
  this: MessengerMeta,
  request: RunBrickRequest,
): Promise<unknown[]> {
  const sourceTabId = this.trace[0].tab.id;
  const subRequest = { ...request, sourceTabId };

  const results = await forEachTab(
    async ({ tabId }) =>
      safelyRunBrick({ tabId, frameId: TOP_LEVEL_FRAME_ID }, subRequest),
    {
      exclude: sourceTabId,
    },
  );

  if (results.length > LARGE_AMOUNT_OF_TABS) {
    reportEvent(Events.PERFORMANCE_MESSENGER_MANY_TABS_BROADCAST, {
      tabCount: results.length,
    });
  }

  const { rejected, fulfilled } = groupPromisesByStatus(results);

  if (rejected.length > 0) {
    console.warn(`Broadcast rejected for ${rejected.length} tabs`, {
      rejected,
    });
  }

  return fulfilled;
}

export async function requestRunInAllFrames(
  this: MessengerMeta,
  request: RunBrickRequest,
): Promise<unknown[]> {
  const sourceTabId = this.trace[0].tab.id;
  const subRequest = { ...request, sourceTabId };

  const frames = await browser.webNavigation.getAllFrames({
    tabId: sourceTabId,
  });

  const results = await Promise.allSettled(
    frames.map(async ({ frameId }) =>
      safelyRunBrick({ tabId: sourceTabId, frameId }, subRequest),
    ),
  );

  const { rejected, fulfilled } = groupPromisesByStatus(results);

  if (rejected.length > 0) {
    console.warn(`Broadcast rejected for ${rejected.length} frame`, {
      rejected,
    });
  }

  return fulfilled;
}

export async function openTab(
  this: MessengerMeta,
  createProperties: Tabs.CreateCreatePropertiesType,
): Promise<void> {
  // Natively links the new tab to its opener + opens it right next to it
  const openerTabId = this.trace[0].tab?.id;
  const newTab = await browser.tabs.create({
    ...createProperties,
    openerTabId,
  });
  rememberOpener(newTab.id, openerTabId);
}

async function linkTabListener({ id, openerTabId }: Tabs.Tab): Promise<void> {
  // `openerTabId` may be missing when created via `tabs.create()`
  if (openerTabId) {
    rememberOpener(id, openerTabId);
  }
}

function initExecutor(): void {
  expectContext("background");

  browser.tabs.onCreated.addListener(linkTabListener);
}

export async function activateTab(this: MessengerMeta): Promise<void> {
  await browser.tabs.update(this.trace[0].tab.id, {
    active: true,
  });
}

export async function closeTab(this: MessengerMeta): Promise<void> {
  // Allow `closeTab` to return before closing the tab or else the Messenger won't be able to respond #2051
  setTimeout(async () => browser.tabs.remove(this.trace[0].tab.id), 100);
}

export default initExecutor;
