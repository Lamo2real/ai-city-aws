import { createRoot } from "react-dom/client";
import "@fontsource/silkscreen/400.css";
import "./styles.css";
import { App } from "./App.tsx";
import { applyTheme } from "./lib/theme.ts";

applyTheme(); // before the first paint, so a light-mode owner never sees a dark flash

createRoot(document.getElementById("root")!).render(<App />);
