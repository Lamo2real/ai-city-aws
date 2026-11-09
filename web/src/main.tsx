import { createRoot } from "react-dom/client";
import "@fontsource/silkscreen/400.css";
import "./styles.css";
import { App } from "./App.tsx";
import { applyTheme } from "./lib/theme.ts";
import { installTapFx } from "./lib/tapFx.ts";

applyTheme(); // before the first paint, so a light-mode owner never sees a dark flash
installTapFx(); // two amber rings and a soft click on every tap (decision 148)

createRoot(document.getElementById("root")!).render(<App />);
