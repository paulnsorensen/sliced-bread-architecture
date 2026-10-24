# Depth metrics — definitions as built

Measurement version 1. `scripts/lib/analyze.mjs` implements these definitions.
A change to a definition that changes a number must increment `MEASUREMENT_VERSION`.
The tool then refuses an old baseline until a human re-baselines it.

## Inputs and file classes

- The program is every `.ts`, `.tsx`, `.mts`, and `.cts` file under the `paths` of a `slices.toml` node, without `.d.ts` files and `[policy] ignore` matches. JavaScript files are not measured.
- Module resolution uses `[policy] tsconfig`. Type errors do not stop the analysis.
- A **test file** matches `[policy] test_patterns`. A test file that a production file imports, directly or through other test files, is a production file. All other test files are outside every metric.
- A **crust file** is a file in the slice's `crust` list. An **internal file** is any other production file of the slice.

## Logical statements (M08)

A logical statement is a node of kind `VariableStatement` through `DebuggerStatement` that sits inside the body of a function-like node.
Function-like nodes are function declarations and expressions, arrow functions, methods, constructors, accessors, and class static blocks.
An arrow function with an expression body counts 1.
A nested statement counts separately: an `if` with two statements inside counts 3.

Not logical statements: imports, exports and re-exports, type, interface, and enum declarations, comments, and module-level code.
A catalog table (`export const TABLE = { ... }`) therefore counts 0, except for the bodies of functions inside it.

- `crust_logic_statements`: logical statements in crust files, dead or live.
- `slice_logic_statements`: `crust_logic_statements` plus the logical statements of live internal code.
- `share`: `crust_logic_statements / slice_logic_statements` as an exact fraction. The tool compares fractions by cross-multiplication. A slice with 0 statements has share `0/1`.

**Limit — module initialization.** Module-level executable code (top-level calls, loops, and initializers that call a function) is not in M08 or M10.
The catalog reports it as `module_init` so that a reviewer can see logic that moves to module scope.

## Complexity (M10)

The tool counts complexity on the same syntax tree as M08.
It does not use ESLint, and it does not claim to be equal to the ESLint `complexity` rule.

Each function-like node with a body has complexity 1 plus one per decision point in its own code:
`if`, `?:`, each `case` clause (not `default`), `for`, `for...in`, `for...of`, `while`, `do`, `catch`, `&&`, `||`, `??`, `&&=`, `||=`, `??=`, each optional chain link (`?.`), and each parameter or destructuring default value.
A nested function is its own unit; its decision points are not counted again in the enclosing function.
Declarations without a body (overloads, abstract methods) count 0.

- `crust_complexity`: the sum over crust function-like nodes.
- `slice_complexity`: `crust_complexity` plus the sum over live internal function-like nodes.
- `share`: `crust_complexity / slice_complexity`.

M10 is the share of decision logic in the crust. It is a proxy for a hot path in the crust, not proof of one.

## Dead internal code

Dead internal code is padding. It is not in `slice_logic_statements` or `slice_complexity`.

The analysis builds a reference graph of **units**:

- each function declaration, at any depth;
- each variable declaration whose initializer runs no code when it is evaluated: an arrow function, a function expression, a class expression without static field initializers or static blocks, or an object or array literal without a call, `new`, `await`, or tagged template outside its nested functions; parentheses, `as`, `satisfies`, `!`, and type assertions are looked through;
- each class declaration, which owns its constructor, field initializers, and static blocks;
- each class method and accessor;
- one module-initializer unit per file, which owns the remaining module-level code.

Other code (callbacks, object-literal methods) belongs to the nearest enclosing unit.
So the methods of an unreferenced object literal are dead, and the methods of a referenced one are live.
An edge goes from a unit to each unit that a runtime identifier in its own code resolves to, through import and re-export aliases.
Identifiers in type positions, `import type`, and `implements` clauses make no edge.

Roots: every unit outside the slice, every unit in a crust file, the declaration of every crust export, and the module initializer of each loaded file.
A loaded file is a crust file, a slice file that code outside the slice imports, or a file that a loaded file imports at runtime (including side-effect imports).
An internal unit that no root reaches is dead. A disconnected cycle is dead.

Conservative rules, which keep code live when static analysis cannot see the call:

- A member access (`x.name` or `x['name']`) links to every same-name class method or accessor whose class instance type is assignable to the type of `x`. This covers interfaces, base classes, and structurally compatible classes. A receiver of type `any`, `unknown`, or a type parameter links to every same-name method.
- A class that extends a base outside the measured program keeps all its members live (framework callbacks).

Dynamic forms add no edges. The coverage report below lists them.

Dead crust code is not excluded. It stays in the numerator and in the denominator.
Adding unused crust code must not improve a number. Removing it does improve the numerator.

## Public surface (M09)

M09 counts export slots: one slot per crust file and export name, from the compiler's `getExportsOfModule`.
`export *` is expanded.
Merged declarations and overloads are one slot.
Two crust files that export the same name are two slots.
The catalog splits the count into value, type, and dual (both value and type) exports.

## Exports without external production importers (M12)

M12 counts the crust export slots that no production file outside the slice uses through the crust.
The outside files are the files of the other slices and of the spine nodes.
The brief named "another slice". Spine nodes are included because `app/` is the main consumer of a crust; without them, every export that only `app/` uses would count as unused.

A use goes through the crust module itself:

- a named import whose local binding is referenced (an import that the file never references is not a use);
- a default import that is referenced;
- a namespace import: each `ns.member` or `ns['member']` access is a use of that member; any other use of the namespace uses all exports;
- `export { a } from` and `export { a as b } from` re-exports use `a`; `export *` and `export * as ns` use all exports;
- `import('crust').Name` in a type position uses `Name`; a dynamic `import()` or `import x = require()` uses all exports.

An import of an internal path (a crust bypass) is not a use of a crust export, even when it reaches the same declaration.

## Ratchet keys and comparison

| Key                          | Type     |
| ---------------------------- | -------- |
| `M08.crust_logic_statements` | count    |
| `M08.share`                  | fraction |
| `M09.public_surface`         | count    |
| `M10.crust_complexity`       | count    |
| `M10.share`                  | fraction |
| `M12.unused_exports`         | count    |

Each key is a separate cap per slice. A value above its cap is a regression.
`tighten` lowers each cap separately, so the caps of one slice need not come from one source revision.

## Coverage report

Each slice has a `coverage` record. `check` prints a `coverage:` line for a slice that has an entry.

- `reachability` is `static` or `partial`. `static` means the tool found none of the dynamic forms below. It is not proof of complete runtime reachability.
- `dynamic_access` lists each dynamic form with its `file:line`: an element access whose key type is not a string literal, a `Reflect.*` call, `eval`, `Function`, and `Object.values`, `entries`, `getOwnPropertyNames`, `getOwnPropertyDescriptors`, and `getPrototypeOf`. The tool adds no edges for them, so a member that only they reach is counted dead.
- `unmeasured_files` lists the JavaScript and declaration files under a slice path that slice files import. Their code is in no number.

A key whose type is a string literal, or a union of string literals, resolves by name: `const key = 'render'; obj[key]()` reaches `render`.

## Unsupported input

A crust file that uses `export =` is an input error (exit 2). Its exports are not module export slots, so M09 and M12 would report 0.

## Known gaming routes and limits

- **Reachable padding.** Code that the crust calls is live. It lowers a share. The numerator caps still block crust growth. A cap set from such a share later blocks the removal of the padding. `tighten` therefore holds a share gain whose numerator did not fall (a denominator-driven gain) until a human reruns it with `--accept-denominator-gains`.
- **Conservative roots.** Every crust unit and every unit outside the slice is a root, even when nothing calls it. Internal code that a never-called crust helper, an unused crust object, or a never-called function in a spine file references is therefore live. This is padding that the tool cannot see. A promoted test-pattern file inside the slice is not a root, so a reference from it does not make code live.
- **Share rise from simplification.** Removing live internal code raises a share with no crust change. The tool reports this as a regression with a `denominator-shrink` diagnostic. A human can raise the cap.
- **Module-scope logic.** Logic moved from a crust function to module scope, or to a class field initializer, leaves M08 and M10. `module_init` counts top-level executable statements, top-level initializers that call a function, and static field initializers that are not functions or literals, in top-level class declarations and in class expressions that a top-level variable holds. Static blocks are function bodies, so M08 and M10 count them. Static initializers of a nested class, and all instance field initializers, are in no count. A class declaration is reached by reference, so the static code of an unreferenced class declaration counts as dead.
- **One slot, many operations.** M09 and M12 count top-level export slots. One exported object (`export const api = { a, b, c }`, or `Object.assign(fn, {...})`) is one slot, whatever it holds. The bodies of functions written inside a crust object still count in M08 and M10.
- **Importer, not runtime use.** M12 counts an importer that references the binding anywhere: in a type position, in dead code, or in an `export *` barrel that nothing uses. It does not prove a live downstream consumer.
- **Rename invariance.** A rename keeps every number when it keeps export slots and does not change which methods share a name with a method that a structural access can reach. Same-name linking is limited to classes whose instance type the receiver type admits, so a name shared with an unrelated library type (for example `Array.prototype.some`) does not keep a method live.
- **Mixed languages.** JavaScript and declaration files are not measured. Code that moves into them leaves every number. `coverage.unmeasured_files` names them. The ratchet is not a compiler gate: it does not report type errors, such as executable code in a `.d.ts` file.
- **Map and baseline edits.** Moving a crust path, widening `test_patterns`, renaming a slice, or editing caps changes the measurement. `slices.toml` and `depth-ratchet.json` must be CODEOWNERS-owned. An orphaned baseline slice fails `check`, and `diff-baseline` lists loosening for the reviewer. No command verifies that a human approved a change.
- **Dynamic dispatch.** See the coverage report above.
