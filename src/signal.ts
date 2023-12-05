/** A readable signal supports reading the current value */
export interface ReadableSignal<T> {
    /** Value reader */
    (): T
}

/** A writable signal supports writing the next value */
export interface WritableSignal<T> extends ReadableSignal<T> {
    /** Value writer */
    (next: T): void
}

/** A derived performs a calculation if one or more sources have changed */
export interface DerivedSignal<T> extends ReadableSignal<T> {
}

/** An effect performs an action if one or more sources have changed */
export interface Effect {
    /** Effect invoker */
    (): void //TODO Give it a name so it does not interfere with the signals
}

/** A readable signal type */
export type ReadableSignalType = ReadableSignal<any>;

/** A readable signal value */
export type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;

/** Array of readable signals */
export type ReadableSignalTypes = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;

/** Array of values from readable signals */
export type ReadableSignalValues<T> = { [K in keyof T]: T[K] extends ReadableSignal<infer U> ? U : never };

/** A derived signal type */
export type DerivedSignalType = DerivedSignal<any>;

/** A derived signal value */
export type DerivedSignalValue<T> = T extends DerivedSignal<infer U> ? U : never;

/** Array of derived signals */
export type DerivedSignalTypes = [DerivedSignalType, ...Array<DerivedSignalType>] | Array<DerivedSignalType>;

/** Array of values from derived signals */
export type DerivedSignalValues<T> = { [K in keyof T]: T[K] extends DerivedSignal<infer U> ? U : never };

/** Create a writable signal with the provided initial value */
export function signal<T>(initial: T): WritableSignal<T> {
    return asWritable(createValueNode(initial));
}

/** Create a read only signal from an existing signal */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    return asReadable(getValueNode(signal));
}

/** Create a derived/calculated signal from one or more sources */
export function derived<P extends ReadableSignalType, T>(r: P, calc: (r: ReadableSignalValue<P>) => T): DerivedSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, T>
    (r1: P1, r2: P2, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>) => T): DerivedSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>) => T): DerivedSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>) => T): DerivedSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, P5 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, calc: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>, r5: ReadableSignalValue<P5>) => T): DerivedSignal<T>;
export function derived<P extends ReadableSignalTypes, T>(sources: P, calc: (values: ReadableSignalValues<P>) => T): DerivedSignal<T>
export function derived(...args: any[]): any {
    if (args.length < 2) throw Error("Expected at least 2 parameters!");
    if (args.length == 2 && Array.isArray(args[0])) {
        return asDerived(createDerivedNode(args[0].map(x => getValueNode(x)), args.slice(-1)[0]));
    }

    const dd = args.slice(-1)[0] as ((...a:any[]) => any);
    return asDerived(createDerivedNode(args.slice(0, -1).map(x => getValueNode(x)), ((a:any[]) => dd(...a))));
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
        return asEffect(createEffectNode(args[0].map(x => getValueNode(x)),args.slice(-1)[0]));
    }

    const ee = args.slice(-1)[0] as ((...a:any[]) => void);
    return asEffect(createEffectNode(args.slice(0, -1).map(x => getValueNode(x)),((a:any[]) => ee(...a))));
}

/**
 * Perform bulk recalculation run of the provided signals. Only changed signals are propagated through. 
 * Use this method at the appropriate time when these updates should occur.
*/
export function recalc<P extends DerivedSignalTypes>(derived: P): DerivedSignalValues<P> {
    return derived.map(x => x()) as DerivedSignalValues<P>;
}

/**
 * Perform bulk reaction run of the provided effects. Only changed signals are propagated through. 
 * Use this method at the appropriate time when these effects should occur.
*/
export function react(effects: Effect[]): void {
    effects.forEach(x => x());
}

// Internals
// Monotonically increasing version number
type NumberType = bigint;
const MIN_N: NumberType = 0n;
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

type MaybeDerivedNode<T> = ValueNode<T> & {
    d?: ValueNode<any>[]
    f?: Calc<T>
}

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

/** Construct a new value node for source signals */
function createValueNode<T>(initial: T): ValueNode<T> {
    return { n: nextN(), v: initial };
}

/** Construct a new derived node with the provided dependencies and calculation callback */
function createDerivedNode<T>(dependencies: ValueNode<any>[], callback: Calc<any>): DerivedNode<T> {
    return { d: dependencies, n: MIN_N, v: undefined, f: callback };
}

/** Construct a new effect node with the provided dependencies and action callback */
function createEffectNode(dependencies: ValueNode<any>[], callback: Act): EffectNode {
    return { d: dependencies, n: MIN_N, f: callback };
}

/** Get value node from signal */
function getValueNode<T>(signal: ReadableSignal<T>): ValueNode<T> {
    return (signal as unknown as Self<ValueNode<T>>)._self;
}

/** Wrap info in a writable facade */
function asWritable<T>(node: ValueNode<T>): WritableSignal<T> & Self<ValueNode<T>> {
    const f = (v?: T): any => {
        const self = f._self;
        if (v == undefined) return self.v!;
        if (Object.is(self.v, v)) return;
        self.v = v;
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
function asDerived<T>(node: DerivedNode<T>): DerivedSignal<T> & Self<DerivedNode<T>> {
    const f = (_?: T): any => {
        return valueOfDerived(f._self);
    };
    f._self = node;
    return f;
}

/** Wrap info in an effect facade */
function asEffect(node: EffectNode): Effect & Self<EffectNode> {
    const f = (): void => {
        actOn(f._self);
    };
    f._self = node;
    return f;
}

/** Performs a dependency check and reacts if necessary */
function actOn(self: EffectNode): void {
    const cn = currN();
    if (cn > self.n) {
        //Changes has occured. Check dependencies.
        const m = maxN(self.d.map(x => x.n));
        if (m == MIN_N || m > self.n) {
            self.f(self.d.map(x => valueOf(x)));
        }
    }
    self.n = cn;
}

/** Gets the value of a derived or value node */
function valueOf<T>(node: MaybeDerivedNode<T>):T {
    return node.f && node.d ? valueOfDerived(node as DerivedNode<T>) : node.v!;
}

/** Get current value of a derived node. Performs a dependency check and recalculates if necessary. */
function valueOfDerived<T>(self: DerivedNode<T>): T {
    const cn = currN();
    if (cn > self.n) {
        //Changes has occured. Check dependencies.
        const m = maxN(self.d.map(x => x.n));
        if (m == MIN_N || m > self.n) {
            self.v = self.f(self.d.map(x => valueOf(x)));
        }
    }
    self.n = cn;
    return self.v!;
}
