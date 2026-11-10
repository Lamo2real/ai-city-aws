// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { hudAction } from "../src/lib/hudAction.ts";

describe("hud.action from VAIC", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "#/vaic";
  });
  it("switches the theme and remembers it", () => {
    hudAction({ action: "theme", value: "light" });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("vaic.theme")).toBe("light");
    hudAction({ action: "theme", value: "dark" });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
  it("opens a HUD page, and only a HUD page", () => {
    hudAction({ action: "open", page: "#/settings/connectors" });
    expect(window.location.hash).toBe("#/settings/connectors");
    hudAction({ action: "open", page: "https://evil.example" });
    hudAction({ action: "open", page: "javascript:alert(1)" });
    expect(window.location.hash).toBe("#/settings/connectors");
  });
  it("ignores anything else", () => {
    hudAction({ action: "theme", value: "purple" });
    expect(localStorage.getItem("vaic.theme")).toBeNull();
  });
});
