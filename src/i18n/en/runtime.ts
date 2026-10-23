import type { runtime as Ja } from "../ja/runtime";

// Used by the artifact runtime bundle (src/artifact-runtime), which imports this file directly.
export const runtime: typeof Ja = {
  renderError: "An error occurred while running",
  compileError: "Couldn't load the code",
  executeError: "Couldn't run the code",
  noComponent: "No component to display",
  noComponentDetail: "Export a React component with export default.",
  unsupportedImport: (name: string) => `"${name}" isn't available (you can use react / lucide-react / recharts)`
};
