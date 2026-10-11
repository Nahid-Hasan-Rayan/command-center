/**
 * NHR
 * @author Nahid Hasan Rayan
 */
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { BRIDGE_SOURCE } from "./bridge-script";

interface Sent {
  cc: number;
  type: string;
  token: string;
  [key: string]: unknown;
}

function createFrame(boot: object) {
  const sent: Sent[] = [];
  const timers: (() => void)[] = [];
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const register = (name: string, fn: (event: unknown) => void): void => {
    const existing = listeners[name] ?? [];
    existing.push(fn);
    listeners[name] = existing;
  };
  const parent = { postMessage: (message: Sent) => sent.push(message) };
  const context: Record<string, unknown> = {
    __CC_BOOT__: boot,
    parent,
    DOMException,
    setTimeout: (fn: () => void) => {
      timers.push(fn);
      return timers.length;
    },
    document: {
      visibilityState: "visible",
      addEventListener: (name: string, fn: (event: unknown) => void) =>
        register(`document:${name}`, fn),
    },
    addEventListener: (name: string, fn: (event: unknown) => void) => register(name, fn),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(BRIDGE_SOURCE, context);
  const run = <T>(code: string): T => vm.runInContext(code, context) as T;
  return {
    run,
    sent,
    flushTimers: () => {
      while (timers.length > 0) {
        timers.shift()?.();
      }
    },
    deliver: (data: unknown, source: unknown = parent) => {
      for (const listener of listeners.message ?? []) {
        listener({ data, source });
      }
    },
    parent,
  };
}

const TOKEN = "tokentokentoken12";

describe("storage shim", () => {
  it("loads initial state and supports the Storage interface", () => {
    const frame = createFrame({ token: TOKEN, state: { a: "1" }, permissions: [] });
    expect(frame.run("localStorage.getItem('a')")).toBe("1");
    expect(frame.run("localStorage.getItem('missing')")).toBeNull();
    frame.run("localStorage.setItem('b', 2)");
    expect(frame.run("localStorage.getItem('b')")).toBe("2");
    expect(frame.run("localStorage.length")).toBe(2);
    expect(frame.run("localStorage.key(0)")).toBe("a");
    frame.run("localStorage.removeItem('a')");
    expect(frame.run("localStorage.getItem('a')")).toBeNull();
    frame.run("localStorage.clear()");
    expect(frame.run("localStorage.length")).toBe(0);
  });

  it("supports property style access", () => {
    const frame = createFrame({ token: TOKEN, state: { a: "1" }, permissions: [] });
    expect(frame.run("localStorage.a")).toBe("1");
    frame.run("localStorage.c = 'x'");
    expect(frame.run("localStorage.getItem('c')")).toBe("x");
    expect(frame.run("Object.keys(localStorage).sort().join(',')")).toBe("a,c");
  });

  it("sends state to the host once after a burst of writes", () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: [] });
    frame.sent.length = 0;
    frame.run("localStorage.setItem('x','1'); localStorage.setItem('y','2')");
    expect(frame.sent).toHaveLength(0);
    frame.flushTimers();
    expect(frame.sent).toEqual([
      { cc: 1, type: "state.set", token: TOKEN, data: { x: "1", y: "2" } },
    ]);
  });

  it("enforces a quota like a real browser", () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: [] });
    expect(() => frame.run("localStorage.setItem('big', 'x'.repeat(600000))")).toThrow(/quota/i);
    expect(frame.run("localStorage.getItem('big')")).toBeNull();
  });

  it("keeps session storage in memory only", () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: [] });
    frame.sent.length = 0;
    frame.run("sessionStorage.setItem('s','1')");
    frame.flushTimers();
    expect(frame.run("sessionStorage.getItem('s')")).toBe("1");
    expect(frame.sent.filter((message) => message.type === "state.set")).toHaveLength(0);
  });
});

describe("host messaging", () => {
  it("announces readiness with the token", () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: ["read:calendar"] });
    expect(frame.sent[0]).toEqual({ cc: 1, type: "ready", token: TOKEN });
    expect(frame.run("CommandCenter.permissions.join(',')")).toBe("read:calendar");
  });

  it("resolves context requests answered by the host", async () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: ["read:calendar"] });
    frame.sent.length = 0;
    const promise = frame.run<Promise<unknown>>("CommandCenter.getContext('calendar')");
    const request = frame.sent[0];
    expect(request).toMatchObject({ type: "context.request", scope: "calendar", token: TOKEN });
    frame.deliver({
      cc: 1,
      type: "context.response",
      token: TOKEN,
      id: request?.id,
      data: { ok: true },
    });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it("rejects context errors from the host", async () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: [] });
    frame.sent.length = 0;
    const promise = frame.run<Promise<unknown>>("CommandCenter.getContext('calendar')");
    frame.deliver({
      cc: 1,
      type: "context.response",
      token: TOKEN,
      id: frame.sent[0]?.id,
      error: "denied",
    });
    await expect(promise).rejects.toThrow("denied");
  });

  it("ignores replies with the wrong token or from another window", async () => {
    const frame = createFrame({ token: TOKEN, state: {}, permissions: [] });
    frame.sent.length = 0;
    const promise = frame.run<Promise<unknown>>("CommandCenter.getContext('calendar')");
    const id = frame.sent[0]?.id;
    frame.deliver({ cc: 1, type: "context.response", token: "wrong-wrong-wrong", id, data: "bad" });
    frame.deliver(
      { cc: 1, type: "context.response", token: TOKEN, id, data: "bad" },
      { postMessage: () => undefined },
    );
    frame.deliver({ cc: 1, type: "context.response", token: TOKEN, id, data: "good" });
    await expect(promise).resolves.toBe("good");
  });
});
