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

import Rollbar from "rollbar";
import { isContentScript } from "webext-detect-page";
import { addListener as addAuthListener, readAuthData } from "@/auth/token";
import { type UserData } from "@/auth/authTypes";
import { getUID } from "@/background/messenger/api";
import pMemoize from "p-memoize";

const accessToken = process.env.ROLLBAR_BROWSER_ACCESS_TOKEN;

type Frame = {
  filename: string;
};

type Payload = {
  body: {
    trace: {
      frames: Frame[];
    };
  };
};

/**
 * The PixieBrix Person model for Rollbar.
 */
type Person = {
  id: string;
  organizationId: string;
  email?: string;
};

/**
 *  @see https://docs.rollbar.com/docs/javascript
 *  @see https://docs.rollbar.com/docs/rollbarjs-configuration-reference
 */
async function initRollbar(): Promise<Rollbar> {
  // `async` to fetch person information from localStorage

  if (isContentScript()) {
    // The contentScript cannot not make requests directly to Rollbar because the site's CSP might not support it
    console.warn("Unsupported call to initRollbar in the contentScript");
  }

  if (accessToken) {
    console.debug("Initializing Rollbar error telemetry");
  } else {
    console.debug("Rollbar token missing, errors won’t be reported");
  }

  try {
    addAuthListener(updatePerson);

    // NOTE: we are excluding captureUncaught and captureUnhandledRejections because we set our own handlers for that in
    // reportUncaughtErrors. The default for rollbar is false
    // https://docs.rollbar.com/docs/rollbarjs-configuration-reference#:~:text=captureEmail-,captureUncaught,-This%20determines%20whether

    // NOTE: we aren't passing ignoredMessages, because we are applying our own filtering in reportUncaughtErrors and
    // reportError
    // https://docs.rollbar.com/docs/reduce-noisy-javascript-errors#ignore-certain-types-of-messages
    //
    // @since 1.7.40 - We need to hard-filter out the ResizeObserver loop errors because they are flooding Rollbar

    return Rollbar.init({
      enabled: accessToken && accessToken !== "undefined" && !isContentScript(),
      accessToken,
      captureIp: "anonymize",
      codeVersion: process.env.SOURCE_VERSION,
      // https://docs.rollbar.com/docs/rollbarjs-telemetry
      // disable autoInstrument until we can set up scrubbing rules
      autoInstrument: false,
      payload: {
        client: {
          javascript: {
            code_version: process.env.SOURCE_VERSION,
            source_map_enabled: true,
          },
        },
        environment: process.env.ENVIRONMENT,
        person: await personFactory(await readAuthData()),
      },
      transform(payload: Payload) {
        // Standardize the origin across browsers so that they match the source map we uploaded to rollbar
        // https://docs.rollbar.com/docs/source-maps#section-using-source-maps-on-many-domains
        for (const frame of payload.body.trace?.frames ?? []) {
          if (frame.filename && !frame.filename.startsWith("http")) {
            frame.filename = frame.filename.replace(
              // Include the slash because location.origin does not have a trailing slash but the ENV does
              location.origin + "/",
              process.env.ROLLBAR_PUBLIC_PATH,
            );
          }
        }
      },
      ignoredMessages: [/ResizeObserver loop/],
    });
  } catch (error) {
    console.error("Error during Rollbar init", { error });
  }
}

async function personFactory(data: Partial<UserData>): Promise<Person> {
  const browserId = await getUID();

  const { user, email, telemetryOrganizationId, organizationId } = data;

  const errorOrganizationId = telemetryOrganizationId ?? organizationId;

  return errorOrganizationId
    ? {
        id: user,
        email,
        organizationId: errorOrganizationId,
      }
    : {
        id: browserId,
        organizationId: null,
      };
}

// OK to memoize. The addAuthListener will modify the Rollbar instance in place
// As of pMemoize 7.0.0, pMemoize does not cache rejections by default
// https://github-redirect.dependabot.com/sindresorhus/p-memoize/pull/48
export const getRollbar = pMemoize(initRollbar);

async function updatePerson(data: Partial<UserData>): Promise<void> {
  const rollbar = await getRollbar();
  if (rollbar) {
    const person = await personFactory(data);
    console.debug("Setting Rollbar Person", person);
    rollbar.configure({
      payload: { person },
    });
  }
}
