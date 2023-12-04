/** A readable signal supports reading the current value */
export interface ReadableSignal<T> {
    (): T,
}

/** A writable signal supports writing the next value */
export interface WritableSignal<T> extends ReadableSignal<T> {
    (next: T): void
}

/** A readable signal type */
export type ReadableSignalType = ReadableSignal<any>;

/** A readable signal value */
export type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;

/** Array of readable signals */
export type ReadableSignals = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;

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
export function derived<P extends ReadableSignalType, T>(r: P, calculate: (r: ReadableSignalValue<P>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, T>
    (r1: P1, r2: P2, calculate: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, calculate: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, calculate: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>) => T): ReadableSignal<T>;
export function derived<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, P5 extends ReadableSignalType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, calculate: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>, r5: ReadableSignalValue<P5>) => T): ReadableSignal<T>;
export function derived<P extends ReadableSignals, T>(sources: P, calculate: (values: ReadableSignalValues<P>) => T): ReadableSignal<T>
export function derived(...args: any[]): any {
    if (args.length < 2) throw Error("Expected at least 2 parameters!");
    const s = (args.length == 2 && Array.isArray(args[0]) ? args[0] : args.slice(0, -1)).map(x => (x as unknown as SignalInfoRef<any>)._self);
    const d = args.slice(-1)[0] as Calc<any>;
    return asDerived({ s, v: MIN_V, t: undefined, d });
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

/** Signal information */
type SignalInfo<T> = {
    /** The version number representing the current value */
    v: VersionType,
    /** The current value */
    t?: T
};

/** Reference field is added to the facades */
type SignalInfoRef<T> = {
    _self: SignalInfo<T>
}

/** Derived information */
type DerivedInfo<T> = SignalInfo<T> & {
    /** The signal sources */
    s: SignalInfo<any>[]
    /** The calculate function */
    d: Calc<T>
}

/** Calculation signature */
type Calc<T> = (...args: any[]) => T;

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