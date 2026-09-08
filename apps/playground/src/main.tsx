import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fquery/ui-react/style.css";
import { App } from "./App.js";
import "./playground.css";

interface RuntimeBoundaryState { readonly error?: string }

class RuntimeBoundary extends Component<{ readonly children: ReactNode }, RuntimeBoundaryState> {
  state: RuntimeBoundaryState = {};

  static getDerivedStateFromError(error: unknown): RuntimeBoundaryState {
    return { error: readableError(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("FQUERY-PLAYGROUND-RUNTIME-FAILED", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <main className="boot-status" role="alert">
        <h1>FQuery実行画面の初期化に失敗しました</h1>
        <p data-runtime-error="true">{this.state.error}</p>
        <button type="button" onClick={() => location.reload()}>再読込</button>
      </main>
    );
  }
}

function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.replace(/(api[_-]?key|authorization|token)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]").slice(0, 800);
}

const app = document.getElementById("app");
if (!app) throw new Error("fquery-app-root-not-found");

createRoot(app).render(
  <StrictMode>
    <RuntimeBoundary><App /></RuntimeBoundary>
  </StrictMode>,
);
