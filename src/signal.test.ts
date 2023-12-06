import { ReentryError, propup, derived, effect, readonly, signal, signals, update } from "./signal";

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

test("calc derived value of 1 signal", () => {
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
test("calc derived value of 2 signals", () => {
    let calculated = 0;
    const [s, t] = signals(42, 4);
    const d = derived(s, t, (x, y) => {
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
test("calc derived value of [N] signals ", () => {
    let calculated = 0;
    const [s, t] = signals(42, 4);
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
test("calc derived value is only triggered by dependent signals", () => {
    let calculated = 0;
    const [s, t, u] = signals(42, 4, 2);
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

test("act effect of 1 signal", () => {
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
test("act effect of 2 signals", () => {
    let acted = 0;
    const [s, t] = signals(42, 4);
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
test("act effect of [N] signals", () => {
    let acted = 0;
    const [s, t] = signals(42, 4);
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
test("act effect is only triggered by dependent signals", () => {
    let acted = 0;
    const [s, t, u] = signals(42, 4, 2);
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

test("update of derived will only trigger once per provided element", () => {
    let calculated = 0;
    const [s, t, u] = signals(42, 4, 2);
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
    update([a, b, c, d, e]);
    expect(calculated).toBe(5);
    expect(a()).toBe("42:4:2");
    expect(b()).toBe(48);
    expect(c()).toBe("2:4:42");
    expect(d()).toBe("42:4:2:48:2:4:42");
    expect(e()).toBe("48:42:4:2:48:2:4:42");
    update([a, b, c, d, e]);
    expect(calculated).toBe(5); // not called
    expect(a()).toBe("42:4:2");
    expect(b()).toBe(48);
    expect(c()).toBe("2:4:42");
    expect(d()).toBe("42:4:2:48:2:4:42");
    expect(e()).toBe("48:42:4:2:48:2:4:42");
});
test("update of derived will trigger for transitive dependency change", () => {
    let calculated = 0;
    const [s, t, u] = signals(42, 4, 2);

    const a = derived(s, t, (x, y) => {
        calculated++;
        return x + y;
    });
    const b = derived(u, (x) => {
        calculated++;
        return 2 * x;
    });
    const c = derived(a, b, (x, y) => {
        calculated++;
        return x + y;
    });
    expect(calculated).toBe(0);
    update([c]);
    expect(calculated).toBe(3);
    expect(a()).toBe(42 + 4);
    expect(b()).toBe(2 * 2);
    expect(c()).toBe(42 + 4 + 2 * 2);
    u(3);
    update([c]);
    expect(calculated).toBe(5); // a is not recalculated
    expect(c()).toBe(42 + 4 + 2 * 3);
    expect(b()).toBe(2 * 3);
    expect(a()).toBe(42 + 4);
});

test("update of effect will only trigger once per provided element", () => {
    let acted = 0;
    let calculated = 0;
    let r1 = "";
    let r2 = "";
    const [s, t, u] = signals(42, 4, 2);
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
    update([d, e]);
    expect(acted).toBe(2);
    expect(calculated).toBe(3);
    expect(r1).toBe("42:4:2:48:2:4:42");
    expect(r2).toBe("42:4:2:48");
    update([d, e]);
    expect(acted).toBe(2); // not called
    expect(calculated).toBe(3); // not called
    expect(r1).toBe("42:4:2:48:2:4:42");
    expect(r2).toBe("42:4:2:48");
});
test("update of effect will trigger for transitive dependency change", () => {
    let acted = 0;
    let calculated = 0;
    let r1 = 0;
    const [s, t, u] = signals(42, 4, 2);

    const a = derived(s, t, (x, y) => {
        calculated++;
        return x + y;
    });
    const b = derived(u, (x) => {
        calculated++;
        return 2 * x;
    });
    const c = effect(a, b, (x, y) => {
        acted++;
        r1 = x + y;
    });
    expect(calculated).toBe(0);
    update([c]);
    expect(acted).toBe(1);
    expect(calculated).toBe(2);
    expect(a()).toBe(42 + 4);
    expect(b()).toBe(2 * 2);
    expect(r1).toBe(42 + 4 + 2 * 2);
    u(3);
    update([c]);
    expect(calculated).toBe(3); // a is not recalculated
    expect(r1).toBe(42 + 4 + 2 * 3);
    expect(b()).toBe(2 * 3);
    expect(a()).toBe(42 + 4);
});

test("deny reentry in derived calculations", () => {
    const s = signal(42);
    const justCalc = derived(s, (x) => x);
    const justAct = effect(s, () => { });
    const enterGet = derived(s, (x) => x + s());
    const enterSet = derived(s, (x) => {
        s(x);
        return x;
    });
    const enterCalc = derived(s, (_) => justCalc());
    const enterAct = derived(s, (_) => justAct());

    for (let i = 42; i < 45; i++) {
        s(i);
        expect(enterGet).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterSet).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterCalc).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterAct).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
    }

});
test("deny reentry in effect actions", () => {
    const s = signal(42);
    const justCalc = derived(s, (x) => x);
    const justAct = effect(s, () => { });
    const enterGet = effect(s, () => s());
    const enterSet = effect(s, () => s(43));
    const enterCalc = effect(s, () => justCalc());
    const enterAct = effect(s, () => justAct());

    for (let i = 42; i < 45; i++) {
        s(i);
        expect(enterGet).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterSet).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterCalc).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
        expect(enterAct).toThrow(ReentryError);
        expect(justCalc()).toBe(i); // Not denied
    }
});
test("deny readonly wrapping of a derived signal", () => {
    const s = signal(42);
    const a = derived(s, (x) => x);
    expect(() => readonly(a as any)).toThrow(Error);
});

test("allow writable to be transformed to a property", () => {
    const o = propup({}, "signal", signal(42));
    expect(o.signal).toBe(42);
    o.signal = 43;
    expect(o.signal).toBe(43);
});
test("allow readable to be transformed to a property", () => {
    const s = signal(42);
    const o = propup(undefined, "signal", readonly(s));
    expect(o.signal).toBe(42);
    expect(() => (o as any).signal = 43).toThrow(Error);
    s(43);
    expect(o.signal).toBe(43);
});
test("allow derived to be transformed to a property", () => {
    const s = signal(42);
    const o = propup(null, "signal", derived(s, x => x));
    expect(o.signal).toBe(42);
    expect(() => (o as any).signal = 43).toThrow(Error);
    s(43);
    expect(o.signal).toBe(43);
});
test("deny effect to be transformed to a property", () => {
    const s = signal(42);
    expect(() => propup({}, "signal", effect(s, () => {}))).toThrow(Error);
});
