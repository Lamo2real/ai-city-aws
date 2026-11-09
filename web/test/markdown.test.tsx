import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Markdown } from "../src/lib/markdown.tsx";

afterEach(cleanup);

describe("VAIC's replies render Markdown", () => {
  it("headings, lists, tables, code and inline styles", () => {
    const text = [
      "# Status",
      "All **quiet**, see `ledger` and *notes*.",
      "",
      "- one",
      "- two",
      "",
      "1. first",
      "2. second",
      "",
      "| Dept | Workers |",
      "|---|---:|",
      "| Research | 3 |",
      "",
      "```",
      "npm test",
      "```",
    ].join("\n");
    const { container } = render(<Markdown text={text} />);
    expect(screen.getByRole("heading", { name: "Status" }).tagName).toBe("H3");
    expect(container.querySelector("strong")?.textContent).toBe("quiet");
    expect(container.querySelector("em")?.textContent).toBe("notes");
    expect(container.querySelector("p code")?.textContent).toBe("ledger");
    expect([...container.querySelectorAll("ul li")].map((l) => l.textContent)).toEqual(["one", "two"]);
    expect([...container.querySelectorAll("ol li")].map((l) => l.textContent)).toEqual(["first", "second"]);
    expect(screen.getByRole("columnheader", { name: "Workers" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Research" })).toBeTruthy();
    expect(container.querySelector("pre code")?.textContent).toBe("npm test");
  });
  it("never turns a reply into HTML, and only links http(s) addresses", () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)"> [ok](https://aws.amazon.com) [bad](javascript:alert(1))'} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("https://aws.amazon.com");
    expect(links[0]?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(container.textContent).toContain("bad");
  });
  it("keeps line breaks inside a paragraph and copes with a reply still streaming", () => {
    const { container } = render(<Markdown text={"line one\nline two\n```\nhalf a code blo"} />);
    expect(container.querySelector("p br")).not.toBeNull();
    expect(container.querySelector("pre code")?.textContent).toBe("half a code blo");
  });
});
