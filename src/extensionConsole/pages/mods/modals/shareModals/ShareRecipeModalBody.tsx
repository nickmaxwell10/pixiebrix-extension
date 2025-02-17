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
import { type UUID } from "@/types/stringTypes";
import { Button, Modal } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import { selectShowShareContext } from "@/extensionConsole/pages/mods/modals/modModalsSelectors";
import { modModalsSlice } from "@/extensionConsole/pages/mods/modals/modModalsSlice";
import * as Yup from "yup";
import Form from "@/components/form/Form";
import { getErrorMessage } from "@/errors/errorHelpers";
import {
  useGetEditablePackagesQuery,
  useUpdateRecipeMutation,
} from "@/services/api";
import { type FormikHelpers } from "formik";
import notify from "@/utils/notify";
import { produce } from "immer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faInfoCircle,
  faTimes,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import ReactSelect from "react-select";
import styles from "./ShareModals.module.scss";
import { isSingleObjectBadRequestError } from "@/errors/networkErrorHelpers";
import { useOptionalModDefinition } from "@/modDefinitions/modDefinitionHooks";
import ActivationLink from "@/activation/ActivationLink";
import createMenuListWithAddButton from "@/components/form/widgets/createMenuListWithAddButton";
import { type Option } from "@/components/form/widgets/SelectWidget";
import Loader from "@/components/Loader";
import useHasEditPermissions from "@/extensionConsole/pages/mods/modals/shareModals/useHasEditPermissions";
import OwnerLabel from "@/extensionConsole/pages/mods/modals/shareModals/OwnerLabel";
import useSortOrganizations from "@/extensionConsole/pages/mods/modals/shareModals/useSortOrganizations";

type ShareModFormState = {
  organizations: UUID[];
};

const validationSchema = Yup.object().shape({
  organizations: Yup.array().of(Yup.string().required()),
});

const AddATeamMenuList = createMenuListWithAddButton(
  "https://app.pixiebrix.com/teams/create",
);

const ShareRecipeModalBody: React.FunctionComponent = () => {
  const dispatch = useDispatch();
  const { blueprintId } = useSelector(selectShowShareContext);
  const organizationsForSelect = useSortOrganizations();
  const [updateRecipe] = useUpdateRecipeMutation();
  const { data: editablePackages, isFetching: isFetchingEditablePackages } =
    useGetEditablePackagesQuery();
  const {
    data: recipe,
    isFetching: isFetchingRecipe,
    refetch: refetchRecipes,
  } = useOptionalModDefinition(blueprintId);
  const hasEditPermissions = useHasEditPermissions(blueprintId);

  const closeModal = () => {
    dispatch(modModalsSlice.actions.closeModal());
  };

  // If an extension was just converted to a blueprint, the API request is likely be in progress and recipe will be null
  if (isFetchingRecipe) {
    return (
      <Modal.Body>
        <Loader />
      </Modal.Body>
    );
  }

  const initialValues: ShareModFormState = {
    organizations: recipe.sharing.organizations,
  };

  const saveSharing = async (
    formValues: ShareModFormState,
    helpers: FormikHelpers<ShareModFormState>,
  ) => {
    try {
      const newRecipe = produce(recipe, (draft) => {
        draft.sharing.organizations = formValues.organizations;
      });

      const packageId = editablePackages.find(
        (x) => x.name === newRecipe.metadata.id,
      )?.id;

      await updateRecipe({
        packageId,
        recipe: newRecipe,
      }).unwrap();

      notify.success("Shared brick");
      closeModal();
      refetchRecipes();
    } catch (error) {
      if (
        isSingleObjectBadRequestError(error) &&
        error.response.data.config?.length > 0
      ) {
        helpers.setStatus(error.response.data.config.join(" "));
        return;
      }

      const message = getErrorMessage(error);
      helpers.setStatus(message);

      notify.error({
        message,
        error,
      });
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <>
      {hasEditPermissions ? (
        <Form
          validationSchema={validationSchema}
          initialValues={initialValues}
          onSubmit={saveSharing}
          renderStatus={({ status }) => (
            <div className="text-danger p-3">{status}</div>
          )}
          renderBody={({ values, setFieldValue }) => (
            <>
              <Modal.Body>
                <ReactSelect
                  options={organizationsForSelect
                    .filter((x) => !values.organizations.includes(x.id))
                    .map(
                      (x) =>
                        ({
                          label: x.name,
                          value: x.id,
                        }) satisfies Option,
                    )}
                  onChange={(selected: Option) => {
                    setFieldValue("organizations", [
                      ...values.organizations,
                      selected.value,
                    ]);
                  }}
                  value={null}
                  placeholder="Add a team"
                  components={{
                    MenuList: AddATeamMenuList,
                  }}
                />

                <div className={styles.row}>
                  <OwnerLabel blueprintId={blueprintId} />
                  <span className="text-muted">Owner</span>
                </div>

                {organizationsForSelect
                  .filter((x) => values.organizations.includes(x.id))
                  .map((organization) => (
                    <div className={styles.row} key={organization.id}>
                      <span>
                        <FontAwesomeIcon icon={faUsers} /> {organization.name}
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          const next = values.organizations.filter(
                            (x: string) => x !== organization.id,
                          );
                          setFieldValue("organizations", next);
                        }}
                      >
                        <FontAwesomeIcon icon={faTimes} />
                      </Button>
                    </div>
                  ))}
              </Modal.Body>
            </>
          )}
          renderSubmit={({ isValid, isSubmitting }) => (
            <Modal.Footer>
              <Button variant="link" onClick={closeModal}>
                Cancel
              </Button>
              <Button
                variant="primary"
                type="submit"
                disabled={
                  !isValid || isSubmitting || isFetchingEditablePackages
                }
              >
                Save and Close
              </Button>
            </Modal.Footer>
          )}
        />
      ) : (
        <Modal.Body>
          <div className="text-info my-3">
            <FontAwesomeIcon icon={faInfoCircle} /> You don&apos;t have
            permissions to change sharing
          </div>
          <div className={styles.row}>
            <OwnerLabel blueprintId={blueprintId} />
            <span className="text-muted">Owner</span>
          </div>
          {organizationsForSelect
            .filter((x) => recipe.sharing.organizations.includes(x.id))
            .map((organization) => (
              <div className={styles.row} key={organization.id}>
                <span>
                  <FontAwesomeIcon icon={faUsers} /> {organization.name}
                </span>
              </div>
            ))}
        </Modal.Body>
      )}
      <Modal.Body>
        <h4>Link to share:</h4>
        <p className="mb-1">
          People with access can activate the mod with this link
        </p>
        <ActivationLink blueprintId={blueprintId} />
      </Modal.Body>
    </>
  );
};

export default ShareRecipeModalBody;
