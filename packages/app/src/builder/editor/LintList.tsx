import { lintScreen } from "@interactive-displays/core";
import { decorCatalog } from "@interactive-displays/themes/manifest";
import { useMemo } from "react";
import { useEditor } from "./EditorContext.ts";

// Things that are valid but probably wrong, worked out locally on every edit; a click selects the culprit.
export const LintList = () => {
  const { screen, overview, select } = useEditor();
  const issues = useMemo(() => lintScreen(screen, { decor: decorCatalog, show: overview.show }), [screen, overview.show]);

  return (
    <details className="editor-panel lint" open={issues.length > 0}>
      <summary className="lint__summary">
        <span className="tool-label">Checks</span>
        <span className="tool-chip" data-tone={issues.length > 0 ? "warning" : "success"}>
          {issues.length === 0 ? "All good" : `${issues.length} to look at`}
        </span>
      </summary>
      <ul className="lint__list">
        {issues.map((issue, index) => (
          <li key={`${issue.rule}-${issue.nodeId}-${index}`}>
            <button type="button" className="lint__item" data-level={issue.level} onClick={() => select({ kind: "node", id: issue.nodeId })}>
              <span aria-hidden="true">{issue.level === "warning" ? "⚠" : "ℹ"}</span>
              <span>
                {issue.message} <span className="lint__node">{issue.nodeId}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
};
