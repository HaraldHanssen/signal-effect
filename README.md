# signal
Reactive signal library without any dependencies.

## The signal library contains three types of primitives:

1. ```signal```

    Contains the source values that can be modified.

2. ```derived```

    Uses one or more ```signal``` and/or ```derived``` values to calculate a derived value.

3. ```effect```

    Uses one or more ```signal``` and/or ```derived``` values to act as triggers on other parts of your system.

## The following set of features:
- **Readonly Wrapping**

    ```signal```s can be exposed to consumers as a readonly value.

- **Object Properties**

    ```signal```s and ```derived```s can be attached as properties to an object. Allows normal get/set coding.

- **Reentry Prevention**

    Will throw error if ```derived``` calculations actions try to reenter the signal system and e.g. grab values it does not depend upon.
    
    ```effect```s are allowed to manually read and write back to the signals again, this _will not_ cause endless recursion until stack overflow. The calculations and effects are just snapshots. Also, the ```effect``` clause will not react to values only used inside the callback.

- **GC Friendly**

    The library _does not_ store any of the primitives in global bookkeeping structures. Remove your reference to a primitive and it will (eventually) be collected.
    
    Remember though, dependency references in ```derived``` and ```effect``` still apply. The top nodes need to be unreferenced for the underlying structure to be collected.
    
    GC is unpredictable. With execution strategies other than the default **Noop**, it is necessary to _drop_ the primitives first to prevent unintended execution.

- **Bulk Update**

    Runs through the provided ```derived``` and ```effect``` primitives and reexecutes their corresponding calculations and actions if they are outdated by their dependencies. Only relevant with the **Noop** strategy (see below).


## And different execution strategies (handlers):
- **Noop**

    (default) Will not execute ```derived```s and ```effect```s, user must manually invoke the provided bulk update method or call them directly.

- **Immediate**

    Will execute dependent ```derived```s and ```effect```s when a signal is set.

- **Delayed**

    Gathers all affected ```derived```s and ```effect```s when signals change and executes them when the update method is called.

- **Custom**

    Roll your own strategy.

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
handler.update(); // outputs '4'
a(20);
handler.update(); // outputs '42'
```

## TODOs
- [x] Explicit removal of effects and deriveds (drop). Useful in Immediate/Delayed execution.
- [ ] Allow internal modification of objects and arrays without set. Avoids the need to reconstruct the entire object/array.
- [x] Custom execution handlers.
- [x] Support reading (of independent) signals in effect calculations.
- [x] Support writing to signals from effect calculations
- [x] Throw error when setting a readonly signal directly. Should exhibit the same behavior as when it is used as a property.
- ...


## Disclaimer
This library was created just for the fun of it. I was curious of the "sudden leap" to a signal system in Svelte and Angular, and wanted to see how such a system could be constructed. This library is tested to the extent of the current 30+ unit tests. It might be useful in some settings or maybe as an inspiration. Try it out if you like.

