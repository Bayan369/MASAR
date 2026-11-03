import { describe, expect, it } from "vitest";
import { knowledge, respond } from "./knowledge";
describe("isolated mock conversation", () => {
  it("retains Arabic topic and step for follow-up and explanation", () => {
    const first = respond("كيف أبدأ أول يوم؟", { step: 0 });
    const next = respond("طيب وبعدها؟", first.context);
    const explanation = respond("وش تقصد؟", next.context);
    expect(next.context).toEqual({ topic: "onboarding", step: 1 });
    expect(next.text).toContain("جهاز العمل");
    expect(explanation.sources).toEqual(next.sources);
  });
  it("supports English follow-ups", () => {
    const first = respond("How do I connect to VPN?", { step: 0 });
    expect(respond("what next?", first.context).context).toEqual({
      topic: "vpn",
      step: 1,
    });
  });
  it("switches topics and clarifies ambiguous follow-ups", () => {
    const first = respond("كيف أطلب إجازة؟", { step: 0 });
    expect(respond("كيف أفعل VPN؟", first.context).context).toEqual({
      topic: "vpn",
      step: 0,
    });
    expect(respond("ساعدني", first.context).status).toBe("uncertain");
    expect(respond("طيب وبعدها؟", { step: 0 }).status).toBe("uncertain");
  });
  it("rejects missing facts and resets stale context", () => {
    for (const q of [
      "كم راتبي؟",
      "كم يوم إجازة عندي؟",
      "ما بريد الدعم؟",
      "VPN server address?",
      "ما أسعار الأسهم؟",
    ]) {
      const result = respond(q, { topic: "vpn", step: 1 });
      expect(result.status).toBe("unavailable");
      expect(result.sources).toEqual([]);
      expect(result.context.topic).toBeUndefined();
    }
  });
  it("uses only verbatim evidence and stops at the last documented step", () => {
    for (const doc of knowledge) {
      let result = respond(doc.terms[0], { step: 0 });
      for (let i = 0; i < doc.steps.length; i++) {
        expect(result.status).toBe("verified");
        expect(doc.steps.some((s) => s === result.sources[0].quote)).toBe(true);
        result = respond("وبعدها؟", result.context);
      }
      expect(result.status).toBe("unavailable");
      expect(result.sources).toEqual([]);
    }
  });
});

describe("connected platform sources", () => {
  it("answers department questions from the same documents as the directory", () => {
    const answer = respond("ما مهام قسم المالية؟", { step: 0 });
    expect(answer.status).toBe("verified");
    expect(answer.sources[0].documentId).toBe("department-finance");
    const source = knowledge.find(
      (d) => d.id === answer.sources[0].documentId,
    )!;
    expect(source.steps).toContain(answer.sources[0].quote);
  });
  it("does not mistake an English substring for a department or invent a payroll answer", () => {
    expect(respond("what is equality?", { step: 0 }).status).toBe(
      "unavailable",
    );
    expect(respond("كم راتبي في المالية؟", { step: 0 }).status).toBe(
      "unavailable",
    );
  });
});

it("renders no retired demo wording in catalog, procedure steps, evidence or assistant states", () => {
  const retired = /تجريب|الديمو|نسخة العرض|Mock Data|Demo Assistant/;
  for (const doc of knowledge) {
    expect(doc.title).not.toMatch(retired);
    for (const step of doc.steps) expect(step).not.toMatch(retired);
  }
  for (const q of [
    "مرحبا",
    "ساعدني",
    "كم راتبي؟",
    "كيف أبدأ أول يوم؟",
    "How do I connect to VPN?",
  ]) {
    const result = respond(q, { step: 0 });
    expect(result.text).not.toMatch(retired);
    for (const source of result.sources) {
      expect(source.title).not.toMatch(retired);
      expect(source.quote).not.toMatch(retired);
    }
  }
});
