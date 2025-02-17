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

import React, { forwardRef, useMemo } from "react";
import { type ActionId, type ActionImpl, KBarResults, useMatches } from "kbar";
import { theme, groupNameStyle } from "./quickBarTheme";
import { useGetActionNameAndIcon } from "@/components/quickBar/utils";

const ResultItem = forwardRef(
  (
    {
      action,
      active,
      currentRootActionId,
    }: {
      action: ActionImpl;
      active: boolean;
      currentRootActionId: ActionId | undefined | null;
    },
    ref: React.Ref<HTMLDivElement>,
  ) => {
    const ancestors = useMemo(() => {
      if (!currentRootActionId) return action.ancestors;
      const index = action.ancestors.findIndex(
        (ancestor) => ancestor.id === currentRootActionId,
      );
      // +1 removes the currentRootAction; e.g.
      // if we are on the "Set theme" parent action,
      // the UI should not display "Set theme… > Dark"
      // but rather just "Dark"
      return action.ancestors.slice(index + 1);
    }, [action.ancestors, currentRootActionId]);

    const { name, icon } = useGetActionNameAndIcon(action);

    return (
      <div
        ref={ref}
        style={{
          padding: "12px 16px",
          background: active ? theme.a1 : "transparent",
          borderLeft: `4px solid ${
            active ? theme.activeIndicator : "transparent"
          }`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          height: 56,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: "16px",
          }}
        >
          <div
            style={{
              alignSelf: "flex-start",
              width: 18,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {icon ?? null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div>
              {ancestors.length > 0 &&
                ancestors.map((ancestor) => (
                  <React.Fragment key={ancestor.id}>
                    <span
                      style={{
                        opacity: 0.5,
                        marginRight: 8,
                      }}
                    >
                      {ancestor.name}
                    </span>
                    <span
                      style={{
                        marginRight: 8,
                      }}
                    >
                      &rsaquo;
                    </span>
                  </React.Fragment>
                ))}
              <span>{name}</span>
            </div>
            {action.subtitle && (
              <span
                style={{
                  fontSize: 9,
                  lineHeight: "120%",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}
              >
                {action.subtitle}
              </span>
            )}
          </div>
        </div>
        {action.shortcut?.length ? (
          <div
            aria-hidden
            style={{ display: "grid", gridAutoFlow: "column", gap: "4px" }}
          >
            {action.shortcut.map((sc: string) => (
              <kbd
                key={sc}
                style={{
                  padding: "4px 6px",
                  background: "rgba(0 0 0 / .1)",
                  borderRadius: "4px",
                  fontSize: 14,
                }}
              >
                {sc}
              </kbd>
            ))}
          </div>
        ) : null}
      </div>
    );
  },
);

ResultItem.displayName = "ResultItem";

const QuickBarResults: React.FC = () => {
  const { results, rootActionId } = useMatches();

  return (
    <KBarResults
      items={results}
      onRender={({ item, active }) =>
        typeof item === "string" ? (
          <div style={groupNameStyle}>{item}</div>
        ) : (
          <ResultItem
            action={item}
            active={active}
            currentRootActionId={rootActionId}
          />
        )
      }
    />
  );
};

export default QuickBarResults;
