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

import { isJsonString } from "./RemoteMethodOptions";
import { toExpression } from "@/utils/expressionUtils";

describe("isJsonString", () => {
  test("returns true when field value is JSON sting", () => {
    const fieldValue = toExpression("nunjucks", '{"foo": "bar"}');

    expect(isJsonString(fieldValue)).toBe(true);
  });

  test("returns false when field value is not JSON sting", () => {
    const fieldValue = toExpression("nunjucks", '{"foo": "bar"');

    expect(isJsonString(fieldValue)).toBe(false);
  });

  test.each([
    toExpression("var", "@foo"),
    {},
    "",
    toExpression("nunjucks", ""),
  ])("returns false when field is not nunjucks expression", (fieldValue) => {
    expect(isJsonString(fieldValue)).toBe(false);
  });
});
