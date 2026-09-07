import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fquery/ui-react/style.css";
import { App } from "./App.js";
import "./playground.css";

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
