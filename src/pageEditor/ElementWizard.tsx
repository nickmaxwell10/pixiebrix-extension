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

import styles from "./ElementWizard.module.scss";

import React, { useState } from "react";
import { useFormikContext } from "formik";
// eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
import { Form as BootstrapForm, Nav, Tab } from "react-bootstrap";
import { actions } from "@/pageEditor/slices/editorSlice";
import ReloadToolbar from "@/pageEditor/toolbar/ReloadToolbar";
import { type WizardStep } from "@/pageEditor/starterBricks/base";
import PermissionsToolbar from "@/pageEditor/toolbar/PermissionsToolbar";
import LogsTab, { LOGS_EVENT_KEY } from "@/pageEditor/tabs/logs/LogsTab";
import EditTab from "@/pageEditor/tabs/editTab/EditTab";
import { useDispatch, useSelector } from "react-redux";
import { produce } from "immer";
import { useAsyncEffect } from "use-async-effect";
import { upgradePipelineToV3 } from "@/pageEditor/starterBricks/upgrade";
import cx from "classnames";
import LogNavItemBadge from "./tabs/logs/NavItemBadge";
import { logActions } from "@/components/logViewer/logSlice";
import { type ModComponentFormState } from "@/pageEditor/starterBricks/formStateTypes";
import { FormErrorContext } from "@/components/form/FormErrorContext";
import { selectVariablePopoverVisible } from "@/pageEditor/slices/editorSelectors";

const EDIT_STEP_NAME = "Edit";
const LOG_STEP_NAME = "Logs";

const wizard: WizardStep[] = [
  { step: EDIT_STEP_NAME, Component: EditTab },
  { step: LOG_STEP_NAME, Component: LogsTab },
];

const WizardNavItem: React.FunctionComponent<{
  step: WizardStep;
}> = ({ step }) => (
  <Nav.Item className="d-flex align-items-stretch">
    <Nav.Link className="d-flex align-items-center" eventKey={step.step}>
      {step.step}
      {step.step === LOG_STEP_NAME && <LogNavItemBadge />}
    </Nav.Link>
  </Nav.Item>
);

/**
 * @deprecated This will soon be split into a new business-logic component, decoupled with the layout, using EditTabLayout
 * @see EditorTabLayout
 * @see RecipePane
 */
const ElementWizard: React.FunctionComponent<{
  element: ModComponentFormState;
}> = ({ element }) => {
  const [step, setStep] = useState(wizard[0].step);

  const isVariablePopoverVisible = useSelector(selectVariablePopoverVisible);

  const { isValid, status, handleReset } =
    useFormikContext<ModComponentFormState>();

  const dispatch = useDispatch();

  const refreshEntries = () => {
    dispatch(logActions.refreshEntries());
  };

  const selectTabHandler = (step: string) => {
    setStep(step);
    if (step.toLowerCase() === LOGS_EVENT_KEY.toLowerCase()) {
      // If user is clicking over to the logs tab, they most likely want to see the most recent logs
      refreshEntries();
    }
  };

  const { values: formState, setValues: setFormState } =
    useFormikContext<ModComponentFormState>();

  const wizardSteps = [...wizard];

  useAsyncEffect(async (isMounted) => {
    if (formState.apiVersion === "v2") {
      const newState = await produce(formState, async (draft) => {
        draft.extension.blockPipeline = await upgradePipelineToV3(
          draft.extension.blockPipeline,
        );
        draft.apiVersion = "v3";
      });
      if (!isMounted()) {
        return;
      }

      await setFormState(newState);
      dispatch(actions.showV3UpgradeMessage());
    }
  }, []);

  return (
    <Tab.Container activeKey={step} key={element.uuid}>
      <FormErrorContext.Provider
        value={{
          shouldUseAnalysis: true,
          showUntouchedErrors: false,
          showFieldActions: true,
          // Hide variable/template annotations while the popover is open because the user is editing the field
          ignoreAnalysisIds: isVariablePopoverVisible
            ? ["var", "template"]
            : [],
        }}
      >
        <BootstrapForm
          autoComplete="off"
          noValidate
          onReset={handleReset}
          className={cx(styles.form, "full-height")}
        >
          <Nav
            variant="pills"
            activeKey={step}
            onSelect={selectTabHandler}
            className={styles.nav}
          >
            {wizardSteps.map((step) => (
              <WizardNavItem key={step.step} step={step} />
            ))}

            {/* spacer */}
            <div className="flex-grow-1" />

            <PermissionsToolbar element={element} disabled={!isValid} />

            <ReloadToolbar element={element} />
          </Nav>

          {status && <div className="text-danger">{status}</div>}
          <Tab.Content className={styles.content}>
            {wizardSteps.map(({ Component, step }) => (
              <Component key={step} eventKey={step} />
            ))}
          </Tab.Content>
        </BootstrapForm>
      </FormErrorContext.Provider>
    </Tab.Container>
  );
};

export default ElementWizard;
