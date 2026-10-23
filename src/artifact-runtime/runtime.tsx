/**
 * Runs a React artifact inside the sandboxed preview frame (opaque origin, no network).
 * Bundled on its own (npm run build:runtime) and inlined into the frame, so nothing is fetched.
 * Supported imports mirror the Claude apps: react, react-dom, lucide-react, recharts.
 */
import * as React from "react";
import * as ReactDOM from "react-dom";
import { createRoot } from "react-dom/client";
import * as Lucide from "lucide-react";
import * as Recharts from "recharts";
import { transform } from "sucrase";
// Imported directly: this bundle runs in its own frame and cannot reach the app's i18n store.
import { runtime as ja } from "../i18n/ja/runtime";
import { runtime as en } from "../i18n/en/runtime";

const STRINGS = { ja, en };
let s = ja;

const MODULES: Record<string, unknown> = {
  react: React, "react-dom": ReactDOM, "react-dom/client": { createRoot }, "lucide-react": Lucide, recharts: Recharts
};

function showError(title: string, detail: string) {
  const root = document.getElementById("root")!;
  root.innerHTML = "";
  const box = document.createElement("div");
  box.style.cssText = "margin:16px;padding:14px 16px;border:1px solid #f0b4a8;background:#fff5f2;border-radius:10px;font:13px/1.6 system-ui,sans-serif;color:#7a2d1c";
  const b = document.createElement("b"); b.textContent = title;
  const pre = document.createElement("pre"); pre.textContent = detail;
  pre.style.cssText = "white-space:pre-wrap;margin:8px 0 0;font:12px/1.5 ui-monospace,monospace";
  box.append(b, pre); root.append(box);
}

class Boundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return React.createElement("div", { style: { margin: 16, padding: "14px 16px", border: "1px solid #f0b4a8", background: "#fff5f2", borderRadius: 10, font: "13px/1.6 system-ui,sans-serif", color: "#7a2d1c" } },
      React.createElement("b", null, s.renderError), React.createElement("pre", { style: { whiteSpace: "pre-wrap", margin: "8px 0 0", font: "12px/1.5 ui-monospace,monospace" } }, String(this.state.error.stack ?? this.state.error)));
    return this.props.children;
  }
}

export function run(source: string, locale: "ja" | "en" = "ja") {
  s = STRINGS[locale] ?? ja;
  let compiled: string;
  try {
    compiled = transform(source, { transforms: ["typescript", "jsx", "imports"], production: true, filePath: "artifact.tsx" }).code;
  } catch (e) { showError(s.compileError, String((e as Error).message ?? e)); return; }
  const exports: Record<string, unknown> = {};
  const module = { exports };
  const require = (name: string) => {
    if (name in MODULES) return MODULES[name];
    throw new Error(s.unsupportedImport(name));
  };
  try {
    new Function("require", "module", "exports", "React", compiled)(require, module, exports, React);
  } catch (e) { showError(s.executeError, String((e as Error).stack ?? e)); return; }
  const out = module.exports as Record<string, unknown>;
  const Component = (out.default ?? Object.values(out).find(v => typeof v === "function")) as React.ComponentType | undefined;
  if (typeof Component !== "function") { showError(s.noComponent, s.noComponentDetail); return; }
  createRoot(document.getElementById("root")!).render(React.createElement(Boundary, null, React.createElement(Component)));
}

(window as unknown as { __runArtifact: typeof run }).__runArtifact = run;
