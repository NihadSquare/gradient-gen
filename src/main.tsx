import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/hanken-grotesk";
import App from "./App";
import "./index.css";
import { useStore } from "./store/useStore";

// Canvas text only uses a font that is already loaded: load it now, then redraw once so overlay text is exact.
document.fonts?.load('700 20px "Hanken Grotesk Variable"').then(() => useStore.getState().bumpLogo()).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
