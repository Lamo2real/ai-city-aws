// The files VAIC shows in the chat (show_files, docs/FILES.md §8): an inline preview (image, video player, PDF first
// page or a file card) with a Download button. The addresses are short-lived, so each card asks for fresh ones
// when it is drawn; a file deleted since then says so in plain words.
import { useEffect, useState } from "react";
import {
  byWords,
  dateWords,
  KIND_WORD,
  sizeWords,
  withLinks,
  type FileCardData,
  type StoredFile,
} from "../lib/files.ts";
import { FilePreview } from "./Files.tsx";
import { errorText } from "./ui.tsx";

export function FileCards(p: { files: FileCardData[]; ask?: boolean }) {
  if (!p.files.length) return null;
  return (
    <ul className={`chat-files${p.files.length > 1 ? " chat-files-many" : ""}`} aria-label="Files VAIC found">
      {p.files.map((f, i) => (
        <li key={f.id}>
          <FileCard card={f} number={p.files.length > 1 ? i + 1 : undefined} />
        </li>
      ))}
    </ul>
  );
}

function FileCard(p: { card: FileCardData; number?: number }) {
  const c = p.card;
  const [file, setFile] = useState<StoredFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    withLinks(c.id).then(
      (f) => live && setFile(f),
      (e) =>
        live &&
        setProblem(
          (e as { status?: number }).status === 404
            ? "This file was deleted."
            : errorText(e, "The preview didn't load. Open Files to see it."),
        ),
    );
    return () => {
      live = false;
    };
  }, [c.id]);
  const meta = [
    KIND_WORD[c.kind] ?? "File",
    sizeWords(c.size_bytes),
    c.taken_at ? `Taken ${dateWords(c.taken_at)}` : dateWords(c.created_at),
    c.department ? byWords({ added_by: "dept", department: c.department }) : "",
  ].filter(Boolean);
  return (
    <figure className="chat-file">
      {p.number ? <span className="chat-file-no">{p.number}</span> : null}
      {file ? <FilePreview file={file} compact /> : <div className="fpreview fpreview-wait" aria-hidden="true" />}
      <figcaption>
        <b className="chat-file-name">{c.name}</b>
        <span className="mute">{meta.join(" · ")}</span>
        {problem ? (
          <span className="chat-file-problem" role="alert">
            {problem}
          </span>
        ) : null}
      </figcaption>
      {file?.download_url ? (
        <a className="btn btn-primary chat-file-dl" href={file.download_url} download={c.name}>
          Download
        </a>
      ) : null}
    </figure>
  );
}
