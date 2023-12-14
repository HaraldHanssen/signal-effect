# signal-effect
Reactive signal library without any dependencies.

## The signal library contains three types of primitives:

1. ```signal```

    Contains the source values that can be modified.

2. ```derived``` / ```computed```

    Uses one or more ```signal``` and/or ```derived``` values to calculate a new ```derived``` value.

3. ```effect```

    Uses one or more ```signal``` and/or ```derived``` values to act as triggers on other parts of your system.

## The following set of features:
- **Fixed Dependencies**

    ```derived```s and ```effect```s can take their dependencies up front and get their values as arguments in the callback.

    ```js
    const [s1, s2, s3] = signals(1, 2, 3);
    const d = derived(s1, s2, s3, (x, y, x) => x + y z);
    const c = computed(s1, s2, s3, (x, y, x) => x + y z);
    const e = effect(s1, s2, s3, (x, y, x) => do(x + y z));
    ```

- **Dynamic Dependencies**

    ```derived```s and ```effect```s can use dependencies directly in the callback. This is the most common way of using signals.

    ```js
    const [s1, s2, s3] = signals(1, 2, 3);
    const d = derived(() => s1() + s2() + s3());
    const c = computed(() => s1() + s2() + s3());
    const e = effect(() => do(s1() + s2() + s3()));
    ```

- **Readonly Wrapping**

    ```signal```s can be exposed to consumers as a readonly value.

    ```js
    const s = signal(false);
    s();       //get ok
    s(true);   //set ok
    const r = readonly(s);
    r();       //get ok
    r(false);  //throws error
    ```

- **Object Properties**

    ```signal```s and ```derived```s can be attached as properties to an object. Allows normal get/set coding.

    ```js
    const dialog = {};
    propup(dialog, "name", signal(""));
    dialog.name = "Douglas";  //setter
    const n = dialog.name;    //getter
    ```


- **Object/Array Modification**

    ```signal```s allow internal modification of objects and arrays. Reduces cost of changing complex types.

    ```js
    const author = signal({ name: "Douglas", surname: "" });
    modify(author, x => x.surname = "Adams");
    ```

- **Reentry Prevention**

    Will throw error if a loop is detected, or if a ```derived``` calculation try to write to ```signal```s.
    
    ```effect```s are allowed to write back to the signals again. This allows value feedback loops, a scenario that can trigger recursion. This is prevented by snapshotting. 

- **GC Friendly**

    The library _does not_ store any of the primitives in a global bookkeeping structure. Remove your reference to a primitive and it will (eventually) be collected.
    
    Remember though, dependency references in ```derived``` and ```effect``` still apply. The top nodes need to be unreferenced for the underlying structure to be collected.
    
    GC is unpredictable. With execution strategies other than the default **Manual**, it is necessary to _drop_ the primitives first to prevent unintended execution.


## And several execution handlers:
- **Manual**

    (default) Will not execute ```derived```s and ```effect```s when ```signal```s change. Either call each primitive directly or use the _update_ method on an array of them.

- **Immediate**

    Will execute dependent ```derived```s and ```effect```s immediately when a signal is set.

- **Delayed**

    Gathers all affected ```derived```s and ```effect```s when ```signal```s change. Execute them at a convenient time when the _update_ method is called.

- **Custom**

    Roll your own strategy. Implement the _ExecutionHandler_ interface, it notifies each ```signal``` change and provides the ```derived```s and ```effect```s that directly depend on it.

## Examples
### Create a signal
```js
const canAccept = signal(false);
console.log(canAccept()); // outputs 'false'
canAccept(true);
console.log(canAccept()); // outputs 'true'
```

### Expose a signal as readonly
```js
const canAccept = signal(false);
const showAccept = readonly(canAccept);
console.log(showAccept()); // outputs 'false'

//showAccept(true); // throws error
console.log(showAccept()); // outputs 'false'

canAccept(true);
console.log(showAccept()); // outputs 'true'
```

### Expose signal as a property on an object
```js
const dialog = {};
propup(dialog, "name", signal(""));

dialog.name = "Douglas";
console.log(dialog.name); // outputs 'Douglas'

const canAccept = signal(false);
propup(dialog, "canAccept", readonly(canAccept));

console.log(dialog.canAccept); // outputs 'false'
dialog.canAccept = true; // throws error, does not contain setter
```

### Modify signal in place
```js
const author = signal({ name: "Douglas", surname: "" });
const fullname = derived(author, x => (x.name + " " + x.surname).trim() );
console.log(fullname()); // outputs 'Douglas'
modify(author, x => x.surname = "Adams");
console.log(fullname()); // outputs 'Douglas Adams'
```

### Derive a new signal from another
```js
const name = signal("Douglas");
const surname = signal("");
const fullname = derived(name, surname, (n, s) => [n,s].join(" ").trim());

console.log(fullname()); // outputs 'Douglas'
surname("Adams");
console.log(fullname()); // outputs 'Douglas Adams'

// derived can also rely on other derived signals
const uppercase = derived(fullname, (f) => f.toUpperCase());
console.log(uppercase()); // outputs 'DOUGLAS ADAMS'

// and it cannot be written to
uppercase("DA"); // throws error, does not contain setter
```

### Create an effect action that triggers when signals change
```js
const a = signal(1);
const b = signal(2);
const c = derived(a, b, (x, y) => 2 * x + y);
const log = effect(c, (x) => console.log(x));
log(); // outputs '4'
log(); // no output, dependent signals are unchanged
a(20);
log(); // outputs '42'
```

### Use immediate execution handler
```js
execution.handler = ImmediateExecution;
const a = signal(1);
const b = signal(2);
const c = derived(a, b, (x, y) => 2 * x + y);
effect(c, (x) => console.log(x)); // outputs '4'
a(20); // outputs '42'
```

### Use delayed execution handler
```js
const handler = DelayedExecution;
execution.handler = handler;
const a = signal(1);
const b = signal(2);
const c = derived(a, b, (x, y) => 2 * x + y);
effect(c, (x) => console.log(x));
update(); // outputs '4'
a(20);
update(); // outputs '42'
```

## Performance
### Layers
Test based on [cellx](https://github.com/Riim/cellx#benchmark) benchmark.

Average of 10 iterations. Results in milliseconds.
| handler\layers  | 10        | 100       | 500       | 1000      | 5000      |
| --------------- | ---------:| ---------:| ---------:| ---------:| ---------:|
| manual (f)      |      0.10 |      0.77 |      3.38 |      4.82 |     36.77 |
| immediate (f)   |      0.11 |      1.17 |      5.89 |     11.86 |     66.33 |
| delayed (f)     |      0.07 |      0.54 |      3.22 |      6.64 |     35.53 |
| manual (d)      |      0.11 |      0.99 |      3.94 |      7.48 |    error* |
| immediate (d)   |      0.12 |      1.36 |      6.49 |     14.03 |     82.46 |
| delayed (d)     |      0.13 |      0.49 |      2.97 |      6.00 |     28.88 |

Node v20.10.0 on Mac Air M1

Notes:
- (f) indicates fixed dependencies. 
- (d) indicates dynamic dependencies. 
- The "manual (d)\5000 error*" is caused by a _maximum call stack exceeded_ exception. Unavoidable in this test with closures that call upon each other.

    Immediate and Delayed are not affected as they execute from the source and outward into the graph. The manual strategy only executes on the point of entry provided to it.

- Immediate is somewhat slower (in this test) since this strategy executes all affected dependencies each time a single change has occurred.

## TODOs
- [ ] Scoped execution handlers.  
- [ ] Scoped create and drop. Track creation of primitives and drop them together.
- [x] Allow internal modification of objects and arrays without set. Avoids the need to reconstruct the entire object/array.
- [x] Automatic dependency discovery for deriveds and effects. Just provide the callback and the rest is figured out.
- [x] Explicit removal of effects and deriveds (drop). Useful in Immediate/Delayed execution.
- [x] Custom execution handlers.
- [x] Support reading (of independent) signals in effect calculations.
- [x] Support writing to signals from effect calculations
- [x] Throw error when setting a readonly signal directly. Should exhibit the same behavior as when it is used as a property.
- ...


## About
Yet another signal library?! This library was created just for the fun of it. I was curious of the "sudden leap" to a signal system in Svelte and Angular, and wanted to see how such a system could be constructed. The big frameworks provide their own signalling. Use them. In other settings this library might be a useful replacement. Try it out if you like.

