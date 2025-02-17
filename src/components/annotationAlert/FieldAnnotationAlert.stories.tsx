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
import { type ComponentStory, type ComponentMeta } from "@storybook/react";
import FieldAnnotationAlert from "./FieldAnnotationAlert";
import { AnnotationType } from "@/types/annotationTypes";

export default {
  title: "Common/FieldAnnotationAlert",
  component: FieldAnnotationAlert,
} as ComponentMeta<typeof FieldAnnotationAlert>;

export const Default: ComponentStory<typeof FieldAnnotationAlert> = (args) => (
  <FieldAnnotationAlert {...args} />
);
Default.args = {
  message: "This is an error message",
  type: AnnotationType.Error,
};
