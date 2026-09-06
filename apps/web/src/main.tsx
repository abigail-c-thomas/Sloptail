import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@sloptail/ui/styles.css";
import "./app.css";
import { UserApp } from "./user/UserApp.js";
import { BarApp } from "./bar/BarApp.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserApp />} />
        <Route path="/bar" element={<BarApp />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
