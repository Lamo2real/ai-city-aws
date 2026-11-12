// Images in the chat, like Claude Code (decision 256): a rounded thumbnail in the box while the message is
// written (the file itself, at once, with the upload's progress as a ring), and thumbnails in the owner's sent
// bubble that open larger. No filename is shown on an image; screen readers get it as the alt text.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { KnowledgeItem } from "../lib/api.ts";
import { splitAttachments } from "../lib/attach.ts";
import { useImageUrl } from "../lib/chatImages.ts";
import type { ChatAttachment } from "../lib/store.ts";

const FileIcon = () => (
  <svg className="att-ico" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

/** A file name short enough for a chip: "Quarterly re….pdf". */
export function shortName(name: string, max = 22): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 && name.length - dot <= 6 ? name.slice(dot) : "";
  return `${name.slice(0, max - ext.length - 1)}…${ext}`;
}

/** The progress ring over an image that is still uploading. */
function Ring({ percent }: { percent: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg className="thumb-ring" viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r={r} className="ring-track" />
      <circle
        cx="18"
        cy="18"
        r={r}
        className="ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, Math.max(0, percent)) / 100)}
      />
    </svg>
  );
}

function Img({ id, alt }: { id: string; alt: string }) {
  const url = useImageUrl(id);
  const [broken, setBroken] = useState(false);
  if (!url || broken) return <span className="thumb-missing" role="img" aria-label={alt} />;
  return <img src={url} alt={alt} decoding="async" draggable={false} onError={() => setBroken(true)} />;
}

/** One attachment in the box: an image as a thumbnail, anything else as a chip. */
export function ComposerAttachment({
  item,
  image,
  percent,
  status,
  failed,
  onRemove,
}: {
  item: KnowledgeItem;
  image: boolean;
  percent?: number;
  /** For screen readers (and the chip): "Uploading 40 %", "Ready", … */
  status: string;
  failed: boolean;
  onRemove: () => void;
}) {
  const remove = (
    <button type="button" className="chip-x" aria-label={`Remove ${item.title}`} title="Remove" onClick={onRemove}>
      ×
    </button>
  );
  if (!image)
    return (
      <li className={`chip chip-${failed ? "failed" : item.status}`}>
        <FileIcon />
        <span className="chip-name" title={item.title}>
          {shortName(item.title)}
        </span>
        <span className="st" role="status">
          {status}
        </span>
        {remove}
      </li>
    );
  const uploading = item.status === "uploading" && !failed;
  return (
    <li className={`att-thumb${uploading ? " is-uploading" : ""}${failed ? " is-failed" : ""}`} tabIndex={-1}>
      <Img id={item.id} alt={item.title} />
      {uploading ? <Ring percent={percent ?? 0} /> : null}
      {failed ? (
        <span className="thumb-bad" aria-hidden="true">
          !
        </span>
      ) : null}
      <span className="sr" role="status">
        {status}
      </span>
      {remove}
    </li>
  );
}

/** The larger view of a sent image: Esc, the × or a click outside closes it, and focus goes back. */
function Lightbox({ image, onClose }: { image: ChatAttachment; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    close.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        e.preventDefault(); // one control inside: keep focus on it
        close.current?.focus();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      back?.focus();
    };
  }, [onClose]);
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={image.title} onClick={onClose}>
      <button ref={close} type="button" className="lightbox-x" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <div className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
        <Img id={image.id} alt={image.title} />
      </div>
    </div>,
    document.body,
  );
}

/** The attachments in an owner's sent bubble: images as thumbnails (above the words), other files as chips. */
export function SentAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  const [open, setOpen] = useState<ChatAttachment | null>(null);
  const { images, others } = splitAttachments(attachments);
  return (
    <>
      {images.length ? (
        <ul className="sent-thumbs" aria-label={images.length === 1 ? "Image you sent" : "Images you sent"}>
          {images.map((a) => (
            <li key={a.id}>
              <button type="button" className="sent-thumb" onClick={() => setOpen(a)} aria-haspopup="dialog">
                <Img id={a.id} alt={a.title} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {others.length ? (
        <ul className="sent-files" aria-label="Files you sent">
          {others.map((a) => (
            <li key={a.id} className="chip" title={a.title}>
              <FileIcon />
              <span className="chip-name">{shortName(a.title)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {open ? <Lightbox image={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
