/**
 * @license MIT
 * Copyright (c) 2023 Harald Hanssen
 */

/**
 * The primitive base interface is accompanied by an identificator.
*/
export interface Primitive {
    /** 
     * Unique id for use in maps and equality checks. Facades may not be the same but 
     * the id is.
    */
    readonly id: NodeId
}

/**
 * A readable signal supports reading the current value.
 * 
 * A readable signal can be a derived signal or a {@link readonly} facade to a 
 * writable one.
*/
export interface Read<T> extends Primitive {
    /** Value reader */
    (): T
}

/**
 * A writable signal supports writing the next value.
 * 
 * Setting a signal will not immediately trigger any derived signals or effects.
 * 
 * @see Derived on when they are calculated.
*/
export interface Write<T> extends Read<T> {
    /** Value writer */
    (next: T): void,
    /** Metadata */
    readonly write: true
}

/**
 * A derived signal performs a calculation if one or more sources have changed.
 * Derived signals are run by the provided {@link Execution}.
 * 
 * A derived signal will exist as long as there are other derived signals or effects
 * depending on it. To delete a derived signal, all those depending on it must be
 * removed as well. {@link drop} the signal to make sure it never recalculates
 * regardless of chosen execution handler.
*/
export interface Derived<T> extends Read<T> {
}

/**
 * An effect performs an action if one or more sources have changed.
 * Effects are run by the provided {@link Execution}.
 * 
 * An effect is a leaf node in the signal system. To delete an effect, remove
 * the reference(s) to it and it will be gc'ed. {@link drop} the effect to make
 * sure it never reacts regardless of chosen execution handler.
*/
export interface Effect extends Primitive {
    /** Effect action invoker. Will trigger the action if dependencies have changed. */
    (): void
}

/**
 * The interface for handling execution.
 * By default the {@link Manual} is active, it requires manual {@link update}. Switch to a more appropriate
 * execution handler for your scenario.
 **/
export interface Execution {
    /** 
     * Called each time a signal has changed, or when a derived or effect is added.
    */
    changed(changed: Read<any> | Derived<any> | undefined, deriveds: Derived<any>[] | undefined, effects: Effect[] | undefined): void;
}

/** The delayed execution handler stores the affected deriveds and effects and executes them when {@link update} is called. */
export interface DelayedExecution extends Execution {
    /** Updates all affected deriveds and effects since last call. Returns them afterwards. */
    update(): [IterableIterator<Derived<any>>, IterableIterator<Effect>];
}

export interface ManualExecution extends Execution {
    /** Perform bulk update of the provided signals/effects. Only changed signals are propagated through. */
    update(items: Derived<any>[] | Effect[]): void;
}

/**
 * Base class for all signal related errors.
 */
export class SignalError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, SignalError.prototype);
    }
}

/**
 * Thrown if callback is trying to reenter a get or set method of a signal within an effect or derived function.
 * All dependent values must be provided upon declaration.
 */
export class ReentryError extends SignalError {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, ReentryError.prototype);
    }
}

//#region Convenience definitions to simplify function signatures using several signals as parameters
type WriteInitTypes = [any, ...Array<any>] | Array<any>;
type WriteInitValues<T> = { [K in keyof T]: T[K] extends infer U ? Write<U> : never };

type ReadType = Read<any>;
type ReadValue<T> = T extends Read<infer U> ? U : never;
type ReadTypes = [ReadType, ...Array<ReadType>] | Array<ReadType>;
type ReadValues<T> = { [K in keyof T]: T[K] extends Read<infer U> ? U : never };

type ReadProperty<P extends PropertyKey, T> = { readonly [K in P]: T };
type WriteProperty<P extends PropertyKey, T> = { [K in P]: T };
//#endregion

/** Create a single writable signal with the provided initial value. */
export function signal<T>(initial: T): Write<T> {
    return SignalNode.signal<T>(initial);
}

/** Create an array of writable signals with the provided initial value. */
export function signals<P extends WriteInitTypes>(...initials: P): WriteInitValues<P> {
    return initials.map(x => signal(x)) as WriteInitValues<P>;
}

/** 
 * Modify internal properties or elements within a signal and set the result.
 * Useful for large nested objects and array manipulation, where the cost of
 * modification is great.
*/
export function modify<T>(signal: Write<T>, manipulate: (t: T) => void): void {
    SignalNode.modify(signal, manipulate);
}

/** Create a read only signal from an existing signal. */
export function readonly<T>(signal: Write<T>): Read<T> {
    return SignalNode.readonly(signal);
}

/** 
 * Create a derived/calculated signal from one or more sources.
 * 
 * To avoid side effects the calculation function is not allowed to reenter the signal system to:
 * (a) set a value on a writable, or
 * (b) execute an effect.
 * Reading values from signals are allowed.
*/
export function derived<P extends ReadType, T>(r: P, calc: (r: ReadValue<P>) => T): Derived<T>;
export function derived<P1 extends ReadType, P2 extends ReadType, T>
    (r1: P1, r2: P2, calc: (r1: ReadValue<P1>, r2: ReadValue<P2>) => T): Derived<T>;
export function derived<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType, T>
    (r1: P1, r2: P2, r3: P3, calc: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>) => T): Derived<T>;
export function derived<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType, P4 extends ReadType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, calc: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>, r4: ReadValue<P4>) => T): Derived<T>;
export function derived<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType, P4 extends ReadType, P5 extends ReadType, T>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, calc: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>, r4: ReadValue<P4>, r5: ReadValue<P5>) => T): Derived<T>;
export function derived<P extends ReadTypes, T>(sources: P, calc: (values: ReadValues<P>) => T): Derived<T>;
export function derived<T>(calc: () => T): Derived<T>;
export function derived(...args: any[]): any {
    if (args.length < 1) throw new SignalError("Expected at least 1 parameters!");

    function fromArgs(): [ValueNode<any>[], Calculation<any>] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => any);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    return args.length == 1 ? DynamicDerivedNode.derived<any>(args[0]) : FixedDerivedNode.derived<any>(...fromArgs());
}

/**
 * Alias for {@link derived}
 */
export const computed = derived;

/** 
 * Create an effect/action from one or more sources.
 * 
 * To avoid side effects the action function is not allowed to reenter the signal system
 * to manually execute an effect. Reading and writing values to signals are allowed.
*/
export function effect<P extends ReadType>(r: P, act: (r: ReadValue<P>) => void): Effect;
export function effect<P1 extends ReadType, P2 extends ReadType>
    (r1: P1, r2: P2, act: (r1: ReadValue<P1>, r2: ReadValue<P2>) => void): Effect;
export function effect<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType>
    (r1: P1, r2: P2, r3: P3, act: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>) => void): Effect;
export function effect<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType, P4 extends ReadType>
    (r1: P1, r2: P2, r3: P3, r4: P4, act: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>, r4: ReadValue<P4>) => void): Effect;
export function effect<P1 extends ReadType, P2 extends ReadType, P3 extends ReadType, P4 extends ReadType, P5 extends ReadType>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, act: (r1: ReadValue<P1>, r2: ReadValue<P2>, r3: ReadValue<P3>, r4: ReadValue<P4>, r5: ReadValue<P5>) => void): Effect;
export function effect<P extends ReadTypes>(sources: P, act: (values: ReadValues<P>) => void): Effect;
export function effect(act: () => void): Effect;
export function effect(...args: any[]): any {
    if (args.length < 1) throw new SignalError("Expected at least 1 parameters!");

    function fromArgs(): [ValueNode<any>[], Action] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => void);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    return args.length == 1 ? DynamicEffectNode.effect(args[0]) : FixedEffectNode.effect(...fromArgs());
}

/** Transform a signal to become a property on an object. Creates new object if null or undefined. */
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: Write<T>): (O | {}) & WriteProperty<P, T>;
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: Read<T>): (O | {}) & ReadProperty<P, T>;
export function propup(o: any, p: any, s: any): any {
    const m = meta(s);
    if (m._self instanceof EffectNode) throw new SignalError("Expected a writable, readable, or derived signal.");
    if (!(m._self instanceof Node)) throw new SignalError("Not a signal primitive.")
    return def(o ?? {}, p, m.write == true ? { get: s, set: s } : { get: s });
}

/** Drops an effect or derived from execution handling. */
export function drop(effectOrDerived: Effect | Derived<any>) {
    meta<DependentNode>(effectOrDerived)._self.drop();
}

/** Uses {@link Manual} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(items: Derived<any>[] | Effect[]): void;
/** Uses {@link Delayed} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(): [Derived<any>[], Effect[]];
/** Invokes the update method on the provided {@link execution.handler} */
export function update(...args: any[]): any {
    const handler = execution.handler;
    if (handler === Manual) {
        Manual.update(args[0]);
    }
    else if (handler === Delayed) {
        return Delayed.update();
    }
    else if ((handler as any).update) {
        return (handler as any).update(...args);
    }
    else {
        throw new SignalError("No update method on handler.")
    }
}

/** The default execution handler. All deriveds and effects must either be called directly or through the {@link ManualExecution.update} method. */
export const Manual = createManualExecution();
/** Optional execution handler. Calls derived and effects immediately upon change. */
export const Immediate = createImmediateExecution();
/** Optional execution handler. Gathers all deriveds and effects and executes them when the update method is called. */
export const Delayed = createDelayedExecution();

/** The execution handler determines how the execution is performed. Defaults to {@link Manual} */
export const execution = { handler: Manual as Execution };

//#region Internals

//#region Flags and Counters
// Diagnostic
export const diagnostic = {
    enabled: false,
    counters: { notify: 0, notifyDeps: 0, maxHandles: 0 },
    reset: () => {
        diagnostic.counters = { notify: 0, notifyDeps: 0, maxHandles: 0 }
    }
};

// Call tracking
type CallTrackState = { deps: ValueNode<any>[] | undefined, nocall: boolean, nowrite: boolean };
const ERR_CALL = "Calling an effect within a derived/effect callback is not allowed.";
const ERR_WRITE = "Writing to a signal within a derived callback is not allowed";
const ERR_LOOP = "Recursive loop detected";
let track: CallTrackState = { deps: undefined, nocall: false, nowrite: false };
const [enter, handle, exit] = (() => {
    let depth = 0;
    let processing = false;
    const handles = [] as [Node, SequenceNumber][];
    function enter() {
        depth++;
    }
    function handle(n: Node, s: SequenceNumber) {
        handles.push([n, s]);
    }
    function exit() {
        depth--;
        if (depth == 0 && !processing) {
            try {
                processing = true;
                for (let i = 0; i < handles.length; i++) {
                    const [n, s] = handles[i];
                    n.notify(s);
                }
                if (diagnostic?.enabled && diagnostic.counters.maxHandles < handles.length) {
                    diagnostic.counters.maxHandles = handles.length;
                }
                handles.length = 0;
            } finally {
                processing = false;
            }
        }
    }
    return [enter, handle, exit];
})();

// Monotonically increasing id number
type NodeId = number;
const nextId = (() => {
    let seqId: NodeId = 0;
    return () => (++seqId);
})();

// Monotonically increasing sequence number
type SequenceNumber = bigint;
const MIN_SEQ: SequenceNumber = 0n;
const [nextN, currN] = (() => {
    let seqN: SequenceNumber = MIN_SEQ;
    return [() => (++seqN), () => seqN];
})();

// Shorthands
const def = Object.defineProperty;

//#endregion

//#region Execution Handlers
function createManualExecution(): ManualExecution {
    function update(items: Derived<any>[] | Effect[]) {
        for (const x of items) x();
    }

    return { changed: () => { }, update };
}

function createImmediateExecution(): Execution {
    function changed(_: Read<any> | undefined, deriveds: Derived<any>[] | undefined, effects: Effect[] | undefined) {
        if (deriveds) for (const x of deriveds) x();
        if (effects) for (const x of effects) x();
    }
    return { changed };
}

function createDelayedExecution(): DelayedExecution {
    let d = new Map<NodeId, Derived<any>>();
    let e = new Map<NodeId, Effect>();
    function changed(_: Read<any> | undefined, deriveds: Derived<any>[] | undefined, effects: Effect[] | undefined) {
        if (deriveds) for (const x of deriveds) d.set(x.id, x);
        if (effects) for (const x of effects) e.set(x.id, x);
    }
    function update(): [IterableIterator<Derived<any>>, IterableIterator<Effect>] {
        const deriveds = d;
        const effects = e;
        d = new Map();
        e = new Map();
        for (const x of deriveds.values()) x();
        for (const x of effects.values()) x();
        return [deriveds.values(), effects.values()];
    }
    return { changed, update };
}
//#endregion

//#region Nodes and Dependencies
/**
 * Base node for all.
 * @prop {} id Unique node id used for matching and lookup
 * @prop {} current The sequence number representing the current value or effect. 
 * @method link Called by dependent nodes to register itself from execution handling on this node.
 * @method unlink Called by dependent nodes to unregister itself from execution handling on this node.
 * @method notify Called by signal and derived nodes to notify execution handler.
 */
abstract class Node {
    readonly id: NodeId;
    private _current: SequenceNumber;
    protected _in?: Map<NodeId, ValueNode<any>> = undefined;
    protected _out?: Map<NodeId, WeakRef<DependentNode>> = undefined;

    get current() { return this._current; }
    protected set current(v: SequenceNumber) { this._current = v };

    constructor(current: SequenceNumber) {
        this.id = nextId();
        this._current = current;
    }

    notify(current: SequenceNumber) {
        if (diagnostic?.enabled) diagnostic.counters.notify++;
        // Notify execution handler
        const deriveds = [] as Derived<any>[];
        const effects = [] as Effect[];

        // Logic:
        // Traverse out and alert dependants. Stop traversal on nodes that already are alerted.
        // Send this._out to execution handler.

        const traverse = [this] as Node[];
        for (let i = 0; i < traverse.length; i++) {
            const source = traverse[i];
            if (!source._out) continue;
            for (const [k, v] of source._out) {
                let d = v.deref();

                // clean
                if (!d || d.dropped) {
                    source._out!.delete(k);
                    continue;
                }

                // traverse dependencies for alert
                if (d.alert(current)) {
                    if (d instanceof DerivedNode) {
                        traverse.push(d);
                    }
                };

                // gather this._out
                if (i == 0) {
                    if (d instanceof DerivedNode) {
                        deriveds.push(d.asDerived())
                    }
                    if (d instanceof EffectNode) {
                        effects.push(d.asEffect());
                    }
                }
            }
        }

        if (diagnostic?.enabled) diagnostic.counters.notifyDeps += deriveds.length + effects.length;

        const prev = track;
        try {
            track = { deps: undefined, nocall: false, nowrite: false };
            if (this instanceof SignalNode) {
                execution.handler.changed(this.asReadable(), deriveds, effects);
            }
            else if (this instanceof DerivedNode) {
                execution.handler.changed(this.asDerived(), deriveds, effects);
            }
        }
        finally {
            track = prev;
        }
    }

    static link(source: ValueNode<any>, target: DependentNode) {
        target._in!.set(source.id, source);
        (source as Node)._out!.set(target.id, new WeakRef(target));
    }

    static unlink(source: ValueNode<any>, target: DependentNode) {
        target._in!.delete(source.id);
        (source as Node)._out!.delete(target.id);
    }
}

/**
 * The node for writable signals.
 * @method asWritable Wrap node in a writable facade.
 * @method asReadable Wrap node in a readable facade
 * @method value The current value of the given type.
 */
class SignalNode<T> extends Node {
    private _value: T;

    private constructor(value: T) {
        super(nextN());
        this._value = value;
        this._out = new Map();
    }

    asWritable(): Write<T> & Meta<SignalNode<T>> {
        const f = this.wfun.bind(this) as Write<T> & Meta<SignalNode<T>>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        def(f, "write", { value: true, writable: false });
        return f;
    }

    asReadable(): Read<T> & Meta<ValueNode<T>> {
        const f = this.rfun.bind(this) as Read<T> & Meta<SignalNode<T>>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        return f;
    }

    value(): T {
        return this._value;
    }

    private rfun(value?: T): T {
        if (value) throw TypeError("Cannot modify a readonly signal");
        track.deps?.push(this);
        return this._value;
    }

    private wfun(value?: T): T | void {
        if (value == undefined) {
            track.deps?.push(this);
            return this._value;
        };
        if (track.nowrite) throw new ReentryError(ERR_WRITE);
        if (Object.is(this._value, value)) return;
        enter();
        this._value = value;
        this.current = nextN();
        handle(this, this.current);
        exit();
    }

    private mfun(manipulate: (t: T) => void): void {
        if (track.nowrite) throw new ReentryError(ERR_WRITE);
        enter();
        manipulate(this._value);
        this.current = nextN();
        handle(this, this.current);
        exit();
    }

    static signal<T>(initial: T): Write<T> {
        return new SignalNode<T>(initial).asWritable();
    }

    static readonly<T>(signal: Write<T>): Read<T> {
        return SignalNode.toNode(signal).asReadable();
    }

    static modify<T>(signal: Write<T>, manipulate: (t: T) => void): void {
        SignalNode.toNode(signal).mfun(manipulate);
    }

    private static toNode<T>(signal: Write<T>): SignalNode<T> {
        const m = meta<SignalNode<T>>(signal);
        if (!(m._self instanceof SignalNode) || !m.write) {
            throw new SignalError("Expected a writable signal.");
        }
        return m._self;
    }
}

/**
 * Base node for those that depend on others.
 * @prop {} checked The sequence number when it was last checked against dependencies.
 * @prop {} visited The visited flag is used for loop detection.
 * @prop {} dropped True if the node is dropped from execution.
 * @prop {} deps The value dependencies this node directly depends on.
 * @prop {} triggers The writable dependencies that will trigger reevaluation. Derived calculations are filtered out.
 * @method dirty Initiated by signal node to notify reexecution.
 * @method drop Drops the node from further execution.
 */
abstract class DependentNode extends Node {
    protected _dirty: boolean = true;
    protected checked: SequenceNumber;
    protected visited: boolean = false;
    private _dropped: boolean = false;

    get dirty() { return this._dirty; }
    get dropped() { return this._dropped; }

    constructor() {
        super(MIN_SEQ);
        this.checked = MIN_SEQ;
    }

    alert(current: SequenceNumber): boolean {
        const wasDirty = this._dirty;
        this._dirty = current > this.current;
        return wasDirty != this._dirty;
    }

    drop() {
        this._dropped = true;
    }

    protected init(deps: ValueNode<any>[]) {
        for (const dep of deps) {
            Node.link(dep, this);
        }
    }

    protected update(deps: ValueNode<any>[], relink: boolean, notify: boolean) {
        if (relink) {
            for (const dep of this._in!.values()) {
                Node.unlink(dep, this);
            }
            for (const dep of deps) {
                Node.link(dep, this);
                if (dep.current > this.current) this.current = dep.current;
            }
        } else {
            for (const dep of deps) {
                if (dep.current > this.current) this.current = dep.current;
            }
        }

        if (notify) {
            handle(this, this.current);
        }
    }
}

/**
 * The base node for derived signals.    
 * @method asDerived Wrap node in a derived facade. May be called manually via or via an execution handler.
 * @method value The current value of the given type.
 */
abstract class DerivedNode<T> extends DependentNode {
    protected _value?: T;
    constructor() {
        super();
        this._value = undefined;
        this._in = new Map();
        this._out = new Map();
    }

    asDerived(): Derived<T> & Meta<DerivedNode<T>> {
        let f = this.fun.bind(this) as Derived<T> & Meta<DerivedNode<T>>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        return f;
    }

    value(check: SequenceNumber): T {
        if (this.visited) throw new ReentryError(ERR_LOOP);
        track.deps?.push(this);
        if (!this.dropped && check > this.checked) {
            if (this._dirty) {
                try {
                    enter();
                    this.do(check);
                    this._dirty = false;
                } finally {
                    exit();
                }
            }

            this.checked = check;
        }
        return this._value!;
    }

    protected abstract do(check: SequenceNumber): void;

    private fun(v?: T): T {
        if (v) throw TypeError("Cannot modify a derived signal");
        return this.value(currN());
    }
}

/**
 * The node for derived signals with dynamic dependencies.    
 */
class DynamicDerivedNode<T> extends DerivedNode<T> {
    private cb: () => T;

    private constructor(calculation: () => T) {
        super();
        this.cb = calculation;
    }

    protected do(_: SequenceNumber): void {
        const deps = [] as ValueNode<any>[];
        const val = this._value;
        const prev = track;
        try {
            track = { deps, nocall: true, nowrite: true };
            this.visited = true;
            this._value = this.cb();
        }
        finally {
            this.visited = false;
            track = prev;
        }
        this.update(deps, true, !Object.is(val, this.value));
    }

    static derived<T>(calculation: () => T): Derived<T> {
        const d = new DynamicDerivedNode<T>(calculation).asDerived();
        execution.handler.changed(undefined, [d], undefined);
        return d;
    }
}

/**
 * The node for derived signals with fixed dependencies.    
 */
class FixedDerivedNode<T> extends DerivedNode<T> {
    private deps: ValueNode<any>[];
    private cb: Calculation<T>;

    private constructor(dependencies: ValueNode<any>[], calculation: Calculation<T>) {
        super();
        this.deps = dependencies;
        this.cb = calculation;
        this.init(dependencies);
    }

    protected do(check: SequenceNumber): void {
        const values = this.deps.map(x => x.value(check));
        const val = this._value;
        const prev = track;
        try {
            track = { deps: undefined, nocall: true, nowrite: true };
            this.visited = true;
            this._value = this.cb(values);
        }
        finally {
            this.visited = false;
            track = prev;
        }
        this.update(this.deps, false, !Object.is(val, this.value));
    }

    static derived<T>(dependencies: ValueNode<any>[], calculation: Calculation<T>): Derived<T> {
        const d = new FixedDerivedNode<T>(dependencies, calculation).asDerived();
        execution.handler.changed(undefined, [d], undefined);
        return d;
    }
}

/**
 * The base node for effect actions.
 * @method asEffect Wrap node in an effect facade. May be called manually via or via an execution handler.
 */
abstract class EffectNode extends DependentNode {
    constructor() {
        super();
        this._in = new Map();
    }

    asEffect(): Effect & Meta<EffectNode> {
        let f = this.fun.bind(this) as Effect & Meta<EffectNode>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        return f;
    }

    protected abstract do(check: SequenceNumber): void;

    private fun(): void {
        const check = currN();
        if (this.visited) throw new ReentryError(ERR_LOOP);
        if (track.nocall) throw new ReentryError(ERR_CALL);
        if (!this.dropped && check > this.checked) {
            if (this._dirty) {
                try {
                    enter();
                    this.do(check);
                    this._dirty = false;
                } finally {
                    exit();
                }
            }

            this.checked = check;
        }
    }
}

/**
 * The node for effect actions with dynamic dependencies.
 */
class DynamicEffectNode extends EffectNode {
    private cb: () => void;

    private constructor(action: () => void) {
        super();
        this.cb = action;
    }

    protected do(_: SequenceNumber): void {
        const deps = [] as ValueNode<any>[];
        const prev = track;
        try {
            track = { deps, nocall: true, nowrite: false };
            this.visited = true;
            this.cb();
        }
        finally {
            track = prev;
            this.visited = false;
        }
        this.update(deps, true, false);
    }

    static effect(action: () => void): Effect {
        let e = new DynamicEffectNode(action).asEffect();
        execution.handler.changed(undefined, undefined, [e]);
        return e;
    }
}

/**
 * The node for effect actions with fixed dependencies.
 */
class FixedEffectNode extends EffectNode {
    private deps: ValueNode<any>[];
    private cb: Action;

    private constructor(dependencies: ValueNode<any>[], action: Action) {
        super();
        this.deps = dependencies;
        this.cb = action;
        this.init(dependencies);
    }

    protected do(check: SequenceNumber): void {
        const values = this.deps.map(x => x.value(check));
        const prev = track;
        try {
            track = { deps: undefined, nocall: true, nowrite: false };
            this.visited = true;
            this.cb(values);
        }
        finally {
            track = prev;
            this.visited = false;
        }
        this.update(this.deps, false, false);
    }

    static effect(dependencies: ValueNode<any>[], action: Action): Effect {
        let e = new FixedEffectNode(dependencies, action).asEffect();
        execution.handler.changed(undefined, undefined, [e]);
        return e;
    }
}

type ValueNode<T> = SignalNode<T> | DerivedNode<T>;

/** Calculation signature */
type Calculation<T> = (args: any[]) => T;

/** Action signature */
type Action = (args: any[]) => void;

/** 
 * Function metadata.
 * @prop {} id The identifier of the node
 * @prop {} _self The reference field that is added to the function facades. Same as 'this' inside the methods.
 * @prop {} write True if the provided function can be used as a setter
*/
type Meta<F> = {
    id: NodeId,
    _self: F,
    write?: boolean
};

/** Get value node from metadata */
function vnode<T>(signal: Read<T>): ValueNode<T> {
    return meta<ValueNode<T>>(signal)._self;
}

/** Get metadata from a signal function facade */
function meta<F>(signal: any): Meta<F> {
    return signal as Meta<F>;
}
//#endregion
//#endregion