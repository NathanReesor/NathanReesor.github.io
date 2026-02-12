import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
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

const path = window.location.pathname;
const opexPath = `${normalizeBase(base)}opex`;
const isOpexRoute = path === opexPath || path === `${opexPath}/`;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOpexRoute ? <OpexDashboard /> : <App />}
  </React.StrictMode>
);
