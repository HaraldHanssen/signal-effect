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
    return asWritable({ v: nextV(), t: initial });
}

/** Create a read only signal from an existing signal */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    return asReadable((signal as unknown as SignalInfoRef<T>)._self);
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
        const s = args[0].map(x => (x as unknown as SignalInfoRef<any>)._self);
        const d = args.slice(-1)[0] as Calc<any>;
        return asDerived({ s, v: MIN_V, t: undefined, d });
    }

    const s = args.slice(0, -1).map(x => (x as unknown as SignalInfoRef<any>)._self);
    const dd = args.slice(-1)[0] as ((...a:any[]) => any);
    const d = ((a:any[]) => dd(...a)) as Calc<any>;
    return asDerived({ s, v: MIN_V, t: undefined, d });
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
        const s = args[0].map(x => (x as unknown as SignalInfoRef<any>)._self);
        const e = args.slice(-1)[0] as Act;
        return asEffect({ s, v: MIN_V, e });
    }

    const s = args.slice(0, -1).map(x => (x as unknown as SignalInfoRef<any>)._self);
    const ee = args.slice(-1)[0] as ((...a:any[]) => void);
    const e = ((a:any[]) => ee(...a)) as Act;
    return asEffect({ s, v: MIN_V, e });
}

// Internals
// Monotonically increasing version number
type VersionType = bigint;
const MIN_V: VersionType = 0n
let _version: VersionType = MIN_V;
function nextV(): VersionType {
    return (++_version);
}
function currV(): VersionType {
    return _version;
}

function maxV(values: VersionType[]): VersionType {
    let m = MIN_V;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v > m) {
            m = v;
        }
    }
    return m;
}

type Node = {
    /** The version number representing the current value or effect */
    v: VersionType
};

type DependentNode = Node & {
    /** The signal sources */
    s: SignalInfo<any>[]
};

/** Signal information */
type SignalInfo<T> = Node & {
    /** The current value */
    t?: T
};

/** Reference field is added to the facades */
type SignalInfoRef<T> = {
    _self: SignalInfo<T>
};

/** Derived information */
type DerivedInfo<T> = SignalInfo<T> & DependentNode & {
    /** The calculate function */
    d: Calc<T>
};

/** Calculation signature */
type Calc<T> = (args: any[]) => T;

/** Effect information */
type EffectInfo = DependentNode & {
    /** The action */
    e: Act
};

/** Action signature */
type Act = (args: any[]) => void;

/** Wrap info in a writable facade */
function asWritable<T>(info: SignalInfo<T>): WritableSignal<T> & SignalInfoRef<T> {
    const f = (next?: T): any => {
        const self = f._self;
        if (next == undefined) return self.t!;
        if (Object.is(self.t, next)) return;
        self.t = next;
        self.v = nextV();
    };
    f._self = info;
    return f;
}

/** Wrap info in a readable facade */
function asReadable<T>(info: SignalInfo<T>): ReadableSignal<T> & SignalInfoRef<T> {
    const f = (_?: T): any => {
        return f._self.t!;
    };
    f._self = info;
    return f;
}

/** Wrap info in a derived facade */
function asDerived<T>(info: DerivedInfo<T>): ReadableSignal<T> & SignalInfoRef<T> {
    const f = (_?: T): any => {
        const self = f._self;
        const cv = currV();
        if (cv > self.v) {
            //Changes has occured. Check dependencies.
            const m = maxV(self.s.map(x => x.v));
            if (m > self.v) {
                self.t = self.d(self.s.map(x => x.t));
            }
        }
        self.v = cv;
        return self.t!;
    };
    f._self = info;
    return f;
}


/** Wrap info in an effect facade */
function asEffect(info: EffectInfo): Effect {
    const f = (): void => {
        const self = f._self;
        const cv = currV();
        if (cv > self.v) {
            //Changes has occured. Check dependencies.
            const m = maxV(self.s.map(x => x.v));
            if (m > self.v) {
                self.e(self.s.map(x => x.t));
            }
        }
        self.v = cv;
    };
    f._self = info;
    return f;
}