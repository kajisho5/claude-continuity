import type { artifacts as Ja } from "../ja/artifacts";

export const artifacts: typeof Ja = {
  panel: {
    label: "Artifact",
    diagramFailed: "Couldn't draw the diagram",
    drawingDiagram: "Drawing the diagram…",
    preparingComponent: "Preparing the component…",
    versions: "Versions",
    previousVersion: "Previous version",
    nextVersion: "Next version",
    preview: "Preview",
    code: "Code",
    sandboxHint: "Running in a sandboxed iframe (no network or app access)",
    reactLibraries: " · Available libraries: React, lucide-react, recharts, Tailwind",
    saveAs: (_ext: string) => "Download"
  },
  page: {
    title: "Artifacts",
    search: "Search artifacts",
    searchPlaceholder: "Search artifacts…",
    emptyTitle: "No artifacts yet",
    emptyText: "When Claude creates HTML, SVG, Mermaid diagrams or longer Markdown documents, they'll show up here. In a chat they appear as cards; click one to open it on the right.",
    noMatches: "No artifacts found.",
    versions: (n: number) => `${n} ${n === 1 ? "version" : "versions"}`
  }
};
