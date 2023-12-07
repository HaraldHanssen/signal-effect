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

- **Feedback-Loop Prevention**

    Will throw error if ```derived``` calculations and ```effect``` actions try to reenter the signal system and e.g. grab values it does not depend upon.

- **Bulk Update**

    Runs through the provided ```derived``` and ```effect``` primitives and reexecutes their corresponding calculations and actions if they are outdated by their dependencies.

- **GC Friendly**

    The library _does not_ store any of the primitives in some internal bookkeeping structure. Remove your reference to a primitive and it will (eventually) be collected.
    
    Remember, dependency references in ```derived``` and ```effect``` still apply. The top nodes need to be unreferenced for the underlying structure to be collected.

## And a set of (optional) lifecycle support methods:
- **suspend**

    Freezes ```derived``` calculations and ```effect``` actions. Allows add and remove of primitives, read and write of ```signal```s, and read of _frozen_ ```derived```s.

    Accidental execution of ```effect```s will throw error.

- **resume**

    Resets suspension, all activities allowed.

- **update**

    Bulk update of provided primitives. Recommended order is to call it with ```derived``` signals first and then with the ```effect```s.

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

## TODOs
- Support writing to signals from effect calculations
- Return affected signals from the update method 
- (DONE) Throw error when setting a readonly signal directly. Should exhibit the same behavior as when it is used as a property.
- (...)


## Disclaimer
This library was created just for the fun of it. I was curious of the "sudden leap" to a signal system in Svelte and Angular, and wanted to see how such a system could be constructed. This library is tested to the extent of the current 30+ unit tests. It might be useful in some settings or maybe as an inspiration. Try it out if you like.

