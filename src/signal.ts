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
     * Called each time a writable signal has changed, or when a derived or effect is added.
    */
    changed(changed: ReadableSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined): void;
}

/** The delayed execution handler stores the affected deriveds and effects and executes them when {@link update} is called. */
export interface DelayedExecutionHandler extends ExecutionHandler {
    /** Updates all affected deriveds and effects since last call. Returns them afterwards. */
    update(): [DerivedSignal<any>[], Effect[]];
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
 * Thrown if user is trying to reenter a get or set method of a signal within an effect or derived function.
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
 * To avoid side effects the calculation function is not allowed to reenter the signal system,
 * this means the provided callback must avoid to manually
 * (a) get a value from a writable/readonly/derived signal, or
 * (b) set a value on a writable, or
 * (c) execute an effect.
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
    if (args.length < 2) throw new SignalError("Expected at least 2 parameters!");

    function fromArgs(): [ValueNode<any>[], Calculation<any>] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => any);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    const d = new DerivedNode<any>(...fromArgs()).asDerived();
    execution.handler.changed(undefined, [d], undefined);
    return d;
}

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
export function effect<P extends ReadableSignalTypes>(sources: P, act: (values: ReadableSignalValues<P>) => void): Effect
export function effect(...args: any[]): any {
    if (args.length < 2) throw new SignalError("Expected at least 2 parameters!");

    function fromArgs(): [ValueNode<any>[], Action] {
        if (args.length == 2 && Array.isArray(args[0])) {
            return [args[0].map(vnode), args.slice(-1)[0]];
        }

        const cb = args.slice(-1)[0] as ((...a: any[]) => void);
        return [args.slice(0, -1).map(vnode), (a: any[]) => cb(...a)];
    }

    const e = new EffectNode(...fromArgs()).asEffect();
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
    return Object.defineProperty(o ?? {}, p, m.write == true ? { get: s, set: s } : { get: s });
}

/** Drops an effect or derived from execution handling. */
export function drop(effectOrDerived: Effect | DerivedSignal<any>) {
    meta<DependentNode>(effectOrDerived)._self.drop();
}

/** Uses {@link ManualExecution} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(items: DerivedSignal<any>[] | Effect[]):void;
/** Uses {@link DelayedExecution} to run the provided signals/effects. Only those affected by changed signals are run. */
export function update(): [DerivedSignal<any>[], Effect[]];
/** Invokes the update method on the provided {@link execution.handler} */
export function update(...args: any[]):any
{
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
let denyReentry = false;
let allowReentryReadWrite = false;
const ERR_REENTRY_READ = "Reading a signal manually within a derived/effect callback is not allowed. Pass the signal as a dependency instead.";
const ERR_REENTRY_WRITE = "Writing to a signal within a derived callback is not allowed";

// Monotonically increasing id number
type NodeId = number;
let seqId: NodeId = 0;
function nextId(): NodeId {
    return (++seqId);
}

// Monotonically increasing sequence number
type SequenceNumber = bigint;
const MIN_SEQ: SequenceNumber = 0n;
let seqN: SequenceNumber = MIN_SEQ;

function nextN(): SequenceNumber {
    return (++seqN);
}

export function currN(): SequenceNumber {
    return seqN;
}
//#endregion

//#region Execution Handlers
function createManualExecutionHandler(): ManualExecutionHandler {
    function update(items: DerivedSignal<any>[] | Effect[]) {
        type UpdateNode = Meta<DependentNode> & (() => unknown);
    
        // Precheck the items before they are executed 
        const current = currN();
        (items as UpdateNode[])
            .filter(x => {
                const self = x._self;
                if (current > self.checked) {
                    if (Object.values(self.triggers).some(y => y.current > self.checked)) {
                        return true;
                    }
                    self.checked = current;
                }
                return false;
            })
            .forEach(x => x());
    }
    
    return { changed: () => { }, update };
}

function createImmediateExecutionHandler(): ExecutionHandler {
    function changed(_: ReadableSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        deriveds?.forEach(x => x());
        effects?.forEach(x => x());
    }
    return { changed };
}

function createDelayedExecutionHandler(): DelayedExecutionHandler {
    let d: Record<NodeId, DerivedSignal<any>> = {};
    let e: Record<NodeId, Effect> = {};
    function changed(_: ReadableSignal<any> | undefined, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        if (deriveds) deriveds.forEach(x => d[x.id] = x);
        if (effects) effects.forEach(x => e[x.id] = x);
    }
    function update(): [DerivedSignal<any>[], Effect[]] {
        const deriveds = Object.values(d);
        const effects = Object.values(e);
        deriveds.forEach(x => x());
        effects.forEach(x => x());
        d = {};
        e = {};
        return [deriveds, effects];
    }
    return { changed, update };
}
//#endregion

//#region Nodes and Dependencies
abstract class Node {
    /** Unique node id used for matching and lookup */
    id: number;
    /** 
     * The sequence number representing the current value or effect.
     * For dependent nodes this is the maximum of all its node dependencies
     * when it was last calculated. 
    */
    current: bigint;

    constructor(current: SequenceNumber) {
        this.id = nextId();
        this.current = current;
    }
}

abstract class DependentNode extends Node {
    /** The sequence number when it was last checked against dependencies. */
    checked: SequenceNumber;
    /** The value dependencies this node directly depends on. */
    readonly dependencies: ValueNode<any>[];
    /** 
     * The writable dependencies that will trigger reevaluation.
     * Derived calculations are filtered out.
     */
    readonly triggers: Record<NodeId, SignalNode<any>>;
    private _dropped: boolean = false;

    constructor(dependencies: ValueNode<any>[]) {
        super(MIN_SEQ);
        this.checked = MIN_SEQ;
        this.dependencies = dependencies;

        this.triggers = this.extractTriggers(dependencies);
        Object.values(this.triggers).forEach(x => x.dependents.push(new WeakRef(this)));
    }

    /** True if the node is dropped from execution. */
    get dropped() {
        return this._dropped;
    }

    /** Drops the node from further execution. */
    drop() {
        this._dropped = true;
    }

    /** Extracts the nodes that can trigger changes. */
    private extractTriggers(dependencies: ValueNode<any>[]): Record<NodeId, SignalNode<any>> {
        const triggers = {} as Record<NodeId, SignalNode<any>>;

        for (let i = 0; i < dependencies.length; i++) {
            const x = dependencies[i];
            if (x instanceof DependentNode) {
                Object.assign(triggers, x.triggers, triggers);
            } else if (x instanceof SignalNode) {
                triggers[x.id] = x
            }
        }
        return triggers;
    }
}

class SignalNode<T> extends Node {
    /** The current value of the given type */
    private value: T;
    /** Reverse of triggers */
    readonly dependents: WeakRef<DependentNode>[];

    constructor(value: T) {
        super(nextN());
        this.value = value;
        this.dependents = [];
    }

    /** Wrap node in a writable facade */
    asWritable(): WritableSignal<T> & Meta<SignalNode<T>> {
        const f = this.sgetValue.bind(this) as WritableSignal<T> & Meta<SignalNode<T>>;
        Object.defineProperty(f, "id", { value: this.id, writable: false });
        Object.defineProperty(f, "_self", { value: this, writable: false });
        Object.defineProperty(f, "write", { value: true, writable: false });
        return f;
    }

    /** Wrap node in a readable facade */
    asReadable(): ReadableSignal<T> & Meta<ValueNode<T>> {
        const f = this.getValue.bind(this) as ReadableSignal<T> & Meta<SignalNode<T>>;
        Object.defineProperty(f, "id", { value: this.id, writable: false });
        Object.defineProperty(f, "_self", { value: this, writable: false });
        return f;
    }

    /** Get value from a readonly value node. */
    private getValue(value?: T): T {
        if (value) throw TypeError("Cannot modify a readonly signal");
        if (denyReentry && !allowReentryReadWrite) throw new ReentryError(ERR_REENTRY_READ);
        return this.value;
    }

    /** Get or set value on a writable value node. */
    private sgetValue(value?: T): T | void {
        if (denyReentry && !allowReentryReadWrite) throw new ReentryError(value == undefined ? ERR_REENTRY_READ : ERR_REENTRY_WRITE);
        if (value == undefined) return this.value;
        if (Object.is(this.value, value)) return;
        this.value = value;
        this.current = nextN();

        // Notify execution handler
        const manual = execution.handler === ManualExecution;
        const deriveds = [] as DerivedSignal<any>[];
        const effects = [] as Effect[];
        deref(this.dependents, (d) => {
            if (manual || d.dropped) return;
            if (d instanceof DerivedNode) {
                deriveds.push(d.asDerived())
            }
            if (d instanceof EffectNode) {
                effects.push(d.asEffect());
            }
        });
        if (!manual) {
            execution.handler.changed(this.asReadable(), deriveds, effects);
        }
    }

    _get(): T {
        return this.value;
    }
}

class DerivedNode<T> extends DependentNode {
    /** The current value of the given type */
    private value?: T;
    /** The calculation function to execute when dependencies change */
    private calculation: Calculation<T>;

    constructor(dependencies: ValueNode<any>[], calculation: Calculation<T>) {
        super(dependencies);
        this.value = undefined;
        this.calculation = calculation;
    }
    /** Wrap node in a derived facade */
    asDerived(): DerivedSignal<T> & Meta<DerivedNode<T>> {
        let f = this.calc.bind(this) as DerivedSignal<T> & Meta<DerivedNode<T>>;
        Object.defineProperty(f, "id", { value: this.id, writable: false });
        Object.defineProperty(f, "_self", { value: this, writable: false });
        return f;
    }

    /** Calculates the derived value. May be called manually or via an execution handler */
    private calc(value?: T): T {
        if (value) throw TypeError("Cannot modify a derived signal");
        if (denyReentry && !allowReentryReadWrite) throw new ReentryError(ERR_REENTRY_READ);

        // Store previous state, we might be inside the callback of an effect node.
        const prevDenyReentry = denyReentry;
        const prevAllowReentryReadWrite = allowReentryReadWrite;
        try {
            denyReentry = true;
            allowReentryReadWrite = false;
            return this._calc(currN());
        }
        finally {
            // Restore previous state
            denyReentry = prevDenyReentry;
            allowReentryReadWrite = prevAllowReentryReadWrite;
        }
    }

    /**
     * Performs the dependency checks and calculates if it is outdated.
     * Returns the latest value.
    */
    _calc(check: SequenceNumber): T {
        if (!this.dropped && check > this.checked) {
            const max = Object.values(this.triggers).reduce((x, c) => x.current > c.current ? x : c).current;
            if (max > this.checked) {
                // Changes has occured in the dependencies.
                const values = this.dependencies.map((x) => x instanceof DerivedNode ? x._calc(check) : x._get());

                // Dependencies have changed or this is a new node. Recalculate.
                this.value = this.calculation(values);
                this.current = max;
            }

            // Derived nodes updates the sequence number each time a change check is performed.
            // Since dependencies are fixed, this will filter out unneccessary traversals.
            this.checked = check;
        }
        return this.value!;
    }
}

class EffectNode extends DependentNode {
    /** The user provided action function to execute when dependencies change. */
    private action: Action;

    constructor(dependencies: ValueNode<any>[], action: Action) {
        super(dependencies);
        this.action = action;
    }

    /** Wrap node in an effect facade */
    asEffect(): Effect & Meta<EffectNode> {
        let f = this.act.bind(this) as Effect & Meta<EffectNode>;
        Object.defineProperty(f, "id", { value: this.id, writable: false });
        Object.defineProperty(f, "_self", { value: this, writable: false });
        return f;
    }

    /** Act on the effect. May be called manually or via an execution handler */
    private act(): void {
        if (denyReentry) throw new ReentryError(ERR_REENTRY_READ);
        try {
            denyReentry = true;
            allowReentryReadWrite = true;
            this._act(currN());
        }
        finally {
            denyReentry = false;
            allowReentryReadWrite = false;
        }
    }

    /** Performs the dependency checks and executes the action if it is outdated */
    private _act(check: SequenceNumber): void {
        if (!this.dropped && check > this.checked) {
            const max = Object.values(this.triggers).reduce((x, c) => x.current > c.current ? x : c).current;
            if (max > this.checked) {
                // Changes has occured in the dependencies.
                const values = this.dependencies.map((x) => x instanceof DerivedNode ? x._calc(check) : x._get());

                // Dependencies have changed or this is a new node. React.
                this.action(values);
                this.current = max;
            }

            // Effect nodes updates the sequence number each time a change check is performed.
            // Since dependencies are fixed, this will filter out unneccessary traversals.
            this.checked = check;
        }
    }
}

type ValueNode<T> = SignalNode<T> | DerivedNode<T>;

/** Calculation signature */
type Calculation<T> = (args: any[]) => T;

/** Action signature */
type Action = (args: any[]) => void;

/** Function metadata */
type Meta<F> = {
    /** The identifier of the node */
    id: NodeId,
    /** The reference field that is added to the function facades. Same as 'this' inside the methods. */
    _self: F,
    /** True if the provided function can be used as a setter */
    write?: boolean
};

type Deref<T> = { deref: () => T | undefined };
/** Loops through an array of weak references, cleans out GC'ed items and calls back for the live ones. */
function deref<T>(array: Deref<T>[], callback: (t: T) => void) {
    for (let i = 0; i < array.length; i++) {
        const weak = array[i];
        const inst = weak?.deref();
        if (!inst) {
            // dead
            const end = array.length - 1;
            if (i < end) {
                //more elements after this one, swap in last element
                array[i] = array[end];
            }
            // remove last element
            array.length = end;
            // one step back
            i--;
            continue; // i++;
        }

        callback(inst);
    }
}

/** Get value node from metadata */
function vnode<T>(signal: ReadableSignal<T>): ValueNode<T> {
    return meta<ValueNode<T>>(signal)._self;
}

/** Get metadata from a signal function facade */
function meta<F>(signal: any): Meta<F> {
    return signal as Meta<F>;
}
//#endregion

/** For testing purposes */
export const _private = {
    deref
}

//#endregion