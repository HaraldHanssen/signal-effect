import { derived1, signal } from "./signal";
test("get signal value", () => {
    const s = signal(42);
    expect(s()).toBe(42);
});
test("set signal value", () => {
    const s = signal(42);
    s(43);
    expect(s()).toBe(43);
});
test("get derived value", () => {
    let calculated = 0;
    const s = signal(42);
    const d = derived1(s, (x) => {
        calculated++;
        return 2*x;
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
test("derived value is only affected by dependent signals", () => {
    let calculated = 0;
    const s = signal(42);
    const t = signal(4);
    const d = derived1(s, (x) => {
        calculated++;
        return 2*x;
    });
    expect(d()).toBe(84);
    expect(calculated).toBe(1);
    t(3);
    expect(d()).toBe(84);
    expect(calculated).toBe(1);
    s(43);
    expect(d()).toBe(86);
    expect(calculated).toBe(2);
});
