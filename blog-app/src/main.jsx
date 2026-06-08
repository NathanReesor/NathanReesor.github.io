import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import HomePage from "./pages/HomePage.jsx";
import OpexDashboard from "./pages/OpexDashboard.jsx";
import "./index.css";

const base = import.meta.env.BASE_URL || "/";

function normalizeBase(inputBase) {
  return inputBase.endsWith("/") ? inputBase : `${inputBase}/`;
}

function restoreGithubPagesRoute() {
  const params = new URLSearchParams(window.location.search);
  const route = params.get("p");

  if (!route) {
    return;
  }

  const cleanedBase = normalizeBase(base);
  const cleanedRoute = route.replace(/^\/+/, "");
  const originalQuery = params.get("q");
  const originalHash = params.get("h");

  const nextPath = `${cleanedBase}${cleanedRoute}`;
  const nextQuery = originalQuery ? `?${originalQuery}` : "";
  const nextHash = originalHash ? `#${originalHash}` : "";

  window.history.replaceState(null, "", `${nextPath}${nextQuery}${nextHash}`);
}

restoreGithubPagesRoute();

const normalizedBase = normalizeBase(base);
const path = window.location.pathname;
const relativePath = path.startsWith(normalizedBase)
  ? path.slice(normalizedBase.length).replace(/\/$/, "")
  : path.replace(/^\/+|\/+$/g, "");

function selectPage() {
  if (relativePath === "opex") return <OpexDashboard />;
  if (relativePath === "equitydashboard" || relativePath === "research-dash") return <App />;
  return <HomePage />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {selectPage()}
  </React.StrictMode>
);
