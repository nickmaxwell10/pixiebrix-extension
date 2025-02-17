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
import { useAuthOptions } from "@/hooks/auth";
import { type IntegrationDefinition } from "@/integrations/integrationTypes";
import { type AuthOption } from "@/auth/authTypes";
import { valueToAsyncState } from "@/utils/asyncStateUtils";
import { appApiMock } from "@/testUtils/appApiMock";
import { validateRegistryId } from "@/types/helpers";
import { render } from "@/extensionConsole/testHelpers";
import IntegrationsBody from "@/extensionConsole/pages/activateMod/IntegrationsBody";
import { defaultModDefinitionFactory } from "@/testUtils/factories/modDefinitionFactories";
import { autoUUIDSequence } from "@/testUtils/factories/stringFactories";
import { waitForEffect } from "@/testUtils/testHelpers";
import { act, screen } from "@testing-library/react";
import selectEvent from "react-select-event";
import { integrationDependencyFactory } from "@/testUtils/factories/integrationFactories";
import getModDefinitionIntegrationIds from "@/integrations/util/getModDefinitionIntegrationIds";

jest.mock("@/hooks/auth", () => ({
  useAuthOptions: jest.fn(),
}));

const useAuthOptionsMock = jest.mocked(useAuthOptions);

jest.mock("@/integrations/util/getModDefinitionIntegrationIds", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const getIntegrationIdsMock = jest.mocked(getModDefinitionIntegrationIds);

const integrationId1 = validateRegistryId("test/integration1");
const integrationId2 = validateRegistryId("test/integration2");

const emptyAuthOptions: AuthOption[] = [];
const sharedOption1a: AuthOption = {
  label: "Shared Option 1a",
  local: false,
  serviceId: integrationId1,
  sharingType: "shared",
  value: autoUUIDSequence(),
};
const sharedOption1b: AuthOption = {
  label: "Shared Option 1b",
  local: false,
  serviceId: integrationId1,
  sharingType: "shared",
  value: autoUUIDSequence(),
};
const sharedOption2a: AuthOption = {
  label: "Shared Option 2a",
  local: false,
  serviceId: integrationId2,
  sharingType: "shared",
  value: autoUUIDSequence(),
};
const sharedOption2b: AuthOption = {
  label: "Shared Option 2b",
  local: false,
  serviceId: integrationId2,
  sharingType: "shared",
  value: autoUUIDSequence(),
};
const builtInOption1a: AuthOption = {
  label: "Built-in Option 1a",
  local: false,
  serviceId: integrationId1,
  sharingType: "built-in",
  value: autoUUIDSequence(),
};
const builtInOption1b: AuthOption = {
  label: "Built-in Option 1b",
  local: false,
  serviceId: integrationId1,
  sharingType: "built-in",
  value: autoUUIDSequence(),
};

const service1 = {
  metadata: {
    id: integrationId1,
    name: "Test Integration 1",
  },
} as IntegrationDefinition;
const service2 = {
  metadata: {
    id: integrationId2,
    name: "Test Integration 2",
  },
} as IntegrationDefinition;

beforeAll(() => {
  // These are only used for the service names in the descriptors
  appApiMock.onGet("/api/services/").reply(200, [service1, service2]);
});

function expectServiceDescriptorVisible(service: IntegrationDefinition) {
  expect(screen.getByText(service.metadata.name)).toBeVisible();
  expect(screen.getByText(service.metadata.id)).toBeVisible();
}

function expectRefreshButton(count?: number) {
  if (count) {
    expect(screen.getAllByRole("button", { name: /refresh/i })).toHaveLength(
      count,
    );
  } else {
    expect(screen.getByRole("button", { name: /refresh/i })).toBeVisible();
  }
}

describe("ServicesBody", () => {
  it("renders with one service and no options and does not render title", async () => {
    useAuthOptionsMock.mockReturnValue(valueToAsyncState(emptyAuthOptions));
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(<IntegrationsBody mod={defaultModDefinitionFactory()} />, {
      initialValues: {
        integrationDependencies: [
          integrationDependencyFactory({ integrationId: integrationId1 }),
        ],
      },
    });
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Check that "configure" button is also shown when there are no options
    expect(screen.getByRole("button", { name: /configure/i })).toBeVisible();
    // Ensure Integrations title is not shown
    expect(screen.queryByText(/integrations/i)).not.toBeInTheDocument();
  });

  it("renders own title properly", async () => {
    useAuthOptionsMock.mockReturnValue(valueToAsyncState(emptyAuthOptions));
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody mod={defaultModDefinitionFactory()} showOwnTitle />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({ integrationId: integrationId1 }),
          ],
        },
      },
    );
    await waitForEffect();
    // Ensure Integrations title is shown
    expect(screen.getByRole("heading", { name: "Integrations" })).toBeVisible();
  });

  it("does not hide field with one service, no options for the service, but other options exist", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([sharedOption2a, sharedOption2b]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({ integrationId: integrationId1 }),
          ],
        },
      },
    );
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Check that "configure" button is also shown when there are no options
    expect(screen.getByRole("button", { name: /configure/i })).toBeVisible();
  });

  it("renders with one service and two auth options", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([sharedOption1a, sharedOption1b]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(<IntegrationsBody mod={defaultModDefinitionFactory()} />, {
      initialValues: {
        integrationDependencies: [
          integrationDependencyFactory({
            integrationId: integrationId1,
            configId: sharedOption1a.value,
          }),
        ],
      },
    });
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Expect the first option to be selected
    expect(screen.getByText(sharedOption1a.label)).toBeVisible();
  });

  it("can change option with one service and two auth options", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([sharedOption1a, sharedOption1b]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(<IntegrationsBody mod={defaultModDefinitionFactory()} />, {
      initialValues: {
        integrationDependencies: [
          integrationDependencyFactory({
            integrationId: integrationId1,
            configId: sharedOption1a.value,
          }),
        ],
      },
    });
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Expect the first option to be selected
    expect(screen.getByText(sharedOption1a.label)).toBeVisible();

    // Select the second option
    const selectInput = screen.getByRole("combobox");
    await act(async () => {
      await selectEvent.select(selectInput, sharedOption1b.label);
    });
    expect(screen.getByText(sharedOption1b.label)).toBeVisible();
  });

  it("renders with two services and two auth options each", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([
        sharedOption1a,
        sharedOption1b,
        sharedOption2a,
        sharedOption2b,
      ]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1, integrationId2]);
    render(<IntegrationsBody mod={defaultModDefinitionFactory()} />, {
      initialValues: {
        integrationDependencies: [
          integrationDependencyFactory({
            integrationId: integrationId1,
            configId: sharedOption1a.value,
          }),
          integrationDependencyFactory({
            integrationId: integrationId2,
            configId: sharedOption2a.value,
          }),
        ],
      },
    });
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectServiceDescriptorVisible(service2);
    // Each widget will have a refresh button
    expectRefreshButton(2);
    // Expect the first option to be selected for each service
    expect(screen.getByText(sharedOption1a.label)).toBeVisible();
    expect(screen.getByText(sharedOption2a.label)).toBeVisible();
  });

  it("hides one field and label when one built-in option", async () => {
    useAuthOptionsMock.mockReturnValue(valueToAsyncState([builtInOption1a]));
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: builtInOption1a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    // Expect no service descriptor to be shown
    expect(screen.queryByText(service1.metadata.name)).not.toBeInTheDocument();
    expect(screen.queryByText(service1.metadata.id)).not.toBeInTheDocument();
    // Expect no combobox input
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // Expect no refresh button
    expect(
      screen.queryByRole("button", { name: /refresh/i }),
    ).not.toBeInTheDocument();
  });

  it("hides one field when two built-in options", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([builtInOption1a, builtInOption1b]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: builtInOption1a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    // Expect no service descriptor to be shown
    expect(screen.queryByText(service1.metadata.name)).not.toBeInTheDocument();
    expect(screen.queryByText(service1.metadata.id)).not.toBeInTheDocument();
    // Expect no combobox input
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    // Expect no refresh button
    expect(
      screen.queryByRole("button", { name: /refresh/i }),
    ).not.toBeInTheDocument();
  });

  it("shows one field when one built-in option and one shared", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([builtInOption1a, sharedOption1a]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: builtInOption1a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Expect the first option to be selected
    expect(screen.getByText(builtInOption1a.label)).toBeVisible();
  });

  it("does not hide field after switching to built-in option when one built-in option and one shared", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([builtInOption1a, sharedOption1a]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: sharedOption1a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Expect the shared option to be selected
    expect(screen.getByText(sharedOption1a.label)).toBeVisible();

    // Select the built-in option
    const selectInput = screen.getByRole("combobox");
    await act(async () => {
      await selectEvent.select(selectInput, builtInOption1a.label);
    });
    // Expect widget elements still visible
    expectServiceDescriptorVisible(service1);
    expectRefreshButton();
    // Expect built-in option selected
    expect(screen.getByText(builtInOption1a.label)).toBeVisible();
  });

  it("hides one of two fields when one built-in option", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([builtInOption1a, sharedOption2a, sharedOption2b]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1, integrationId2]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: builtInOption1a.value,
            }),
            integrationDependencyFactory({
              integrationId: integrationId2,
              configId: sharedOption2a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    // Expect only field 2 visible
    expect(screen.queryByText(service1.metadata.name)).not.toBeInTheDocument();
    expectServiceDescriptorVisible(service2);
    expectRefreshButton();
    // Expect the first option to be selected for service 2
    expect(screen.getByText(sharedOption2a.label)).toBeVisible();
  });

  it("hides one of two fields when two built-in options", async () => {
    useAuthOptionsMock.mockReturnValue(
      valueToAsyncState([
        builtInOption1a,
        builtInOption1b,
        sharedOption2a,
        sharedOption2b,
      ]),
    );
    getIntegrationIdsMock.mockReturnValue([integrationId1, integrationId2]);
    render(
      <IntegrationsBody
        mod={defaultModDefinitionFactory()}
        hideBuiltInIntegrations
      />,
      {
        initialValues: {
          integrationDependencies: [
            integrationDependencyFactory({
              integrationId: integrationId1,
              configId: builtInOption1a.value,
            }),
            integrationDependencyFactory({
              integrationId: integrationId2,
              configId: sharedOption2a.value,
            }),
          ],
        },
      },
    );
    await waitForEffect();
    // Expect only field 2 visible
    expect(screen.queryByText(service1.metadata.name)).not.toBeInTheDocument();
    expectServiceDescriptorVisible(service2);
    expectRefreshButton();
    // Expect the first option to be selected for service 2
    expect(screen.getByText(sharedOption2a.label)).toBeVisible();
  });
});
