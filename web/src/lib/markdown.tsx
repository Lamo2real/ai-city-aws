// A small Markdown renderer for AIC's replies: headings, paragraphs, bullet and numbered lists, tables,
// code blocks and inline **bold**, *italic*, `code` and [links](https://…). It builds React elements only
// (never raw HTML), so a reply cannot inject markup or scripts. Links open only for http(s) addresses.
import type { ReactNode } from "react";

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

export function inline(text: string, key = "i"): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={k}>{inline(part.slice(2, -2), k)}</strong>;
    if (/^`[^`]+`$/.test(part)) return <code key={k}>{part.slice(1, -1)}</code>;
    if (/^(\*[^*]+\*|_[^_]+_)$/.test(part)) return <em key={k}>{inline(part.slice(1, -1), k)}</em>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const [, label = "", href = ""] = link;
      return /^https?:\/\//i.test(href) ? (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        label
      );
    }
    return part;
  });
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
const isTableRule = (row: string | undefined) => !!row && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(row);
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const k = `b${i}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) code.push(lines[i++] ?? "");
      i++; // the closing fence (or the end of a reply still streaming)
      out.push(
        <pre key={k}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      const level = Math.min(6, (h[1] ?? "#").length + 2); // a reply's "#" sits under the screen's own headings
      const Tag = `h${level}` as "h3";
      out.push(<Tag key={k}>{inline(h[2] ?? "", k)}</Tag>);
      i++;
      continue;
    }
    if (line.includes("|") && isTableRule(lines[i + 1])) {
      const head = cells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && (lines[i] ?? "").includes("|") && (lines[i] ?? "").trim())
        body.push(cells(lines[i++] ?? ""));
      out.push(
        <div key={k} className="md-table">
          <table>
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th key={j} scope="col">
                    {inline(c, `${k}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>
                  {head.map((_, j) => (
                    <td key={j}>{inline(r[j] ?? "", `${k}r${ri}c${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const list = BULLET.test(line) ? BULLET : NUMBER.test(line) ? NUMBER : null;
    if (list) {
      const items: string[] = [];
      while (i < lines.length && list.test(lines[i] ?? "")) items.push(list.exec(lines[i++] ?? "")?.[1] ?? "");
      const Tag = list === BULLET ? "ul" : "ol";
      out.push(
        <Tag key={k}>
          {items.map((t, j) => (
            <li key={j}>{inline(t, `${k}l${j}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() &&
      !HEADING.test(lines[i] ?? "") &&
      !BULLET.test(lines[i] ?? "") &&
      !NUMBER.test(lines[i] ?? "") &&
      !(lines[i] ?? "").trim().startsWith("```") &&
      !((lines[i] ?? "").includes("|") && isTableRule(lines[i + 1]))
    )
      para.push(lines[i++] ?? "");
    out.push(
      <p key={k}>
        {para.flatMap((l, j) => (j ? [<br key={`${k}br${j}`} />, ...inline(l, `${k}p${j}`)] : inline(l, `${k}p${j}`)))}
      </p>,
    );
  }
  return <>{out}</>;
}
