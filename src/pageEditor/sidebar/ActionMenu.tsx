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
import SaveButton from "@/pageEditor/sidebar/SaveButton";
import {
  faClone,
  faFileExport,
  faFileImport,
  faHistory,
  faTimes,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import styles from "./ActionMenu.module.scss";
import EllipsisMenu, {
  type EllipsisMenuItem,
} from "@/components/ellipsisMenu/EllipsisMenu";

type ActionMenuProps = {
  onSave: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
  onClone: () => Promise<void>;
  onReset?: () => Promise<void>;
  isDirty?: boolean;
  onAddToRecipe?: () => Promise<void>;
  onRemoveFromRecipe?: () => Promise<void>;
  disabled?: boolean;
};

const ActionMenu: React.FC<ActionMenuProps> = ({
  onSave,
  onDelete,
  onDeactivate,
  onClone,
  onReset,
  isDirty,
  onAddToRecipe,
  onRemoveFromRecipe,
  disabled,
}) => {
  const menuItems: EllipsisMenuItem[] = [
    {
      title: (
        <>
          <FontAwesomeIcon icon={faHistory} fixedWidth /> Reset
        </>
      ),
      hide: !onReset,
      action: onReset,
      disabled: !isDirty || disabled,
    },
    {
      title: (
        <>
          <FontAwesomeIcon
            icon={faFileImport}
            fixedWidth
            className={styles.addIcon}
          />{" "}
          Add to mod
        </>
      ),
      hide: !onAddToRecipe,
      action: onAddToRecipe,
      disabled,
    },
    {
      title: (
        <>
          <FontAwesomeIcon
            icon={faFileExport}
            fixedWidth
            className={styles.removeIcon}
          />{" "}
          Move from mod
        </>
      ),
      hide: !onRemoveFromRecipe,
      action: onRemoveFromRecipe,
      disabled,
    },
    {
      title: (
        <>
          <FontAwesomeIcon icon={faClone} fixedWidth /> Make a copy
        </>
      ),
      action: onClone,
      disabled,
    },
    ...(onDelete
      ? [
          {
            title: (
              <>
                <FontAwesomeIcon icon={faTrash} fixedWidth /> Delete
              </>
            ),
            action: onDelete,
            disabled,
          },
        ]
      : []),
    ...(onDeactivate
      ? [
          {
            title: (
              <>
                <FontAwesomeIcon icon={faTimes} fixedWidth /> Deactivate
              </>
            ),
            action: onDeactivate,
            disabled,
          },
        ]
      : []),
  ];

  return (
    <div className={styles.root}>
      <SaveButton onClick={onSave} disabled={!isDirty || disabled} />
      <EllipsisMenu items={menuItems} toggleClassName={styles.toggle} />
    </div>
  );
};

export default ActionMenu;
