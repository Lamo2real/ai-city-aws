// Settings → Departments (the switches) and Settings → Connectors (ConnectorsHub.tsx: Connectors | Skills | Plugins,
// Mine | Explore). Keys are typed only into secure fields.
import { useEffect, useState } from "react";
import { listConnectors, removeConnector, type Connector } from "../lib/connect.ts";
import { ConnectorsHub } from "./ConnectorsHub.tsx";
import { DepartmentPresets } from "./DepartmentPresets.tsx";
import { Banner, Confirm, toast } from "./ui.tsx";

export function ConnectorsSettings(p: {
  /** Settings → Departments (the switches) or Settings → Connectors (everything connected, and the catalog). */
  part: "departments" | "connectors";
  mailAccess?: Record<string, string>;
  onMailAccess?: (a: Record<string, string>) => void;
  openRow?: string;
}) {
  if (p.part === "connectors")
    return (
      <ConnectorsHub
        mailAccess={p.mailAccess ?? {}}
        onMailAccess={p.onMailAccess ?? (() => undefined)}
        openRow={p.openRow}
      />
    );
  return <Departments />;
}

function Departments() {
  const [list, setList] = useState<Connector[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Connector | null>(null);
  const load = () =>
    listConnectors().then(
      (r) => {
        setList(r.connectors);
        setError(null);
      },
      (e: Error) => setError(e.message),
    );
  useEffect(() => {
    void load();
  }, []);
  return (
    <div className="connectors">
      {error ? <Banner tone="info">{`Connectors: ${error}`}</Banner> : null}
      <DepartmentPresets connectors={list} reload={load} onRemove={setRemoving} />
      {removing ? (
        <Confirm
          title={`Remove ${removing.label ?? removing.id}?`}
          what="Its tools stop working for every agent, and its sign-in or key is deleted from AWS. You can add it again later."
          cost="Cost: nothing."
          confirmLabel="Remove connector"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={async () => {
            await removeConnector(removing.id);
            setRemoving(null);
            setList((xs) => xs?.filter((x) => x.id !== removing.id) ?? null);
            toast({ text: "Removed.", tone: "good" });
          }}
        />
      ) : null}
    </div>
  );
}
