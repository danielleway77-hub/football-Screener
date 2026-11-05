"use client";

import * as React from "react";

const RADIUS_LADDER = new Set([0, 8, 12, 16, 20, 24]);

type Finding = { rule: string; detail: string };

function describe(el: Element): string {
  const cls =
    typeof (el as HTMLElement).className === "string"
      ? (el as HTMLElement).className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
  return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}`;
}

/** Walks the style-guide DOM and reports violations of the sleek rules (UI_BLUEPRINT §28). */
export function checkDom(root: Element): Finding[] {
  const findings: Finding[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (el.closest("[data-rule-checker]")) continue;
    const cs = getComputedStyle(el);
    // radius ladder
    for (const corner of [
      "borderTopLeftRadius",
      "borderTopRightRadius",
      "borderBottomRightRadius",
      "borderBottomLeftRadius",
    ] as const) {
      const raw = cs[corner];
      if (!raw || raw === "0px") continue;
      if (raw.endsWith("%")) continue; // circles
      const px = parseFloat(raw);
      if (px >= 999) continue; // pill
      if (!RADIUS_LADDER.has(Math.round(px))) {
        findings.push({ rule: "radius ladder", detail: `${describe(el)} has ${raw}` });
        break;
      }
    }
    // pure black / white backgrounds
    const bg = cs.backgroundColor;
    if (bg === "rgb(0, 0, 0)" || bg === "rgb(255, 255, 255)") {
      findings.push({ rule: "no pure black/white", detail: `${describe(el)} background ${bg}` });
    }
    // outer shadows on resting cards/tiles
    if (
      el.matches('[data-slot="card"], .surface-1, .surface-2') &&
      !el.hasAttribute("data-force") &&
      !el.classList.contains("glow-accent")
    ) {
      const shadow = cs.boxShadow;
      if (shadow && shadow !== "none") {
        const outer = shadow
          .split(/,(?![^(]*\))/)
          .some((s) => !/inset/.test(s) && !/rgba?\(0, 0, 0, 0\)/.test(s));
        if (outer)
          findings.push({
            rule: "no resting outer shadow",
            detail: `${describe(el)} has ${shadow.slice(0, 60)}`,
          });
      }
    }
  }
  return findings;
}

export function RuleChecker() {
  const [findings, setFindings] = React.useState<Finding[] | null>(null);
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      const root = document.querySelector('[data-testid="style-guide"]');
      setFindings(root ? checkDom(root) : []);
    }, 600);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section
      data-rule-checker
      data-testid="rule-checker"
      className="surface-1 rounded-lg p-4 md:p-6"
    >
      <h2 className="text-h3">Rule checker (dev)</h2>
      <p className="text-body-sm text-muted-foreground">
        Radius ladder · no pure black/white · no resting outer shadows. Must report zero.
      </p>
      <p className="num text-stat-sm mt-3" data-testid="rule-checker-count">
        {findings === null ? "checking…" : `${findings.length} violations`}
      </p>
      {findings && findings.length > 0 ? (
        <ul className="text-body-sm mt-3 space-y-1 text-negative">
          {findings.slice(0, 40).map((f, i) => (
            <li key={i}>
              <strong>{f.rule}</strong>: {f.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
