/**
 * A readable signal supports reading the current value.
 * 
 * A readable signal can be a derived signal or a {@link readonly} facade to a 
 * writable one.
*/
export interface ReadableSignal<T> {
    /** Value reader */
    (): T
}

/**
 * A writable signal supports writing the next value.
 * 
 * Setting a signal will not immediately trigger any derived signals or effects.
 * 
 * @see DerivedSignal on when they are calculated.
*/
export interface WritableSignal<T> extends ReadableSignal<T> {
    /** Value writer */
    (next: T): void
}

/**
 * A derived signal performs a calculation if one or more sources have changed.
 * Either run an array of derived signals in bulk using the {@link recalc} function,
 * or act on them individually through this interface.
 * 
 * No derived signals are run by the library on its own. It is the responsibility of
 * the library user to keep track of all deriveds and schedule them (e.g. on an
 * asynchronous task) to run at a convenient point of time.
 * 
 * A derived signal will exist as long as there are other derived signals or effects
 * depending on it. To delete a derived signal, all those depending on it must be
 * removed as well.
*/
export interface DerivedSignal<T> extends ReadableSignal<T> {
}

/**
 * An effect performs an action if one or more sources have changed.
 * Either run an array of effects in bulk using the {@link react} function,
 * or act on them individually through this interface.
 * 
 * No effects are run by the library on its own. It is the responsibility of
 * the library user to keep track of all effects and schedule them (e.g. on an
 * asynchronous task) to run at a convenient point of time.
 * 
 * An effect is a leaf node in the signal system. To delete an effect, remove
 * the reference(s) to it and it will be gc'ed.
*/
export interface Effect {
    /** Effect action invoker. Will trigger the action if dependencies have changed. */
    (): void
}

// Convenience definitions to simplify function signatures using several signals as parameters
type WritableSignalInitTypes = [any, ...Array<any>] | Array<any>;
type WritableSignalInitValues<T> = { [K in keyof T]: T[K] extends infer U ? WritableSignal<U> : never };

type ReadableSignalType = ReadableSignal<any>;
type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;
type ReadableSignalTypes = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;
type ReadableSignalValues<T> = { [K in keyof T]: T[K] extends ReadableSignal<infer U> ? U : never };

type DerivedSignalType = DerivedSignal<any>;
type DerivedSignalTypes = [DerivedSignalType, ...Array<DerivedSignalType>] | Array<DerivedSignalType>;
type DerivedSignalValues<T> = { [K in keyof T]: T[K] extends DerivedSignal<infer U> ? U : never };

/** Create a single writable signal with the provided initial value. */
export function signal<T>(initial: T): WritableSignal<T> {
    return asWritable(createValueNode(initial));
}

/** Create an array of writable signals with the provided initial value. */
export function signals<P extends WritableSignalInitTypes>(...initials: P): WritableSignalInitValues<P> {
    return initials.map(x => signal(x)) as WritableSignalInitValues<P>;
}

/** Create a read only signal from an existing signal. */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    return asReadable(getSelf(signal));
}

/** 
 * Create a derived/calculated signal from one or more sources.
 * 
 * To avoid feedback loops the calculation function is not allowed to reenter the signal system,
 * this means the provided callback must avoid to manually
 * (a) get a value from a writable/readonly/derived signal, or
 * (b) set a value on a writable, or
 * (c) call act on an effect.
 * Using a delayed reentry with e.g. {@link setTimeout} is allowed but not encouraged; this kind of code can get messy.
*/
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
        return asDerived(createDerivedNode(args[0].map(x => getSelf(x)), args.slice(-1)[0]));
    }

    const dd = args.slice(-1)[0] as ((...a: any[]) => any);
    return asDerived(createDerivedNode(args.slice(0, -1).map(x => getSelf(x)), ((a: any[]) => dd(...a))));
}

/** 
 * Create an effect/action from one or more sources.
 * 
 * To avoid feedback loops the action function is not allowed to reenter the signal system,
 * this means the provided callback must avoid to manually
 * (a) get a value from a writable/readonly/derived signal, or
 * (b) set a value on a writable, or
 * (c) call act on an effect.
 * Using a delayed reentry with e.g. {@link setTimeout} is allowed but not encouraged; this kind of code can get messy.
*/
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
        return asEffect(createEffectNode(args[0].map(x => getSelf(x)), args.slice(-1)[0]));
    }

    const ee = args.slice(-1)[0] as ((...a: any[]) => void);
    return asEffect(createEffectNode(args.slice(0, -1).map(x => getSelf(x)), ((a: any[]) => ee(...a))));
}

/**
 * Perform bulk update of the provided signals/effects. Only changed signals are propagated through.
 * Use this method at the appropriate time when these updates should occur.
 */
export function update(items: Effect[] | DerivedSignal<any>[]) {
    items.forEach(x => x());
}

/**
 * Thrown if user is trying to reenter a get or set method of a signal within an effect or derived function.
 * All dependent values must be provided upon declaration.
 */
export class ReentryError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ReentryError.prototype);
    }
}

// Internals
// Call tracking
let denyReentry = false;
const ERR_READ = "Reading a signal manually within a derived/effect callback is not allowed. Pass the signal as a dependency instead.";
const ERR_WRITE = "Writing to a signal within a derived/effect callback is not allowed";

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
    return { n: MIN_N, v: undefined, d: dependencies, f: callback };
}

/** Construct a new effect node with the provided dependencies and action callback */
function createEffectNode(dependencies: ValueNode<any>[], callback: Act): EffectNode {
    return { n: MIN_N, d: dependencies, f: callback };
}

/** Get value node from signal */
function getSelf<T>(signal: ReadableSignal<T>): ValueNode<T> {
    return (signal as unknown as Self<ValueNode<T>>)._self;
}

/** Wrap info in a writable facade */
function asWritable<T>(node: ValueNode<T>): WritableSignal<T> & Self<ValueNode<T>> {
    const f = sgetValue.bind(node) as WritableSignal<T> & Self<ValueNode<T>>;
    f._self = node;
    return f;
}

/** Wrap info in a readable facade */
function asReadable<T>(node: ValueNode<T>): ReadableSignal<T> & Self<ValueNode<T>> {
    const f = getValue.bind(node) as ReadableSignal<T> & Self<ValueNode<T>>;
    f._self = node;
    return f;
}

/** Wrap info in a derived facade */
function asDerived<T>(node: DerivedNode<T>): DerivedSignal<T> & Self<DerivedNode<T>> {
    let f = calcDerivedNode.bind(node) as DerivedSignal<T> & Self<DerivedNode<T>>;
    f._self = node;
    return f;
}

/** Wrap info in an effect facade */
function asEffect(node: EffectNode): Effect {
    return actEffectNode.bind(node);
}

/** Check dependent nodes for changes and return their latest values. */
function checkDependentNode(self: DependentNode, cn: NumberType): [any[], boolean] {
    let changed = false;
    const values = Array.from(self.d, (v, _) => {
        const node = v as MaybeDerivedNode<any>;
        if (node.f && node.d) {
            // DerivedNode
            const result = checkDerivedNode(v as DerivedNode<any>, cn);
            changed ||= result[1];
            return result[0];
        } else {
            // ValueNode
            // Compare it to own version. If it is newer then it has changed since we
            // last visited the "self" node.
            changed ||= node.n > self.n;
            return node.v!;
        }
    });

    return [values, changed];
}

/** Performs dependency checks and calculates if it is outdated */
function checkDerivedNode<T>(self: DerivedNode<T>, cn: NumberType): [T, boolean] {
    let changed = false;
    if (cn > self.n) {
        // Changes has occured somewhere. Check if any of the dependencies are affected.
        const [values, depChange] = checkDependentNode(self, cn);

        changed ||= self.n == MIN_N;
        changed ||= depChange;
        if (changed) {
            // Dependencies have changed or this is a new node. Recalculate.
            self.v = self.f(values);
        }

        // Derived nodes updates the version number each time a change check is performed.
        // Since dependencies are fixed, this will filter out unneccessary traversals.
        self.n = cn;
    }
    return [self.v!, changed];
}

/** Performs dependency checks and acts if it is outdated */
function checkEffectNode(self: EffectNode, cn: NumberType): void {
    if (cn > self.n) {
        let changed = false;
        // Changes has occured somewhere. Check if any of the dependencies are affected.
        const [values, depChange] = checkDependentNode(self, cn);

        changed ||= self.n == MIN_N;
        changed ||= depChange;
        if (changed) {
            // Dependencies have changed or this is a new node. Recalculate.
            self.f(values);
        }

        // Effect nodes updates the version number each time a change check is performed.
        // Since dependencies are fixed, this will filter out unneccessary traversals.
        self.n = cn;
    }
}

/** Get value from a readonly value node. */
function getValue<T>(this: ValueNode<T>, _?:T) : T {
    if (denyReentry) throw new ReentryError(ERR_READ);
    return this.v!;
}

/** Get or set value on a writable value node. */
function sgetValue<T>(this: ValueNode<T>, v?:T) : T | void {
    if (denyReentry) throw new ReentryError(v == undefined ? ERR_READ : ERR_WRITE);
    if (v == undefined) return this.v!;
    if (Object.is(this.v, v)) return;
    this.v = v;
    this.n = nextN();
}

/**  Performs a dependency check and calculates if it is outdated. Returns the current value. */
function calcDerivedNode<T>(this: DerivedNode<T>, _?:T): T {
    if (denyReentry) throw new ReentryError(ERR_READ);
    try {
        denyReentry = true;
        return checkDerivedNode(this, currN())[0];
    }
    finally {
        denyReentry = false;
    }
}

/** Performs a dependency check and acts if it is outdated. */
function actEffectNode(this: EffectNode): void {
    if (denyReentry) throw new ReentryError(ERR_READ);
    try {
        denyReentry = true;
        checkEffectNode(this, currN());
    }
    finally {
        denyReentry = false;
    }
}
