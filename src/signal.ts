/** A readable signal supports reading the current value */
export interface ReadableSignal<T> {
    (): T,
}

/** A writable signal supports writing the next value */
export interface WritableSignal<T> extends ReadableSignal<T> {
    (next: T): void
}

/** Create a writable signal with the provided initial value */
export function signal<T>(initial: T): WritableSignal<T> {
    return asWritable({ v: nextV(), t: initial });
}

/** Create a read only signal from an existing signal */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    return asReadable((signal as unknown as SignalInfoRef<T>)._self);
}

/** Create a derived/calculated signal from multiple sources */
export function derived1<TIn, TOut>(source: ReadableSignal<TIn>, calculate: (source: TIn) => TOut): ReadableSignal<TOut> {
    return asDerived({ s: [(source as unknown as SignalInfoRef<TIn>)._self], v: MIN_V, t: undefined, d: calculate });
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