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

import styles from "./Sidebar.module.scss";
import React, { useEffect, useMemo, useState } from "react";
import { sortBy } from "lodash";
import {
  Accordion,
  Button,
  // eslint-disable-next-line no-restricted-imports -- TODO: Fix over time
  Form,
  InputGroup,
  ListGroup,
} from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import hash from "object-hash";
import { isModComponentBase } from "@/pageEditor/sidebar/common";
import { faAngleDoubleLeft } from "@fortawesome/free-solid-svg-icons";
import cx from "classnames";
import ModListItem from "@/pageEditor/sidebar/ModListItem";
import useFlags from "@/hooks/useFlags";
import arrangeElements from "@/pageEditor/sidebar/arrangeElements";
import {
  selectActiveElementId,
  selectActiveRecipeId,
  selectExpandedRecipeId,
  selectExtensionAvailability,
  selectNotDeletedElements,
  selectNotDeletedExtensions,
} from "@/pageEditor/slices/editorSelectors";
import { useDispatch, useSelector } from "react-redux";
import {
  getRecipeById,
  getIdForElement,
  getModIdForElement,
} from "@/pageEditor/utils";
import useSaveRecipe from "@/pageEditor/hooks/useSaveRecipe";
import useResetRecipe from "@/pageEditor/hooks/useResetRecipe";
import useDeactivateMod from "@/pageEditor/hooks/useDeactivateMod";
import HomeButton from "./HomeButton";
import ReloadButton from "./ReloadButton";
import AddStarterBrickButton from "./AddStarterBrickButton";
import ModComponentListItem from "./ModComponentListItem";
import { actions } from "@/pageEditor/slices/editorSlice";
import { measureDurationFromAppStart } from "@/utils/performance";
import { useAllModDefinitions } from "@/modDefinitions/modDefinitionHooks";
import { useDebounce } from "use-debounce";

const SidebarExpanded: React.FunctionComponent<{
  collapseSidebar: () => void;
}> = ({ collapseSidebar }) => {
  const { data: allRecipes, isLoading: isAllRecipesLoading } =
    useAllModDefinitions();

  useEffect(() => {
    if (!isAllRecipesLoading) {
      measureDurationFromAppStart("sidebarExpanded:allRecipesLoaded");
    }
  }, [isAllRecipesLoading]);

  const dispatch = useDispatch();
  const activeElementId = useSelector(selectActiveElementId);
  const activeRecipeId = useSelector(selectActiveRecipeId);
  const expandedRecipeId = useSelector(selectExpandedRecipeId);
  const installed = useSelector(selectNotDeletedExtensions);
  const elements = useSelector(selectNotDeletedElements);
  const { availableInstalledIds, availableDynamicIds } = useSelector(
    selectExtensionAvailability,
  );

  const recipes = useMemo(() => {
    const installedAndElements = [...installed, ...elements];
    return (
      allRecipes?.filter((recipe) =>
        installedAndElements.some(
          (element) => getModIdForElement(element) === recipe.metadata.id,
        ),
      ) ?? []
    );
  }, [allRecipes, elements, installed]);

  const { flagOn } = useFlags();
  const showDeveloperUI =
    process.env.ENVIRONMENT === "development" ||
    flagOn("page-editor-developer");

  const [query, setQuery] = useState("");

  const [debouncedQuery] = useDebounce(query, 250, {
    trailing: true,
    leading: false,
  });

  const elementHash = hash(
    sortBy(
      elements.map(
        (formState) =>
          `${formState.uuid}-${formState.label}-${formState.recipe?.id ?? ""}`,
      ),
    ),
  );
  const recipeHash = hash(
    recipes
      ? recipes.map((recipe) => `${recipe.metadata.id}-${recipe.metadata.name}`)
      : "",
  );
  const sortedElements = useMemo(
    () =>
      arrangeElements({
        elements,
        installed,
        recipes,
        activeElementId,
        activeRecipeId,
        query: debouncedQuery,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- using elementHash and recipeHash to track changes
    [
      installed,
      elementHash,
      recipeHash,
      activeElementId,
      activeRecipeId,
      debouncedQuery,
    ],
  );

  const { save: saveRecipe, isSaving: isSavingRecipe } = useSaveRecipe();
  const resetRecipe = useResetRecipe();
  const deactivateMod = useDeactivateMod();

  const listItems = sortedElements.map((item) => {
    if (Array.isArray(item)) {
      const [recipeId, elements] = item;
      const recipe = getRecipeById(recipes, recipeId);
      const firstElement = elements[0];
      const installedVersion =
        firstElement == null
          ? // If there's no extensions in the Blueprint (empty Blueprint?), use the Blueprint's version
            recipe?.metadata?.version
          : isModComponentBase(firstElement)
            ? firstElement._recipe.version
            : firstElement.recipe.version;

      return (
        <ModListItem
          key={recipeId}
          recipe={recipe}
          isActive={recipeId === activeRecipeId}
          installedVersion={installedVersion}
          onSave={async () => {
            await saveRecipe(activeRecipeId);
          }}
          isSaving={isSavingRecipe}
          onReset={async () => {
            await resetRecipe(activeRecipeId);
          }}
          onDeactivate={async () => {
            await deactivateMod({ modId: activeRecipeId });
          }}
          onClone={async () => {
            dispatch(actions.showCreateRecipeModal({ keepLocalCopy: true }));
          }}
        >
          {elements.map((element) => (
            <ModComponentListItem
              key={getIdForElement(element)}
              extension={element}
              recipes={recipes}
              availableInstalledIds={availableInstalledIds}
              availableDynamicIds={availableDynamicIds}
              isNested
            />
          ))}
        </ModListItem>
      );
    }

    return (
      <ModComponentListItem
        key={getIdForElement(item)}
        extension={item}
        recipes={recipes}
        availableInstalledIds={availableInstalledIds}
        availableDynamicIds={availableDynamicIds}
      />
    );
  });

  return (
    <div className={cx(styles.root, styles.expanded)}>
      <div className={styles.header}>
        <div className={styles.actions}>
          <div className={styles.actionsLeft}>
            <HomeButton />

            <AddStarterBrickButton />

            {showDeveloperUI && <ReloadButton />}
          </div>
          <Button
            variant="light"
            className={styles.toggle}
            type="button"
            onClick={collapseSidebar}
          >
            <FontAwesomeIcon icon={faAngleDoubleLeft} />
          </Button>
        </div>
      </div>

      {/* Quick Filter */}
      <div className={styles.searchWrapper}>
        <div className={styles.searchContainer}>
          <InputGroup>
            <Form.Control
              placeholder="Quick filter"
              value={query}
              onChange={({ target }) => {
                setQuery(target.value);
              }}
            />
          </InputGroup>
          {query.length > 0 ? (
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setQuery("");
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      {/* Extension List */}
      <div className={styles.extensions}>
        <Accordion activeKey={expandedRecipeId}>
          <ListGroup>{listItems}</ListGroup>
        </Accordion>
      </div>
    </div>
  );
};

export default SidebarExpanded;
