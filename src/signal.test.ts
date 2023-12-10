/**
 * @license
 * Copyright (c) 2023 Harald Hanssen

 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import { ReentryError, propup, derived, effect, readonly, signal, signals, update, SignalError, ExecutionHandler, execution, ImmediateExecution, _private, DelayedExecution, drop, ReadableSignal, DelayedExecutionHandler } from "./signal";

const jestConsole = console;

beforeEach(() => {
    global.console = require('console');
});

afterEach(() => {
    global.console = jestConsole;
});

function withHandler(handler: ExecutionHandler, action: () => void) {
    const prev = execution.handler;
    try {
        execution.handler = handler;
        action();
    } finally {
        execution.handler = prev;
    }

}

describe("Basics", () => {
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
        })
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
});

describe("Permissions", () => {
    test("deny readonly wrapping of a derived signal", () => {
        const s = signal(42);
        const a = derived(s, (x) => x);
        expect(() => readonly(a as any)).toThrow(SignalError);
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
    test("deny reentry to execute in effect actions", () => {
        const s = signal(42);
        const justCalc = derived(s, (x) => x);
        const justAct = effect(s, () => { });
        const enterAct = effect(s, () => justAct());

        for (let i = 42; i < 45; i++) {
            s(i);
            expect(justCalc()).toBe(i);
            expect(enterAct).toThrow(ReentryError);
            expect(justCalc()).toBe(i);
        }
    });
    test("allow reentry to read in effect actions", () => {
        // Will not set up dependency
        const s = signal(40);
        const t = signal(2);
        const justCalc = derived(t, (x) => x);
        let enterGetResult = 0;
        const enterGet = effect(s, (x) => enterGetResult = x + t());
        let enterCalcResult = 0;
        const enterCalc = effect(s, (x) => enterCalcResult = x + justCalc());

        for (let i = 42; i < 45; i++) {
            s(i);
            expect(enterGet).not.toThrow(ReentryError);
            expect(enterGetResult).toBe(i + 2);
            expect(enterCalc).not.toThrow(ReentryError);
            expect(enterCalcResult).toBe(i + 2);
        }
    });
    test("allow reentry to write in effect actions (even in a feedback loop)", () => {
        // Writing can be set up as a feedback loop, in some type of calculations this
        // is ok (e.g. integration). The evaluation only samples the effect each execution.

        // In this test setup sourceA affects sourceB and vice versa.
        const iters = 5;
        const expected = [] as { a: number, b: number }[];
        let expSourceA = 1;
        let expSourceB = 1;
        for (let i = 0; i < iters; i++) {
            expSourceB = expSourceA + 1;
            expSourceA = expSourceB + 2;
            expected.push({ a: expSourceA, b: expSourceB });
        }

        const sourceA = signal(1);
        const justCalcA = derived(sourceA, (x) => x + 1);
        const enterSetB = effect(justCalcA, (x) => sourceB(x));
        const sourceB = signal(1);
        const justCalcB = derived(sourceB, (x) => x + 2);
        const enterSetA = effect(justCalcB, (x) => sourceA(x));

        for (let i = 0; i < iters; i++) {
            if (i % 2 > 0) {
                // make sure there are no sideeffects to calling the derived calculations
                // before the effects.
                justCalcA();
                justCalcB();
            }
            expect(enterSetB).not.toThrow(ReentryError);
            expect(enterSetA).not.toThrow(ReentryError);
            expect(sourceA()).toBe(expected[i].a);
            expect(sourceB()).toBe(expected[i].b);
        }
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
        expect(() => propup({}, "signal", effect(s, () => { }))).toThrow(SignalError);
    });
});

describe("Handlers", () => {
    test("immediate handler calculates the derived upon create and change", () => {
        withHandler(ImmediateExecution, () => {
            const [s, t] = signals(0, 2);
            let result = 0;
            derived(s, t, (x, y) => {
                const r = x + y;
                result = r;
                return r;
            });
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(42);
        });
    });
    test("immediate handler acts on the effect upon create and change", () => {
        withHandler(ImmediateExecution, () => {
            const [s, t] = signals(0, 2);
            const sum = derived(s, t, (x, y) => x + y);
            let result = 0;
            effect(sum, (x) => result = x);
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(42);
        });
    });
    test("delayed handler calculates the derived upon update", () => {
        const handler = DelayedExecution;
        withHandler(handler, () => {
            const [s, t] = signals(0, 2);
            let result = 0;
            derived(s, t, (x, y) => {
                const r = x + y;
                result = r;
                return r;
            });
            expect(result).toBe(0);
            handler.update();
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(2);
            handler.update();
            expect(result).toBe(42);
        });
    });
    test("delayed handler acts on the effect upon update", () => {
        const handler = DelayedExecution;
        withHandler(handler, () => {
            const [s, t] = signals(0, 2);
            const sum = derived(s, t, (x, y) => x + y);
            let result = 0;
            effect(sum, (x) => result = x);
            expect(result).toBe(0);
            handler.update();
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(2);
            handler.update();
            expect(result).toBe(42);
        });
    });
    test("drop removes derived from execution handling", () => {
        withHandler(ImmediateExecution, () => {
            const [s, t] = signals(0, 2);
            let result = 0;
            const d = derived(s, t, (x, y) => {
                const r = x + y;
                result = r;
                return r;
            });
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(42);
            drop(d);
            s(20);
            expect(result).toBe(42);
        });
    });
    test("drop removes effect from execution handling", () => {
        withHandler(ImmediateExecution, () => {
            const [s, t] = signals(0, 2);
            const sum = derived(s, t, (x, y) => x + y);
            let result = 0;
            const e = effect(sum, (x) => result = x);
            expect(result).toBe(2);
            s(40);
            expect(result).toBe(42);
            drop(e);
            s(20);
            expect(result).toBe(42);
        });
    });
});

describe("Examples", () => {
    test("example creating a signal", () => {
        const canAccept = signal(false);
        expect(canAccept()).toBe(false);
        canAccept(true);
        expect(canAccept()).toBe(true);
    });
    test("example expose a signal as readonly", () => {
        const canAccept = signal(false);
        const showAccept = readonly(canAccept);
        expect(showAccept()).toBe(false);

        expect(() => (showAccept as any)(true)).toThrow(TypeError);
        expect(showAccept()).toBe(false);

        canAccept(true);
        expect(showAccept()).toBe(true);
    });
    test("example expose signal as a property on an object", () => {
        const dialog = {} as any;
        propup(dialog, "name", signal(""));

        dialog.name = "Douglas";
        expect(dialog.name).toBe("Douglas");

        const canAccept = signal(false);
        propup(dialog, "canAccept", readonly(canAccept));

        expect(dialog.canAccept).toBe(false);
        expect(() => dialog.canAccept = true).toThrow(TypeError);
    });
    test("example derive a new signal from another", () => {
        const name = signal("Douglas");
        const surname = signal("");
        const fullname = derived(name, surname, (n, s) => [n, s].join(" ").trim());

        expect(fullname()).toBe("Douglas");
        surname("Adams");
        expect(fullname()).toBe("Douglas Adams");

        // derived can also rely on other derived signals
        const uppercase = derived(fullname, (f) => f.toUpperCase());
        expect(uppercase()).toBe("DOUGLAS ADAMS");

        // and it cannot be written to
        expect(() => (uppercase as any)("DA")).toThrow(TypeError);
    });
    test("example create an effect action that triggers when signals change", () => {
        let acted = 0;
        let result = 0;
        const a = signal(1);
        const b = signal(2);
        const c = derived(a, b, (x, y) => 2 * x + y);
        const log = effect(c, (x) => {
            acted++;
            result = x;
        });
        log();
        expect(result).toBe(4);
        expect(acted).toBe(1);
        log();
        expect(result).toBe(4);
        expect(acted).toBe(1);
        a(20);
        log();
        expect(result).toBe(42);
        expect(acted).toBe(2);
    });
});

describe("Internals", () => {
    test("deref function removes dead references", () => {
        class Weak {
            v: number;
            deref: () => number | undefined;
            constructor(v: number) {
                this.v = v;
                this.deref = () => (v % 2) > 0 ? v : undefined;
            }
        }

        const empty = [] as Weak[];
        _private.deref(empty, () => { throw Error("called"); });
        expect(empty.length).toBe(0);

        const one_dead = [new Weak(2)];
        _private.deref(one_dead, () => { throw Error("called"); });
        expect(one_dead.length).toBe(0);

        const one_live = [new Weak(1)];
        const one_live_result = [] as number[];
        _private.deref(one_live, (x) => { one_live_result.push(x); });
        expect(one_live.map(x => x.v)).toEqual([1]);
        expect(one_live_result).toEqual([1]);

        const two = [new Weak(1), new Weak(2)];
        const two_result = [] as number[];
        _private.deref(two, (x) => { two_result.push(x); });
        expect(two.map(x => x.v)).toEqual([1]);
        expect(two_result).toEqual([1]);

        const three = [new Weak(1), new Weak(2), new Weak(3)];
        const three_result = [] as number[];
        _private.deref(three, (x) => { three_result.push(x); });
        expect(three.map(x => x.v)).toEqual([1, 3]);
        expect(three_result).toEqual([1, 3]);

        // Order is not important
        const ten = [...Array(10).keys()].map(x => new Weak(x + 1)); // 1 .. 10
        const ten_result = [] as number[];
        _private.deref(ten, (x) => { ten_result.push(x); });
        expect(ten.map(x => x.v)).toEqual([1, 9, 3, 7, 5]);
        expect(ten_result).toEqual([1, 9, 3, 7, 5]);
    });
});

describe("Performance", () => {
    // From https://github.com/maverick-js/signals/blob/main/bench/layers.js
    const SOLUTIONS = {
        10: [2, 4, -2, -3],
        100: [-2, -4, 2, 3], 
        500: [-2, 1, -4, -4],
        1000: [-2, -4, 2, 3],
        2000: [-2, 1, -4, -4],
        2500: [-2, -4, 2, 3],
    } as Record<number, number[]>;

    function run(name: string, layers: number, handler:DelayedExecutionHandler|undefined = undefined):void {
        const start = {
            a: signal(1),
            b: signal(2),
            c: signal(3),
            d: signal(4),
        };

        let layer = start as { 
            a: ReadableSignal<number>,
            b: ReadableSignal<number>,
            c: ReadableSignal<number>,
            d: ReadableSignal<number>,
        };

        for (let i = layers; i--;) {
            layer = ((m) => {
                return {
                    a: derived(m.b, (b) => b),
                    b: derived(m.a, m.c, (a, c) => a - c),
                    c: derived(m.b, m.d, (b, d) => b + d),
                    d: derived(m.c, (c) => c),
                };
            })(layer);
        }

        const startTime = performance.now();

        start.a(4), start.b(3), start.c(2), start.d(1);
        handler?.update();

        const end = layer;
        const solution = [end.a(), end.b(), end.c(), end.d()];
        const endTime = performance.now() - startTime;
        console.log(name, endTime.toFixed(2) + " ms", solution);

        expect(SOLUTIONS[layers]).toEqual(solution);
    }

    Object.keys(SOLUTIONS).forEach(x => {
        const name = `noop ${x} layers`;
        test(name, () => {
            run(name, Number(x));
        });    
    });

    Object.keys(SOLUTIONS).forEach(x => {
        const name = `immediate ${x} layers`;
        test(name, () => {
            withHandler(ImmediateExecution, () => run(name, Number(x)));
        });    
    });

    Object.keys(SOLUTIONS).forEach(x => {
        const name = `delayed ${x} layers`;
        test(name, () => {
            const handler = DelayedExecution;
            withHandler(handler, () => run(name, Number(x), handler));
        });    
    });

});