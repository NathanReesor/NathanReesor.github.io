import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import OpexDashboard from "./pages/OpexDashboard.jsx";
import "./index.css";

const base = import.meta.env.BASE_URL || "/";
const path = window.location.pathname;
const opexPath = `${base}opex`;
const isOpexRoute = path === opexPath || path === `${opexPath}/`;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isOpexRoute ? <OpexDashboard /> : <App />}
  </React.StrictMode>
);
