import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sloptail/ui/styles.css";
import "./app.css";
import { UserApp } from "./user/UserApp.tsx";
import { BarApp } from "./bar/BarApp.tsx";
import { TicketsApp } from "./tickets/TicketsApp.tsx";

// Three routes; a router library would be more code than this.
const path = window.location.pathname.replace(/\/+$/, "");
const Screen = path === "/bar" ? BarApp : path === "/tickets" ? TicketsApp : UserApp;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
);
