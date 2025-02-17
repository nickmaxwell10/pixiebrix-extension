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

import React, { useCallback } from "react";
import { type BlockOptionProps } from "@/components/fields/schemaFields/genericOptionsFactory";
import { partial } from "lodash";
import { UIPATH_PROPERTIES } from "@/contrib/uipath/process";
import { useField } from "formik";
import { performConfiguredRequestInBackground } from "@/background/messenger/api";
import ChildObjectField from "@/components/fields/schemaFields/ChildObjectField";
import { type Option } from "@/components/form/widgets/SelectWidget";
import { type ODataResponseData, type Robot } from "./uipathContract";
import SchemaField from "@/components/fields/schemaFields/SchemaField";
import ConnectedFieldTemplate from "@/components/form/ConnectedFieldTemplate";
import RemoteSelectWidget from "@/components/form/widgets/RemoteSelectWidget";
import RequireIntegrationConfig from "@/integrations/components/RequireIntegrationConfig";
import RemoteMultiSelectWidget from "@/components/form/widgets/RemoteMultiSelectWidget";
import { useSelectedRelease } from "@/contrib/uipath/uipathHooks";
import cachePromise from "@/utils/cachePromise";
import WorkshopMessage from "@/components/fields/schemaFields/WorkshopMessage";
import { type SanitizedIntegrationConfig } from "@/integrations/integrationTypes";
import { type Expression } from "@/types/runtimeTypes";
import { type Schema } from "@/types/schemaTypes";
import { isExpression } from "@/utils/expressionUtils";
import { joinName } from "@/utils/formUtils";
import useAsyncEffect from "use-async-effect";

async function fetchRobots(
  config: SanitizedIntegrationConfig,
): Promise<Array<Option<number>>> {
  const response = await performConfiguredRequestInBackground<
    ODataResponseData<Robot>
  >(config, {
    url: "/odata/Robots",
    method: "get",
  });
  const robots = response.data.value;
  return (robots ?? []).map((x) => ({ value: x.Id, label: String(x.Name) }));
}

const ProcessOptions: React.FunctionComponent<BlockOptionProps> = ({
  name,
  configKey,
}) => {
  const basePath = joinName(name, configKey);
  const configName = partial(joinName, basePath);

  const [{ value: strategy }, , strategyHelpers] = useField<string>(
    configName("strategy"),
  );

  const [{ value: jobsCount }, , jobsCountHelpers] = useField<number>(
    configName("jobsCount"),
  );

  const [{ value: releaseKey }] = useField<string | Expression>(
    configName("releaseKey"),
  );

  const [{ value: awaitResult }] = useField<boolean | null>(
    configName("awaitResult"),
  );

  const { selectedRelease, releasesPromise } = useSelectedRelease(
    configName("releaseKey"),
  );

  useAsyncEffect(async () => {
    if (strategy === "JobsCount" && jobsCount == null) {
      await jobsCountHelpers.setValue(1);
    }
  }, [strategy, jobsCount, jobsCountHelpers, strategyHelpers]);

  const robotOptionsFactory = useCallback(
    async (config: SanitizedIntegrationConfig) => {
      if (config == null) {
        return [];
      }

      return cachePromise(["uipath:fetchRobots", config], async () =>
        fetchRobots(config),
      );
    },
    [],
  );

  return isExpression(releaseKey) ? (
    <WorkshopMessage />
  ) : (
    <RequireIntegrationConfig
      integrationsSchema={UIPATH_PROPERTIES.uipath as Schema}
      integrationsFieldName={configName("uipath")}
    >
      {({ sanitizedConfig }) => (
        <>
          <ConnectedFieldTemplate
            label="Release"
            name={configName("releaseKey")}
            description="The UiPath release/process"
            as={RemoteSelectWidget}
            blankValue={null}
            optionsFactory={releasesPromise}
          />
          <SchemaField
            label="Strategy"
            name={configName("strategy")}
            schema={UIPATH_PROPERTIES.strategy as Schema}
            isRequired
          />
          {strategy === "Specific" && (
            <ConnectedFieldTemplate
              label="Robots"
              name={configName("releaseKey")}
              description="One or more robots"
              as={RemoteMultiSelectWidget}
              optionsFactory={robotOptionsFactory}
              blankValue={[]}
              config={sanitizedConfig}
            />
          )}
          {strategy === "JobsCount" && (
            <SchemaField
              label="Jobs Count"
              name={configName("jobsCount")}
              schema={UIPATH_PROPERTIES.jobsCount as Schema}
              isRequired
            />
          )}

          <SchemaField
            label="Await Result"
            name={configName("awaitResult")}
            schema={UIPATH_PROPERTIES.awaitResult as Schema}
            isRequired
          />

          {awaitResult && (
            <SchemaField
              label="Result Timeout (Milliseconds)"
              name={configName("maxWaitMillis")}
              schema={UIPATH_PROPERTIES.maxWaitMillis as Schema}
            />
          )}

          <ChildObjectField
            heading={selectedRelease?.release?.Name ?? "Input Arguments"}
            schema={selectedRelease?.schema}
            name={configName("inputArguments")}
          />
        </>
      )}
    </RequireIntegrationConfig>
  );
};

export default ProcessOptions;
