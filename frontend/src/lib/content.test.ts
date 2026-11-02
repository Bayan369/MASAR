import { describe, expect, it } from "vitest";
import { ar, departments } from "./content";
describe("Arabic navigation and terminology", () => {
  it("provides six unique navigation destinations", () => {
    expect(new Set(ar.navigation.map((n) => n.path)).size).toBe(6);
    expect(
      ar.navigation.every(
        (n) => /[\u0600-\u06ff]/.test(n.label) && n.term.length > 0,
      ),
    ).toBe(true);
  });
  it("retains required department abbreviations", () => {
    expect(departments.map((d) => d.term)).toEqual(
      expect.arrayContaining([
        "IT",
        "HR",
        "Finance",
        "Administration",
        "Marketing",
        "QA",
        "Operations",
      ]),
    );
  });
});
