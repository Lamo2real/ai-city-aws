// The "new version" notice: shows when a newer HUD is live than the one this page loaded (lib/version.ts).
// Only the Reload button reloads, so nothing the owner is typing or saying is cut off.
import { useEffect, useState } from "react";
import { watchVersion } from "../lib/version.ts";
import { Button } from "./ui.tsx";

export function UpdateNotice(p: { reload?: () => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => watchVersion(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <div className="toast update-notice" role="status" aria-live="polite">
      <span>A new version of VAIC is ready.</span>
      <Button variant="primary" onClick={p.reload ?? (() => location.reload())}>
        Reload
      </Button>
    </div>
  );
}
