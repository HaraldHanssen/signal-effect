/**
 * @license
 * Copyright (c) 2023 Harald Hanssen

 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

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
    (next: T): void,
    /** Metadata */
    readonly write: true
}

/**
 * A derived signal performs a calculation if one or more sources have changed.
 * Either run an array of derived signals in bulk using the {@link update} function,
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
 * Either run an array of effects in bulk using the {@link update} function,
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
    (): void,
    /** Metadata */
    readonly act: true
}

// Convenience definitions to simplify function signatures using several signals as parameters
type WritableSignalInitTypes = [any, ...Array<any>] | Array<any>;
type WritableSignalInitValues<T> = { [K in keyof T]: T[K] extends infer U ? WritableSignal<U> : never };

type ReadableSignalType = ReadableSignal<any>;
type ReadableSignalValue<T> = T extends ReadableSignal<infer U> ? U : never;
type ReadableSignalTypes = [ReadableSignalType, ...Array<ReadableSignalType>] | Array<ReadableSignalType>;
type ReadableSignalValues<T> = { [K in keyof T]: T[K] extends ReadableSignal<infer U> ? U : never };

type ReadonlyProperty<P extends PropertyKey, T> = { readonly [K in P]: T };
type WritableProperty<P extends PropertyKey, T> = { [K in P]: T };


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
    return asReadable(extractValueNode(signal));
}

/** 
 * Create a derived/calculated signal from one or more sources.
 * 
 * To avoid recursion the calculation function is not allowed to reenter the signal system,
 * this means the provided callback must avoid to manually
 * (a) get a value from a writable/readonly/derived signal, or
 * (b) set a value on a writable, or
 * (c) execute an effect.
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
    if (args.length < 2) throw new SignalError("Expected at least 2 parameters!");
    if (args.length == 2 && Array.isArray(args[0])) {
        return asDerived(createDerivedNode(args[0].map(x => extractValueNode(x)), args.slice(-1)[0]));
    }

    const dd = args.slice(-1)[0] as ((...a: any[]) => any);
    return asDerived(createDerivedNode(args.slice(0, -1).map(x => extractValueNode(x)), ((a: any[]) => dd(...a))));
}

/** 
 * Create an effect/action from one or more sources.
 * 
 * To avoid recursion the action function is not allowed to reenter the signal system,
 * this means the provided callback must avoid to manually
 * (a) get a value from a writable/readonly/derived signal, or
 * (b) execute an effect.
 * Writing new values to signals are allowed.
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
    if (args.length < 2) throw new SignalError("Expected at least 2 parameters!");
    if (args.length == 2 && Array.isArray(args[0])) {
        return asEffect(createEffectNode(args[0].map(x => extractValueNode(x)), args.slice(-1)[0]));
    }

    const ee = args.slice(-1)[0] as ((...a: any[]) => void);
    return asEffect(createEffectNode(args.slice(0, -1).map(x => extractValueNode(x)), ((a: any[]) => ee(...a))));
}

/** Transform a signal to become a property on an object. Creates new object if null or undefined. */
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: WritableSignal<T>): (O | {}) & WritableProperty<P, T>;
export function propup<O, P extends PropertyKey, T>(o: O, p: P, s: ReadableSignal<T>): (O | {}) & ReadonlyProperty<P, T>;
export function propup(o: any, p: any, s: any): any {
    const node = extractValueNode(s) as ValueNode<any>;
    if (isEffectNode(node)) throw new SignalError("Expected a writable, readable, or derived signal.");
    return Object.defineProperty(o ?? {}, p, extractWrite(s) ? { get: s, set: s } : { get: s });
}

/**
 * Perform bulk update of the provided signals/effects. Only changed signals are propagated through.
 * Use this method at the appropriate time when these updates should occur. See {@link suspend} for more info.
 */
export function update(items: DerivedSignal<any>[] | Effect[]) {
    type UpdateNode = Meta<DependentNode> & (() => unknown);

    // Precheck the items before they are executed 
    const current = currN();
    (items as UpdateNode[]).filter(x => {
        const self = x._self;
        if (current > self.checked) {
            if (self.triggers.some(y => y.current > self.checked)) {
                return true;
            }
            self.checked = current;
        }
        return false;
    }).forEach(x => x());
}

/**
 * The interface for handling execution.
 * By default the {@link NoopExecution} is active.
 **/
export interface ExecutionHandler {
    /** 
     * Called each time a writable signal has changed, or when a derived or effect is added.
     * Do not modify the signal in this callback!
    */
    changed(changed: WritableSignal<any>, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined): void;
}

/** The delayed execution handler stores the affected deriveds and effects and executes them when @see update is called. */
export interface DelayedExecutionHandler extends ExecutionHandler {
    /** Updates all affected deriveds and effects since last call. Returns them afterwards. */
    update(): [DerivedSignal<any>[], Effect[]];
}

function createNoopExecutionHandler(): ExecutionHandler {
    return { changed: () => {} };
}

function createImmediateExecutionHandler(): ExecutionHandler {
    function changed(_: WritableSignal<any>, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        deriveds?.forEach(x => x());
        effects?.forEach(x => x());
    }
    return { changed };
}

function createDelayedExecutionHandler(): DelayedExecutionHandler {
    let d = [] as DerivedSignal<any>[];
    let e = [] as Effect[];
    function changed(_: WritableSignal<any>, deriveds: DerivedSignal<any>[] | undefined, effects: Effect[] | undefined) {
        if (deriveds) d.push(...deriveds);
        if (effects) e.push(...effects);
    }
    function update(): [DerivedSignal<any>[], Effect[]] {
        const deriveds = d;
        const effects = e;
        deriveds.forEach(x => x());
        effects.forEach(x => x());
        d = [];
        e = [];
        return [deriveds, effects];
    }
    return { changed, update };
}

/** The default execution handler. Does nothing. All deriveds and effects must either be called directly or through the {@link update} method. */
export const NoopExecution = createNoopExecutionHandler();
/** Optional execution handler. Calls derived and effects immediately upon change. */
export const ImmediateExecution = createImmediateExecutionHandler();
/** Optional execution handler. Gathers all deriveds and effects and executes them when the update method is called. */
export const DelayedExecution = createDelayedExecutionHandler();

/** The execution handler determines how the execution is performed. */
export let executionHandler: ExecutionHandler = NoopExecution;

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

// Internals
// Call tracking
let denyReentry = false;
let allowReentryReadWrite = false;
const ERR_REENTRY_READ = "Reading a signal manually within a derived/effect callback is not allowed. Pass the signal as a dependency instead.";
const ERR_REENTRY_WRITE = "Writing to a signal within a derived callback is not allowed";

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

// Node information
type Node = {
    /** 
     * The sequence number representing the current value or effect.
     * For dependent nodes this is the maximum of all its node dependencies
     * when it was last calculated. 
    */
    current: SequenceNumber,
};

type DependentNode = Node & {
    /** The sequence number when it was last checked against dependencies. */
    checked: SequenceNumber,
    /** The value dependencies this node directly depends on. */
    dependencies: ValueNode<any>[],
    /** 
     * The writable dependencies that will trigger reevaluation.
     * Derived calculations are filtered out.
     */
    triggers: ValueNode<any>[]
};

type ValueNode<T> = Node & {
    /** The current value of the given type */
    value?: T
};

type DerivedNode<T> = ValueNode<T> & DependentNode & {
    /** The calculation function to execute when dependencies change */
    calculation: Calculation<T>
};

type EffectNode = DependentNode & {
    /** The action function to execute when dependencies change */
    action: Action
};

/** Calculation signature */
type Calculation<T> = (args: any[]) => T;

/** Action signature */
type Action = (args: any[]) => void;

/** Function metadata */
type Meta<F> = {
    /** The reference field that is added to the function facades. Same as 'this' inside the methods. */
    _self: F,
    /** True if the provided function can be used as a setter */
    write?: boolean,
    /** True if the provided function will execute an effect action */
    act?: boolean
};

/** Traverses the dependency tree and extracts the nodes that will trigger changes to the tree. */
function addWritableDependencies(writables: ValueNode<any>[], dependencies: (ValueNode<any> & Partial<DependentNode>)[]) {
    dependencies.forEach(x => {
        if (x.dependencies) {
            addWritableDependencies(writables, x.dependencies)
        } else {
            writables.push(x);
        }
    });
}

/** Construct a new value node for source signals */
function createValueNode<T>(initial: T): ValueNode<T> {
    return { current: nextN(), value: initial };
}

/** Construct a new derived node with the provided dependencies and calculation callback */
function createDerivedNode<T>(dependencies: ValueNode<any>[], calculation: Calculation<any>): DerivedNode<T> {
    const triggers = [] as ValueNode<any>[];
    addWritableDependencies(triggers, dependencies);
    return { current: MIN_SEQ, checked: MIN_SEQ, value: undefined, dependencies, triggers, calculation };
}

/** Construct a new effect node with the provided dependencies and action callback */
function createEffectNode(dependencies: ValueNode<any>[], action: Action): EffectNode {
    const triggers = [] as ValueNode<any>[];
    addWritableDependencies(triggers, dependencies);
    return { current: MIN_SEQ, checked: MIN_SEQ, dependencies, triggers, action };
}

/** Extract value node from signal metadata */
function extractValueNode<T>(signal: ReadableSignal<T>): ValueNode<T> {
    return (signal as unknown as Meta<ValueNode<T>>)._self;
}

/** Extract write flag from signal metadata */
function extractWrite<T>(signal: ReadableSignal<T>): boolean {
    return (signal as unknown as Meta<ValueNode<T>>).write ?? false;
}

/** Wrap info in a writable facade */
function asWritable<T>(node: ValueNode<T>): WritableSignal<T> & Meta<ValueNode<T>> {
    const f = sgetValue.bind(node) as WritableSignal<T> & Meta<ValueNode<T>>;
    Object.defineProperty(f, "_self", { value: node, writable: false });
    Object.defineProperty(f, "write", { value: true, writable: false });
    return f;
}

/** Wrap info in a readable facade */
function asReadable<T>(node: ValueNode<T>): ReadableSignal<T> & Meta<ValueNode<T>> {
    if (isDerivedNode(node) || isEffectNode(node)) throw new SignalError("Expected a writable signal.");
    const f = getValue.bind(node) as ReadableSignal<T> & Meta<ValueNode<T>>;
    Object.defineProperty(f, "_self", { value: node, writable: false });
    return f;
}

/** Wrap info in a derived facade */
function asDerived<T>(node: DerivedNode<T>): DerivedSignal<T> & Meta<DerivedNode<T>> {
    let f = calcDerivedNode.bind(node) as DerivedSignal<T> & Meta<DerivedNode<T>>;
    Object.defineProperty(f, "_self", { value: node, writable: false });
    return f;
}

/** Wrap info in an effect facade */
function asEffect(node: EffectNode): Effect & Meta<EffectNode> {
    let f = actEffectNode.bind(node) as Effect & Meta<EffectNode>;
    Object.defineProperty(f, "_self", { value: node, writable: false });
    Object.defineProperty(f, "act", { value: true, writable: false });
    return f;
}

function isDerivedNode(node: Partial<DerivedNode<any>>) {
    return node.calculation && node.dependencies;
}

function isEffectNode(node: Partial<EffectNode>) {
    return node.action && node.dependencies;
}

/** 
 * Check dependent nodes for changes and return their latest values. 
*/
function checkDependentNode(self: DependentNode, check: SequenceNumber): any[] {
    return self.dependencies.map((x) => isDerivedNode(x) ? checkDerivedNode(x as DerivedNode<any>, check) : x.value!);
}

/**
 * Performs dependency checks and calculates if it is outdated 
 * Returns the latest value.
*/
function checkDerivedNode<T>(self: DerivedNode<T>, check: SequenceNumber): T {
    if (check > self.checked) {
        const max = self.triggers.reduce((x, c) => x.current > c.current ? x : c).current;
        if (max > self.checked) {
            // Changes has occured in the dependencies.
            const values = checkDependentNode(self, check);

            // Dependencies have changed or this is a new node. Recalculate.
            self.value = self.calculation(values);
            self.current = max;
        }

        // Derived nodes updates the sequence number each time a change check is performed.
        // Since dependencies are fixed, this will filter out unneccessary traversals.
        self.checked = check;
    }
    return self.value!;
}

/** Performs dependency checks and acts if it is outdated */
function checkEffectNode(self: EffectNode, check: SequenceNumber): void {
    if (check > self.checked) {
        const max = self.triggers.reduce((x, c) => x.current > c.current ? x : c).current;
        if (max > self.checked) {
            // Changes has occured in the dependencies.
            const values = checkDependentNode(self, check);

            // Dependencies have changed or this is a new node. React.
            self.action(values);
            self.current = max;
        }

        // Effect nodes updates the sequence number each time a change check is performed.
        // Since dependencies are fixed, this will filter out unneccessary traversals.
        self.checked = check;
    }
}

/** Get value from a readonly value node. */
function getValue<T>(this: ValueNode<T>, value?: T): T {
    if (value) throw TypeError("Cannot modify a readonly signal");
    if (denyReentry && !allowReentryReadWrite) throw new ReentryError(ERR_REENTRY_READ);
    return this.value!;
}

/** Get or set value on a writable value node. */
function sgetValue<T>(this: ValueNode<T>, value?: T): T | void {
    if (denyReentry && !allowReentryReadWrite) throw new ReentryError(value == undefined ? ERR_REENTRY_READ : ERR_REENTRY_WRITE);
    if (value == undefined) return this.value!;
    if (Object.is(this.value, value)) return;
    this.value = value;
    this.current = nextN();
}

/**  Performs a dependency check and calculates if it is outdated. Returns the current value. */
function calcDerivedNode<T>(this: DerivedNode<T>, value?: T): T {
    if (value) throw TypeError("Cannot modify a derived signal");
    if (denyReentry && !allowReentryReadWrite) throw new ReentryError(ERR_REENTRY_READ);

    // Store previous state, we might be inside the callback of an effect node.
    const prevDenyReentry = denyReentry;
    const prevAllowReentryReadWrite = allowReentryReadWrite;
    try {
        denyReentry = true;
        allowReentryReadWrite = false;
        return checkDerivedNode(this, currN());
    }
    finally {
        // Restore previous state
        denyReentry = prevDenyReentry;
        allowReentryReadWrite = prevAllowReentryReadWrite;
    }
}

/** Performs a dependency check and acts if it is outdated. */
function actEffectNode(this: EffectNode): void {
    if (denyReentry) throw new ReentryError(ERR_REENTRY_READ);
    try {
        denyReentry = true;
        allowReentryReadWrite = true;
        checkEffectNode(this, currN());
    }
    finally {
        denyReentry = false;
        allowReentryReadWrite = false;
    }
}
