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

import { define } from "cooky-cutter";
import { type SiteSelectorHint } from "@/utils/inference/siteSelectorHints";

export const siteSelectorHintFactory = define<SiteSelectorHint>({
  siteName: "testSite",
  siteValidator: () => false,
  badPatterns: [] as SiteSelectorHint["badPatterns"],
  uniqueAttributes: [] as SiteSelectorHint["uniqueAttributes"],
  stableAnchors: [] as SiteSelectorHint["stableAnchors"],
  selectorTemplates: () => [] as SiteSelectorHint["selectorTemplates"],
  requiredSelectors: () => [] as SiteSelectorHint["requiredSelectors"],
});
