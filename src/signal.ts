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
    function create(): DerivedInfo<TOut> {
        const src = source as GetInfo<TIn>;
        const d: Calc<TOut> = calculate;
        const s: SignalInfo<any>[] = [info(src)];
        return { s, v: 0, t: undefined, d };
    }
    const d: DerivedInfo<TOut> = create();
    return (_?: TOut, info?: true): any => {
        if (info) return d;
        const cv = currV();
        if (cv > d.v) {
            //Changes has occured. Check dependencies.
            const m = Math.max(...d.s.map(x => x.v));
            if (m > d.v) {
                d.t = d.d(d.s.map(x => x.t));
            }
        }
        d.v = cv;
        return d.t!;
    };
}

// Internals
// Monotonically increasing version number
let _version = 0;
function nextV(): number {
    return (++_version);
}
function currV(): number {
    return _version;
}

/** Signal information */
type SignalInfo<T> = {
    /** The version number representing the current value */
    v: number,
    /** The current value */
    t?: T
};
type SignalInfoRef<T> = {
    _self: SignalInfo<T>
}

function asWritable<T>(info: SignalInfo<T>): WritableSignal<T> & SignalInfoRef<T> {
    const f = (next?: T, info?: boolean): any => {
        const self = f._self;
        if (info) return self;
        if (next == undefined) return self.t!;
        if (Object.is(self.t, next)) return;
        self.t = next;
        self.v = nextV();
    };
    f._self = info;
    return f;
}

function asReadable<T>(info: SignalInfo<T>): ReadableSignal<T> & SignalInfoRef<T> {
    const f = (_?: T, info?: boolean): any => {
        const self = f._self;
        if (info) return self;
        return self.t!;
    };
    f._self = info;
    return f;
}

interface GetInfo<T> {
    (_: undefined, info: true): SignalInfo<T>;
}

function info<T>(source: GetInfo<T>): SignalInfo<T> {
    return source(undefined, true);
}

/** Derived information */
type Calc<T> = (...args: any[]) => T;
type DerivedInfo<T> = SignalInfo<T> & {
    /** The signal sources */
    s: SignalInfo<any>[]
    /** The calculate function */
    d: Calc<T>
}


