import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

// NOTE: StrictMode double-invokes effects in dev, which would register
// WebMCP tools twice; guard by only registering once per page load.
createRoot(document.getElementById("root")!).render(<App />);
