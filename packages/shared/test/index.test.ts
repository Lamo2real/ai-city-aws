import { expect, test } from "vitest";
import { APP } from "../src/index.ts";

test("shared package loads", () => expect(APP).toBe("aic"));
