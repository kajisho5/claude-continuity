import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative asset paths so the built renderer also loads via file:// (npm start and packaged builds).
export default defineConfig({ base: "./", plugins: [react()], server: { host: "127.0.0.1", port: 5173 } });
