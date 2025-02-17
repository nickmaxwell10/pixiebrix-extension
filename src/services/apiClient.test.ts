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
import { absoluteApiUrl } from "@/services/apiClient";

// Disable automatic __mocks__ resolution #6799
jest.mock("@/services/apiClient", () => jest.requireActual("./apiClient.ts"));

describe("absoluteApiUrl", () => {
  it("makes relative url absolute", async () => {
    await expect(absoluteApiUrl("/relative")).resolves.toBe(
      "https://app.pixiebrix.com/relative",
    );
  });

  it("throws on other absolute URL", async () => {
    await expect(absoluteApiUrl("https://virus.com")).rejects.toThrow();
  });

  it("handles absolute URL", async () => {
    const absoluteUrl = "https://app.pixiebrix.com/path";
    await expect(absoluteApiUrl(absoluteUrl)).resolves.toBe(absoluteUrl);
  });
});
