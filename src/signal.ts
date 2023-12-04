/** A readable signal supports reading the current value */
export interface ReadableSignal<T> {
    (): T
}

/** A writable signal supports writing the next value */
export interface WritableSignal<T> extends ReadableSignal<T> {
    (next: T): void
}

/** An effect performs an action depending on one or more sources if they have changed */
export interface Effect {
    (): void
}

/** A readable signal type */
export type ReadableSignalType = ReadableSignal<any>;

/** A readable signal value */
export type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;

/** Array of readable signals */
export type ReadableSignalTypes = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;

/** Array of values from readable signals */
export type ReadableSignalValues<T> = { [K in keyof T]: T[K] extends ReadableSignal<infer U> ? U : never };

/** Create a writable signal with the provided initial value */
export function signal<T>(initial: T): WritableSignal<T> {
    return asWritable({ n: nextN(), v: initial });
}

/** Create a read only signal from an existing signal */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    return asReadable((signal as unknown as Self<ValueNode<T>>)._self);
}

/** Create a derived/calculated signal from one or more sources */
export function derived<P extends ReadableSignalType, T>(r: P, calc: (r: ReadableSignalValue<P>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, T>
    (r1: P1, r2: P2, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, P5 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>, r5: ReadableSignalValue<P5>) => T): ReadableSignal<T>;
export function derived<P extends ReadableSignalTypes, T>(sources: P, calc: (values: ReadableSignalValues<P>) => T): ReadableSignal<T>
export function derived(...args: any[]): any {
    if (args.length < 2) throw Error("Expected at least 2 parameters!");
    if (args.length == 2 && Array.isArray(args[0])) {
        const s = args[0].map(x => (x as unknown as Self<any>)._self);
        const d = args.slice(-1)[0] as Calc<any>;
        return asDerived({ d: s, n: MIN_N, v: undefined, f: d });
    }

    const s = args.slice(0, -1).map(x => (x as unknown as Self<any>)._self);
    const dd = args.slice(-1)[0] as ((...a:any[]) => any);
    const d = ((a:any[]) => dd(...a)) as Calc<any>;
    return asDerived({ d: s, n: MIN_N, v: undefined, f: d });
}

/** Create an effect/action from one or more sources */
export function effect<P extends ReadableSignalType>(r: P, act: (r: ReadableSignalValue<P>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType>
    (r1: P1, r2: P2, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, r4: P4, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, P5 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>, r5: ReadableSignalValue<P5>) => void): Effect;
export function effect<P extends ReadableSignalTypes>(sources: P, act: (values: ReadableSignalValues<P>) => void): Effect
export function effect(...args: any[]): any {
    if (args.length < 2) throw Error("Expected at least 2 parameters!");
    if (args.length == 2 && Array.isArray(args[0])) {
        const s = args[0].map(x => (x as unknown as Self<any>)._self);
        const e = args.slice(-1)[0] as Act;
        return asEffect({ d: s, n: MIN_N, f: e });
    }

    const s = args.slice(0, -1).map(x => (x as unknown as Self<any>)._self);
    const ee = args.slice(-1)[0] as ((...a:any[]) => void);
    const e = ((a:any[]) => ee(...a)) as Act;
    return asEffect({ d: s, n: MIN_N, f: e });
}

// Internals
// Monotonically increasing version number
type NumberType = bigint;
const MIN_N: NumberType = 0n
let _currN: NumberType = MIN_N;

function nextN(): NumberType {
    return (++_currN);
}

function currN(): NumberType {
    return _currN;
}

function maxN(values: NumberType[]): NumberType {
    let m = MIN_N;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v > m) {
            m = v;
        }
    }
    return m;
}

// Node information
type Node = {
    /** The version number representing the current value or effect */
    n: NumberType
};

type DependentNode = Node & {
    /** The value dependencies */
    d: ValueNode<any>[]
};

type ValueNode<T> = Node & {
    /** The current value of the given type */
    v?: T
};

type DerivedNode<T> = ValueNode<T> & DependentNode & {
    /** The calculation function to execute when dependencies change */
    f: Calc<T>
};

type EffectNode = DependentNode & {
    /** The action function to execute when dependencies change */
    f: Act
};

/** Calculation signature */
type Calc<T> = (args: any[]) => T;

/** Action signature */
type Act = (args: any[]) => void;

type Self<T> = {
    /** The reference field that is added to the facades */
    _self: T
};

/** Wrap info in a writable facade */
function asWritable<T>(node: ValueNode<T>): WritableSignal<T> & Self<ValueNode<T>> {
    const f = (next?: T): any => {
        const self = f._self;
        if (next == undefined) return self.v!;
        if (Object.is(self.v, next)) return;
        self.v = next;
        self.n = nextN();
    };
    f._self = node;
    return f;
}

/** Wrap info in a readable facade */
function asReadable<T>(node: ValueNode<T>): ReadableSignal<T> & Self<ValueNode<T>> {
    const f = (_?: T): any => {
        return f._self.v!;
    };
    f._self = node;
    return f;
}

/** Wrap info in a derived facade */
function asDerived<T>(node: DerivedNode<T>): ReadableSignal<T> & Self<DerivedNode<T>> {
    const f = (_?: T): any => {
        const self = f._self;
        const cn = currN();
        if (cn > self.n) {
            //Changes has occured. Check dependencies.
            const m = maxN(self.d.map(x => x.n));
            if (m > self.n) {
                self.v = self.f(self.d.map(x => x.v));
            }
        }
        self.n = cn;
        return self.v!;
    };
    f._self = node;
    return f;
}


/** Wrap info in an effect facade */
function asEffect(node: EffectNode): Effect & Self<EffectNode> {
    const f = (): void => {
        const self = f._self;
        const cn = currN();
        if (cn > self.n) {
            //Changes has occured. Check dependencies.
            const m = maxN(self.d.map(x => x.n));
            if (m > self.n) {
                self.f(self.d.map(x => x.v));
            }
        }
        self.n = cn;
    };
    f._self = node;
    return f;
}