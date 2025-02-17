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
import { Card, Table } from "react-bootstrap";
import { round } from "lodash";
import {
  count as registrySize,
  recreateDB as recreateBrickDB,
} from "@/registry/packageRegistry";
import {
  clearLogs,
  count as logSize,
  recreateDB as recreateLogDB,
} from "@/telemetry/logging";
import {
  clear as clearEvents,
  count as eventsSize,
  recreateDB as recreateEventDB,
} from "@/background/telemetry";
import AsyncButton from "@/components/AsyncButton";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBroom, faDatabase } from "@fortawesome/free-solid-svg-icons";
import useUserAction from "@/hooks/useUserAction";
import {
  clearTraces,
  count as traceSize,
  recreateDB as recreateTraceDB,
} from "@/telemetry/trace";
import AsyncStateGate, { StandardError } from "@/components/AsyncStateGate";
import cx from "classnames";
import styles from "@/extensionConsole/pages/settings/SettingsCard.module.scss";
import { type StorageEstimate } from "@/types/browserTypes";
import useAsyncState from "@/hooks/useAsyncState";

/**
 * React component to display local storage usage (to help identify storage problems)
 * @constructor
 */
const StorageSettings: React.FunctionComponent = () => {
  const state = useAsyncState(
    async () => ({
      storageEstimate: (await navigator.storage.estimate()) as StorageEstimate,
      brickCount: await registrySize(),
      logCount: await logSize(),
      traceCount: await traceSize(),
      eventCount: await eventsSize(),
    }),
    [],
  );

  const recalculate = state.refetch;

  const clearLogsAction = useUserAction(
    async () => {
      await Promise.all([clearLogs(), clearTraces(), clearEvents()]);
      recalculate();
    },
    {
      successMessage: "Reclaimed local space",
      errorMessage: "Error reclaiming local space",
    },
    [recalculate],
  );

  const recoverStorageAction = useUserAction(
    async () => {
      await Promise.all([
        recreateLogDB(),
        recreateTraceDB(),
        recreateBrickDB(),
        recreateEventDB(),
      ]);

      recalculate();
    },
    {
      successMessage: "Recreated local databases",
      errorMessage: "Error recreating local databases",
    },
    [recalculate],
  );

  return (
    <Card>
      <Card.Header>Extension Storage Statistics</Card.Header>
      <Card.Body
        className={
          // Make table flush with card body borders
          cx({ "p-0": state.isSuccess })
        }
      >
        <AsyncStateGate
          state={state}
          renderError={(props) => <StandardError {...props} />}
        >
          {({
            data: {
              storageEstimate,
              brickCount,
              logCount,
              traceCount,
              eventCount,
            },
          }) => (
            <Table>
              <tbody>
                <tr>
                  <td>Usage (MB)</td>
                  <td>
                    {round(storageEstimate.usage / 1e6, 1).toLocaleString()} /{" "}
                    {round(storageEstimate.quota / 1e6, 0).toLocaleString()}
                  </td>
                </tr>
                {Object.entries(storageEstimate.usageDetails ?? {}).map(
                  ([key, value]) => (
                    <tr key={key}>
                      <td>{key} (MB)</td>
                      <td>{round(value / 1e6, 1)}</td>
                    </tr>
                  ),
                )}
                <tr>
                  <td># Brick Versions</td>
                  <td>{brickCount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td># Log Records</td>
                  <td>{logCount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td># Trace Records</td>
                  <td>{traceCount.toLocaleString()}</td>
                </tr>
                <tr>
                  <td># Buffered Events</td>
                  <td>{eventCount.toLocaleString()}</td>
                </tr>
              </tbody>
            </Table>
          )}
        </AsyncStateGate>
      </Card.Body>
      <Card.Footer className={styles.cardFooter}>
        <AsyncButton variant="info" onClick={clearLogsAction}>
          <FontAwesomeIcon icon={faBroom} /> Reclaim Local Space
        </AsyncButton>

        <AsyncButton variant="warning" onClick={recoverStorageAction}>
          <FontAwesomeIcon icon={faDatabase} /> Recover Databases
        </AsyncButton>
      </Card.Footer>
    </Card>
  );
};

export default StorageSettings;
