/**
 * @license MIT
 * Copyright (c) 2023 Harald Hanssen
 */

/**
 * A readable signal supports reading the current value.
 * 
 * A readable signal can be a derived signal or a {@link readonly} facade to a 
 * writable one.
*/
export interface ReadableSignal<T> {
    /** Value reader */
    (): T,
    /** 
     * Unique id for use in maps and equality checks. Facades may not be the same but 
     * the id is.
    */
    readonly id: NodeId
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
    (next: T): void,
    /** Metadata */
    readonly write: true
}

/**
 * A derived signal performs a calculation if one or more sources have changed.
 * Derived signals are run by the provided {@link ExecutionHandler}.
 * 
 * A derived signal will exist as long as there are other derived signals or effects
 * depending on it. To delete a derived signal, all those depending on it must be
 * removed as well. {@link drop} the signal to make sure it never recalculates
 * regardless of chosen execution handler.
*/
export interface DerivedSignal<T> extends ReadableSignal<T> {
}

/**
 * An effect performs an action if one or more sources have changed.
 * Effects are run by the provided {@link ExecutionHandler}.
 * 
 * An effect is a leaf node in the signal system. To delete an effect, remove
 * the reference(s) to it and it will be gc'ed. {@link drop} the effect to make
 * sure it never reacts regardless of chosen execution handler.
*/
export interface Effect {
    /** Effect action invoker. Will trigger the action if dependencies have changed. */
    (): void,
    /** 
     * Unique id for use in maps and equality checks. Facades may not be the same but 
     * the id is.
    */
    readonly id: NodeId
}

/**
 * The interface for handling execution.
 * By default the {@link ManualExecution} is active, it requires manual {@link update}. Switch to a more appropriate
 * execution handler for your scenario.
 **/
export interface ExecutionHandler {
    /** 
     * Called each time a signal has changed, or when a derived or effect is added.
    */
    changed(changed: ReadableSignal<any> | DerivedSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined): void;
}

/** The delayed execution handler stores the affected deriveds and effects and executes them when {@link update} is called. */
export interface DelayedExecutionHandler extends ExecutionHandler {
    /** Updates all affected deriveds and effects since last call. Returns them afterwards. */
    update(): [IterableIterator<DerivedSignal<any>>, IterableIterator<Effect>];
}

export interface ManualExecutionHandler extends ExecutionHandler {
    /** Perform bulk update of the provided signals/effects. Only changed signals are propagated through. */
    update(items: DerivedSignal<any>[] | Effect[]): void;
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
type WritableSignalInitTypes = [any, ...Array<any>] | Array<any>;
type WritableSignalInitValues<T> = { [K in keyof T]: T[K] extends infer U ? WritableSignal<U> : never };

type ReadableSignalType = ReadableSignal<any>;
type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;
type ReadableSignalTypes = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;
type ReadableSignalValues<T> = { [K in keyof T]: T[K] extends ReadableSignal<infer U> ? U : never };

type ReadonlyProperty<P extends PropertyKey, T> = { readonly [K in P]: T };
type WritableProperty<P extends PropertyKey, T> = { [K in P]: T };
//#endregion

/** Create a single writable signal with the provided initial value. */
export function signal<T>(initial: T): WritableSignal<T> {
    return new SignalNode<T>(initial).asWritable();
}

/** Create an array of writable signals with the provided initial value. */
export function signals<P extends WritableSignalInitTypes>(...initials: P): WritableSignalInitValues<P> {
    return initials.map(x => signal(x)) as WritableSignalInitValues<P>;
}

/** Create a read only signal from an existing signal. */
export function readonly<T>(signal: WritableSignal<T>): ReadableSignal<T> {
    const m = meta<SignalNode<T>>(signal);
    if (!(m._self instanceof SignalNode)) {
        throw new SignalError("Expected a writable signal.");
    }
    return m._self.asReadable();
}

/** 
 * Create a derived/calculated signal from one or more sources.
 * 
 * To avoid side effects the calculation function is not allowed to reenter the signal system to:
 * (a) set a value on a writable, or
 * (b) execute an effect.
 * Reading values from signals are allowed.
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
export function derived<P extends ReadableSignalTypes, T>(sources: P, calc: (values: ReadableSignalValues<P>) => T): DerivedSignal<T>;
export function derived<T>(calc: () => T): DerivedSignal<T>;
export function derived(...args: any[]): any {
    if (args.length < 1) throw new SignalError("Expected at least 1 parameters!");
    if (args.length == 1) {
        const d = new DynamicDerivedNode<any>(args[0]).asDerived();
        execution.handler.changed(undefined, [d], undefined);
        return d;
    }

    function fromArgs(): [ValueNode<any>[], Calculation<any>] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => any);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    const d = new FixedDerivedNode<any>(...fromArgs()).asDerived();
    execution.handler.changed(undefined, [d], undefined);
    return d;
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
export function effect<P extends ReadableSignalType>(r: P, act: (r: ReadableSignalValue<P>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType>
    (r1: P1, r2: P2, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, r4: P4, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>) => void): Effect;
export function effect<P1 extends ReadableSignalType, P2 extends ReadableSignalType, P3 extends ReadableSignalType, P4 extends ReadableSignalType, P5 extends ReadableSignalType>
    (r1: P1, r2: P2, r3: P3, r4: P4, r5: P5, act: (r1: ReadableSignalValue<P1>, r2: ReadableSignalValue<P2>, r3: ReadableSignalValue<P3>, r4: ReadableSignalValue<P4>, r5: ReadableSignalValue<P5>) => void): Effect;
export function effect<P extends ReadableSignalTypes>(sources: P, act: (values: ReadableSignalValues<P>) => void): Effect;
export function effect(act: () => void): Effect;
export function effect(...args: any[]): any {
    if (args.length < 1) throw new SignalError("Expected at least 1 parameters!");
    if (args.length == 1) {
        const d = new DynamicEffectNode(args[0]).asEffect();
        execution.handler.changed(undefined, [d], undefined);
        return d;
    }

    function fromArgs(): [ValueNode<any>[], Action] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => void);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    const e = new FixedEffectNode(...fromArgs()).asEffect();
    execution.handler.changed(undefined, undefined, [e]);
    return e;
}

/** Transform a signal to become a property on an object. Creates new object if null or undefined. */
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: WritableSignal<T>): (O | {}) & WritableProperty<P, T>;
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: ReadableSignal<T>): (O | {}) & ReadonlyProperty<P, T>;
export function propup(o: any, p: any, s: any): any {
    const m = meta(s);
    if (m._self instanceof EffectNode) throw new SignalError("Expected a writable, readable, or derived signal.");
    if (!(m._self instanceof Node)) throw new SignalError("Not a signal primitive.")
    return def(o ?? {}, p, m.write == true ? { get: s, set: s } : { get: s });
}

/** Drops an effect or derived from execution handling. */
export function drop(effectOrDerived: Effect | DerivedSignal<any>) {
    meta<DependentNode>(effectOrDerived)._self.drop();
}

/** Uses {@link ManualExecution} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(items: DerivedSignal<any>[] | Effect[]): void;
/** Uses {@link DelayedExecution} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(): [DerivedSignal<any>[], Effect[]];
/** Invokes the update method on the provided {@link execution.handler} */
export function update(...args: any[]): any {
    const handler = execution.handler;
    if (handler === ManualExecution) {
        ManualExecution.update(args[0]);
    }
    else if (handler === DelayedExecution) {
        return DelayedExecution.update();
    }
    else if ((handler as any).update) {
        return (handler as any).update(...args);
    }
    else {
        throw new SignalError("No update method on handler.")
    }
}

/** The default execution handler. All deriveds and effects must either be called directly or through the {@link ManualExecutionHandler.update} method. */
export const ManualExecution = createManualExecutionHandler();
/** Optional execution handler. Calls derived and effects immediately upon change. */
export const ImmediateExecution = createImmediateExecutionHandler();
/** Optional execution handler. Gathers all deriveds and effects and executes them when the update method is called. */
export const DelayedExecution = createDelayedExecutionHandler();

/** The execution handler determines how the execution is performed. Defaults to {@link ManualExecution} */
export const execution = { handler: ManualExecution as ExecutionHandler };

//#region Internals

//#region Flags and Counters
// Call tracking
type CallTrackState = { deps: ValueNode<any>[] | undefined, nocall: boolean, nowrite: boolean };
let track: CallTrackState = { deps: undefined, nocall: false, nowrite: false };
const ERR_CALL = "Calling an effect within a derived/effect callback is not allowed.";
const ERR_WRITE = "Writing to a signal within a derived callback is not allowed";
const ERR_LOOP = "Recursive loop detected";

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
function createManualExecutionHandler(): ManualExecutionHandler {
    function update(items: DerivedSignal<any>[] | Effect[]) {
        for (const x of items) x();
    }

    return { changed: () => { }, update };
}

function createImmediateExecutionHandler(): ExecutionHandler {
    //Implemented as a queue to guard against recursive effects.
    let head = 0;
    let tail = 0;
    let queue = [] as [DerivedSignal<any>[] | undefined, Effect[] | undefined][];
    function changed(_: ReadableSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        queue.push([deriveds, effects]);
        tail++;

        // If in progress earlier in the call stact, just return
        if (tail - head > 1) return;

        while (tail > head) {
            const [d, e] = queue[head];
            if (d) for (const x of d) x();
            if (e) for (const x of e) x();
            head++;
        }
        queue.length = 0;
        head = 0;
        tail = 0;
    }
    return { changed };
}

function createDelayedExecutionHandler(): DelayedExecutionHandler {
    let d = new Map<NodeId, DerivedSignal<any>>();
    let e = new Map<NodeId, Effect>();
    function changed(_: ReadableSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        if (deriveds) for (const x of deriveds) d.set(x.id, x);
        if (effects) for (const x of effects) e.set(x.id, x);
    }
    function update(): [IterableIterator<DerivedSignal<any>>, IterableIterator<Effect>] {
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
        // Notify execution handler
        const manual = execution.handler === ManualExecution;
        const deriveds = [] as DerivedSignal<any>[];
        const effects = [] as Effect[];

        const visited = new Set<DerivedNode<any>>();
        const traverse = [this] as Node[];
        while (traverse.length > 0) {
            const source = traverse.pop()!;
            if (!source._out) continue;
            for (const [k, v] of source._out) {
                let d = v.deref();
                if (!d || d.dropped) {
                    source._out.delete(k);
                    continue;
                }
                if (d instanceof DerivedNode) {
                    if (visited.has(d)) {
                        // been here before, ignore.
                        continue;
                    }
                    visited.add(d);
                    traverse.push(d);
                }
                d.dirty(current)
                if (manual) continue;
                if (d instanceof DerivedNode) {
                    deriveds.push(d.asDerived())
                }
                if (d instanceof EffectNode) {
                    effects.push(d.asEffect());
                }
            }
        }
        if (!manual) {
            if (this instanceof SignalNode) {
                execution.handler.changed(this.asReadable(), deriveds, effects);
            }
            else if (this instanceof DerivedNode) {
                execution.handler.changed(this.asDerived(), deriveds, effects);
            }
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

    constructor(value: T) {
        super(nextN());
        this._value = value;
        this._out = new Map();
    }

    asWritable(): WritableSignal<T> & Meta<SignalNode<T>> {
        const f = this.wfun.bind(this) as WritableSignal<T> & Meta<SignalNode<T>>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        def(f, "write", { value: true, writable: false });
        return f;
    }

    asReadable(): ReadableSignal<T> & Meta<ValueNode<T>> {
        const f = this.rfun.bind(this) as ReadableSignal<T> & Meta<SignalNode<T>>;
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
        this._value = value;
        this.current = nextN();
        this.notify(this.current);
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

    get dropped() { return this._dropped; }

    constructor() {
        super(MIN_SEQ);
        this.checked = MIN_SEQ;
    }

    dirty(current: SequenceNumber) {
        this._dirty = current > this.current;
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
                Node.link(dep, this);
                if (dep.current > this.current) this.current = dep.current;
            }
        }

        if (notify) {
            this.notify(this.current);
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

    asDerived(): DerivedSignal<T> & Meta<DerivedNode<T>> {
        let f = this.fun.bind(this) as DerivedSignal<T> & Meta<DerivedNode<T>>;
        def(f, "id", { value: this.id, writable: false });
        def(f, "_self", { value: this, writable: false });
        return f;
    }

    value(check: SequenceNumber): T {
        if (this.visited) throw new ReentryError(ERR_LOOP);
        track.deps?.push(this);
        if (!this.dropped && check > this.checked) {
            if (this._dirty) {
                this.do(check);
                this._dirty = false;
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

    constructor(calculation: () => T) {
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
}

/**
 * The node for derived signals with fixed dependencies.    
 */
class FixedDerivedNode<T> extends DerivedNode<T> {
    private deps: ValueNode<any>[];
    private cb: Calculation<T>;

    constructor(dependencies: ValueNode<any>[], calculation: Calculation<T>) {
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
                this.do(check);
                this._dirty = false;
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

    constructor(action: () => void) {
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
}

/**
 * The node for effect actions with fixed dependencies.
 */
class FixedEffectNode extends EffectNode {
    private deps: ValueNode<any>[];
    private cb: Action;

    constructor(dependencies: ValueNode<any>[], action: Action) {
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
function vnode<T>(signal: ReadableSignal<T>): ValueNode<T> {
    return meta<ValueNode<T>>(signal)._self;
}

/** Get metadata from a signal function facade */
function meta<F>(signal: any): Meta<F> {
    return signal as Meta<F>;
}
//#endregion
//#endregion