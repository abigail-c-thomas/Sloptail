import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@sloptail/ui/styles.css";
import "./app.css";
import { UserApp } from "./user/UserApp.tsx";
import { BarApp } from "./bar/BarApp.tsx";
import { ScreenApp } from "./screen/ScreenApp.tsx";
import { AdminApp } from "./admin/AdminApp.tsx";
import { TicketsApp } from "./tickets/TicketsApp.tsx";

// A handful of routes; a router library would be more code than this.
const ROUTES: Record<string, () => React.JSX.Element> = { "/bar": BarApp, "/screen": ScreenApp, "/admin": AdminApp, "/tickets": TicketsApp };
const Page = ROUTES[window.location.pathname.replace(/\/+$/, "")] ?? UserApp;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
