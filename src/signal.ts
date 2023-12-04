/** A readable signal supports reading the signal value */
export interface ReadableSignal<T> {
    (): T,
}

/** A writable signal supports writing a signal value */
export interface WritableSignal<T> extends ReadableSignal<T> {
    (next: T): void
}

/** Signal information */
type Signal<T> = {
    /** The monotonically increasing version */
    v: number,
    /** The current value */
    t: T
};

/** Create a writable signal with the provided initial value */
export function signal<T>(initial: T): WritableSignal<T> {
    function create():Signal<T> {
        return { v: 0, t: initial };
    }
    const s: Signal<T> = create();
    return (next?: T, info?:boolean): any => {
        if (info) return s;
        if (next == undefined) return s.t;
        if (Object.is(s.t, next)) return;
        s.t = next;
        s.v++;
    };
}

interface GetSignalInfo<T> {
    (_:undefined, info:true):Signal<T>;
} 
function info<T>(source:GetSignalInfo<T>):Signal<T> {
    return source(undefined, true);
}

/** Internal types and functions for derived information */
type DerivedCallback<T> = (...args: any[]) => T;
type Derived<T> = {
    /** The signal sources */
    s: Signal<any>[]
    /** The versions of the signals used in the cache */
    v?: number[],
    /** The cached value */
    t?: T,
    /** The calculate function */
    c: DerivedCallback<T>
}

/** Create a derived/calculated signal from multiple sources */
export function derived1<TIn, TOut>(source:ReadableSignal<TIn>, calculate:(source:TIn) => TOut): ReadableSignal<TOut> {
    function create():Derived<TOut> {
        const src = source as GetSignalInfo<TIn>;
        const c:DerivedCallback<TOut> = calculate;
        const s:Signal<any>[] = [info(src)];
        return { s, v: undefined, t: undefined, c };
    }
    const d: Derived<TOut> = create();
    return (_?:TOut, info?:true):any => {
        if (info) return d;
        if (d.v && d.v.every((e,i) => e == d.s[i].v)) return d.t!;
        d.t = d.c(d.s.map(x => x.t));
        d.v = d.s.map(x => x.v);
        return d.t;
    };
}