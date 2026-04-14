import { describe, it, expect, beforeEach } from "vitest";
import type { AttributionBus } from "../attribution-bus.js";
import type { AttributionEvent } from "@teamagent/types";

function makeEvent(overrides: Partial<AttributionEvent> = {}): AttributionEvent {
  return {
    source: "skeleton",
    action: "test",
    severity: "info",
    timestamp: "2026-04-14T00:00:00Z",
    ...overrides,
  };
}

/**
 * 契约测试：任何 AttributionBus 实现都应通过。
 */
export function runAttributionBusContract(factory: () => AttributionBus): void {
  describe("AttributionBus contract", () => {
    let bus: AttributionBus;

    beforeEach(() => {
      bus = factory();
    });

    it("emit + drain roundtrip", () => {
      const e = makeEvent();
      bus.emit(e);
      const drained = bus.drain();
      expect(drained).toHaveLength(1);
      expect(drained[0]?.action).toBe("test");
    });

    it("drain clears the buffer", () => {
      bus.emit(makeEvent());
      bus.drain();
      expect(bus.drain()).toEqual([]);
    });

    it("subscribe receives emitted events", () => {
      const seen: AttributionEvent[] = [];
      bus.subscribe((e) => seen.push(e));
      bus.emit(makeEvent({ action: "one" }));
      bus.emit(makeEvent({ action: "two" }));
      expect(seen.map((e) => e.action)).toEqual(["one", "two"]);
    });

    it("unsubscribe stops delivery", () => {
      const seen: AttributionEvent[] = [];
      const unsub = bus.subscribe((e) => seen.push(e));
      bus.emit(makeEvent({ action: "before" }));
      unsub();
      bus.emit(makeEvent({ action: "after" }));
      expect(seen.map((e) => e.action)).toEqual(["before"]);
    });

    it("multiple subscribers each receive every event", () => {
      const a: string[] = [];
      const b: string[] = [];
      bus.subscribe((e) => a.push(e.action));
      bus.subscribe((e) => b.push(e.action));
      bus.emit(makeEvent({ action: "x" }));
      expect(a).toEqual(["x"]);
      expect(b).toEqual(["x"]);
    });
  });
}
