import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sloptail/ui/styles.css";
import "./app.css";
import { UserApp } from "./user/UserApp.tsx";
import { BarApp } from "./bar/BarApp.tsx";

// Two routes; a router library would be more code than this.
const Screen = window.location.pathname.replace(/\/+$/, "") === "/bar" ? BarApp : UserApp;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
);
