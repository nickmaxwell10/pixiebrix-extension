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

import React, { useEffect } from "react";
import validator from "@rjsf/validator-ajv6";
import { Theme } from "@rjsf/bootstrap-4";
import { withTheme, getDefaultRegistry } from "@rjsf/core";
import { useAsyncState } from "@/hooks/common";
import {
  getFormDefinition,
  resolveForm,
  cancelForm,
} from "@/contentScript/messenger/api";
import Loader from "@/components/Loader";
import { getErrorMessage } from "@/errors/errorHelpers";
import { type Target } from "@/types/messengerTypes";
import { validateUUID } from "@/types/helpers";
import ImageCropWidget from "@/components/formBuilder/ImageCropWidget";
import DescriptionField from "@/components/formBuilder/DescriptionField";
import reportError from "@/telemetry/reportError";
import ErrorBoundary from "@/components/ErrorBoundary";
import RjsfSelectWidget from "@/components/formBuilder/RjsfSelectWidget";
import { TOP_LEVEL_FRAME_ID } from "@/domConstants";
import { templates } from "@/components/formBuilder/RjsfTemplates";

const fields = {
  DescriptionField,
};
const uiWidgets = {
  imageCrop: ImageCropWidget,
  SelectWidget: RjsfSelectWidget,
};

const ModalLayout: React.FC = ({ children }) => (
  // Don't use React Bootstrap's Modal because we want to customize the classes in the layout
  <div className="modal-content">
    <div className="modal-body">{children}</div>
  </div>
);

const PanelLayout: React.FC = ({ children }) => (
  <div className="p-3">{children}</div>
);

function monkeyPatchFormWidgets() {
  const registry = getDefaultRegistry();
  // Use default widget instead of bs4 widget because the bs4 file widget is broken
  // https://github.com/rjsf-team/react-jsonschema-form/issues/2095#issuecomment-844309622
  // TODO: Remove this monkeypatch since it was fixed in March 2023
  Theme.widgets.FileWidget = registry.widgets.FileWidget;
  return withTheme(Theme);
}

const JsonSchemaForm = monkeyPatchFormWidgets();

/**
 * @see FormTransformer
 */
const EphemeralForm: React.FC = () => {
  const params = new URLSearchParams(location.search);
  const nonce = validateUUID(params.get("nonce"));
  const opener = JSON.parse(params.get("opener")) as Target;
  const mode = params.get("mode") ?? "modal";

  const isModal = mode === "modal";

  // The opener for a sidebar panel will be the sidebar frame, not the host panel frame. The sidebar only opens in the
  // top-level frame, so hard-code the top-level frameId
  const target = isModal
    ? opener
    : { tabId: opener.tabId, frameId: TOP_LEVEL_FRAME_ID };
  const FormContainer = isModal ? ModalLayout : PanelLayout;

  const [definition, isLoading, error] = useAsyncState(
    async () => getFormDefinition(target, nonce),
    [nonce],
  );

  // Report error once
  useEffect(() => {
    if (error) {
      // TODO: https://github.com/pixiebrix/pixiebrix-extension/issues/2769
      reportError(error);
    }
  }, [error]);

  if (isLoading) {
    return (
      <FormContainer>
        <Loader />
      </FormContainer>
    );
  }

  if (error) {
    return (
      <FormContainer>
        <div>Form Error</div>

        <div className="text-danger my-3">{getErrorMessage(error)}</div>

        <div>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              cancelForm(target, nonce);
            }}
          >
            Close
          </button>
        </div>
      </FormContainer>
    );
  }

  return (
    <FormContainer>
      <ErrorBoundary>
        <JsonSchemaForm
          schema={definition.schema}
          uiSchema={definition.uiSchema}
          fields={fields}
          widgets={uiWidgets}
          validator={validator}
          templates={templates}
          onSubmit={({ formData: values }) => {
            void resolveForm(target, nonce, values);
          }}
        >
          <div>
            <button className="btn btn-primary" type="submit">
              {definition.submitCaption}
            </button>
            {definition.cancelable && isModal && (
              <button
                className="btn btn-link"
                type="button"
                onClick={() => {
                  cancelForm(target, nonce);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </JsonSchemaForm>
      </ErrorBoundary>
    </FormContainer>
  );
};

export default EphemeralForm;
