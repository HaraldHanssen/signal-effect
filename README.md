# signal
Reactive signal library without any dependencies.

## The signal library contains three types of primitives:

1. ```signal``` - contains the source values that can be modified.
2. ```derived``` - uses one or more ```signal``` and/or ```derived``` values to calculate a derived value.
3. ```effect``` - uses one or more ```signal``` and/or ```derived``` values to act as triggers on other parts of your system.

## The following set of features:
- **Readonly Wrapping** - ```signal```s can be exposed to consumers as a readonly value.
- **Object Properties** - ```signal```s and ```derived```s can be attached as properties to an object. Allows normal get/set coding.
- **Feedback-Loop Prevention** - will throw error if ```derived``` calculations and ```effect``` actions try to reenter the signal system and e.g. grab values it does not depend upon.
- **Bulk Update** - runs through the provided ```derived``` and ```effect``` primitives and reexecutes their corresponding calculations and actions if they are outdated by their dependencies.

## And a set of (optional) lifecycle support methods:
- **suspend** - turns off ```derived``` calculations and ```effect``` actions, but still allows add and remove of new primitives as well as read and write of ```signal``` and ```derived```.
- **resume** - resets suspension, all activities allowed.
- **update** - bulk update of primitives e.g. ```derived``` first then ```effect```.

## Disclaimer
This library was created just for the fun of it. I was curious of the sudden leap to a signal system in Svelte and Angular, and wanted to see how such a system could be constructed. This library is only tested to the extent of the current 20+ unit tests. It might be useful though in a simple tool setting or maybe as an inspiration. Try it out if you like.

