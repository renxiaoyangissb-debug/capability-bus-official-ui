import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./ui/App.js";
import "./ui/shell.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("UI shell root is missing");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
