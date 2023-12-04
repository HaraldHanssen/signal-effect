import { derived, effect, react, readonly, recalculate, signal } from "./signal";

test("get signal value", () => {
    const s = signal(42);
    expect(s()).toBe(42);
});
test("set signal value", () => {
    const s = signal(42);
    s(43);
    expect(s()).toBe(43);
});

test("get readonly value", () => {
    const s = signal(42);
    const r = readonly(s);
    expect(r()).toBe(42);
    s(43);
    expect(r()).toBe(43);
});

test("get derived value", () => {
    let calculated = 0;
    const s = signal(42);
    const d = derived(s, (x) => {
        expect(x).toBeDefined();
        calculated++;
        return 2 * x;
    });
    expect(calculated).toBe(0);
    expect(d()).toBe(84);
    expect(calculated).toBe(1);
    s(43);
    expect(calculated).toBe(1);
    expect(d()).toBe(86);
    expect(calculated).toBe(2);
    expect(d()).toBe(86);
    expect(calculated).toBe(2);
});
test("get derived value from N signals", () => {
    let calculated = 0;
    const s = signal(42);
    const t = signal(4);
    const d = derived([s, t], ([x, y]) => {
        expect(x).toBeDefined();
        expect(y).toBeDefined();
        expect(x).not.toEqual(y);
        calculated++;
        return x + y;
    });
    expect(d()).toBe(46);
    expect(calculated).toBe(1);
    t(3);
    expect(d()).toBe(45);
    expect(calculated).toBe(2);
    s(41);
    expect(d()).toBe(44);
    expect(calculated).toBe(3);
    expect(d()).toBe(44);
    expect(calculated).toBe(3);
});
test("derived value is only affected by dependent signals", () => {
    let calculated = 0;
    const s = signal(42);
    const t = signal(4);
    const u = signal(2);
    const d = derived(s, u, (x, y) => {
        expect(x).toBeDefined();
        expect(y).toBeDefined();
        expect(x).not.toEqual(y);
        calculated++;
        return 2 * x * y;
    });
    expect(d()).toBe(168);
    expect(calculated).toBe(1);
    t(3);
    expect(d()).toBe(168);
    expect(calculated).toBe(1); // not called
    s(43);
    expect(d()).toBe(172);
    expect(calculated).toBe(2);
    u(1)
    expect(d()).toBe(86);
    expect(calculated).toBe(3);
});

test("effect of signal", () => {
    let acted = 0;
    const s = signal(42);
    const e = effect(s, (x) => {
        expect(x).toBeDefined();
        acted++;
    });
    expect(acted).toBe(0);
    e();
    expect(acted).toBe(1);
    s(43);
    expect(acted).toBe(1);
    e();
    expect(acted).toBe(2);
    e();
    expect(acted).toBe(2);
});
test("effect of N signals", () => {
    let acted = 0;
    const s = signal(42);
    const t = signal(4);
    const e = effect([s, t], ([x, y]) => {
        expect(x).toBeDefined();
        expect(y).toBeDefined();
        expect(x).not.toEqual(y);
        acted++;
    });
    e();
    expect(acted).toBe(1);
    t(3);
    e();
    expect(acted).toBe(2);
    s(41);
    e();
    expect(acted).toBe(3);
    e();
    expect(acted).toBe(3);
});
test("effect is only affected by dependent signals", () => {
    let acted = 0;
    const s = signal(42);
    const t = signal(4);
    const u = signal(2);
    const e = effect(s, u, (x, y) => {
        expect(x).toBeDefined();
        expect(y).toBeDefined();
        expect(x).not.toEqual(y);
        acted++;
    });
    e();
    expect(acted).toBe(1);
    t(3);
    e();
    expect(acted).toBe(1); // not called
    s(43);
    e();
    expect(acted).toBe(2);
    u(1);
    e();
    expect(acted).toBe(3);
});

test("recalculate can do bulk update on N levels derived signals", () => {
    let calculated = 0;
    const s = signal(42);
    const t = signal(4);
    const u = signal(2);
    const a = derived(s, t, u, (x, y, z) => {
        calculated++;
        return `${x}:${y}:${z}`;
    });
    const b = derived(s, t, u, (x, y, z) => {
        calculated++;
        return x + y + z;
    });
    const c = derived(s, t, u, (x, y, z) => {
        calculated++;
        return `${z}:${y}:${x}`;
    });
    const d = derived(a, b, c, (x, y, z) => {
        calculated++;
        return `${x}:${y}:${z}`;
    });
    const e = derived(b, d, (x, y) => {
        calculated++;
        return `${x}:${y}`;
    });
    expect(calculated).toBe(0);
    const r1 = recalculate([a, b, c, d, e]);
    expect(calculated).toBe(5);
    expect(r1[0]).toBe("42:4:2");
    expect(r1[1]).toBe(48);
    expect(r1[2]).toBe("2:4:42");
    expect(r1[3]).toBe("42:4:2:48:2:4:42");
    expect(r1[4]).toBe("48:42:4:2:48:2:4:42");
    const r2 = recalculate([a, b, c, d, e]);
    expect(calculated).toBe(5); // not called
    expect(r2[0]).toBe("42:4:2");
    expect(r2[1]).toBe(48);
    expect(r2[2]).toBe("2:4:42");
    expect(r2[3]).toBe("42:4:2:48:2:4:42");
    expect(r2[4]).toBe("48:42:4:2:48:2:4:42");
});

test("recalculate can do bulk update on N levels derived signals", () => {
    let acted = 0;
    let calculated = 0;
    let r1 = "";
    let r2 = "";
    const s = signal(42);
    const t = signal(4);
    const u = signal(2);
    const a = derived(s, t, u, (x, y, z) => {
        calculated++;
        return `${x}:${y}:${z}`;
    });
    const b = derived(s, t, u, (x, y, z) => {
        calculated++;
        return x + y + z;
    });
    const c = derived(s, t, u, (x, y, z) => {
        calculated++;
        return `${z}:${y}:${x}`;
    });
    const d = effect(a, b, c, (x, y, z) => {
        acted++;
        r1 = `${x}:${y}:${z}`;
    });
    const e = effect(a, b, (x, y) => {
        acted++;
        r2 = `${x}:${y}`;
    });
    expect(acted).toBe(0);
    expect(calculated).toBe(0);
    react([d, e]);
    expect(acted).toBe(2);
    expect(calculated).toBe(3);
    expect(r1).toBe("42:4:2:48:2:4:42");
    expect(r2).toBe("42:4:2:48");
    react([d, e]);
    expect(acted).toBe(2); // not called
    expect(calculated).toBe(3); // not called
    expect(r1).toBe("42:4:2:48:2:4:42");
    expect(r2).toBe("42:4:2:48");
});
