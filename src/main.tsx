import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import { resolveLocale, setLocale } from "./i18n";

// Until the saved preference loads, follow the OS language.
setLocale(resolveLocale("system"));
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
