import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";

// Lightweight DOMMatrix polyfill to avoid runtime errors in some browsers or CSP-influenced builds
try {
  if (typeof window !== 'undefined') {
    const w: any = window as any;
    if (!w.DOMMatrix) {
      w.DOMMatrix = w.WebKitCSSMatrix || w.MSCSSMatrix || w.DOMMatrixReadOnly || undefined;
    }
    // Some minified bundles check for uppercased global
    if (!w.DOMMATRIX && w.DOMMatrix) {
      w.DOMMATRIX = w.DOMMatrix;
    }
  }
} catch {}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
