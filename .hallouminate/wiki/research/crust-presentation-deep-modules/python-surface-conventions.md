# Python public-API-surface conventions for **init**.py

Research date: 2026-08-20. Fetched live from primary sources (PEPs, typing spec, Ruff docs, GitHub raw file contents).

## 1. Authoritative semantics

- **PEP 8** ("Public and internal interfaces"): modules should explicitly declare public API via `__all__`; internal names (packages, modules, classes, functions, attributes) should be prefixed with a single leading underscore even when `__all__` is set correctly. Empty `__all__ = []` signals "no public API." Module-level dunders (`__all__`, `__author__`, `__version__`) go after the docstring, before imports (except `__future__`).
  Source: <https://peps.python.org/pep-0008> (certain)
- **`__all__` is a convention, not an enforcement mechanism.** It only affects `from module import *` and introspection/doc tooling; it does not block `from module import _private`. PEP 844 (draft, Barry Warsaw, created 2026-08-05) proposes `public`/`private` builtins specifically because `__all__` has no runtime access-control teeth.
  Source: <https://peps.python.org/pep-0844> (certain — draft status noted)
- **Typing spec re-export rules** (`typing.python.org/en/latest/spec/distributing.html`, formerly PEP 484/561): an imported symbol is re-exported (part of the public interface) only if:
  1. `import X as X` (redundant module alias), or
  2. `from Y import X as X` (redundant symbol alias), or
  3. `from Y import *` (or bare `from Y import ...` without alias) when `Y` defines `__all__` — re-exports everything in `__all__`; if `Y` has no `__all__`, re-exports all public (non-underscore) symbols in `Y`'s global scope.
     All other imported symbols are private by default to type checkers. This is why FastAPI's `__init__.py` uses `from .applications import FastAPI as FastAPI` (redundant-alias form) for every export — it's the explicit-re-export idiom type checkers expect.
     Source: <https://typing.python.org/en/latest/spec/distributing.html> (certain)
- **py.typed / private-module marking** (same typing spec, PEP 561): a module is private to type checkers either because its filename starts with `_` or because it lives under a package whose name starts with `_`. E.g. `foo._bar`, `foo._bar.baz` are both private.
  Source: <https://docs.basedpyright.com/v1.39.9/usage/typed-libraries> (certain, cross-confirms typing spec)

## 2. Ruff RUF022 (unsorted-dunder-all)

- **What it enforces**: `__all__` entries must follow an "isort-style" sort — SCREAMING_SNAKE_CASE constants first, then CamelCase classes, then everything else, natural-sort within each category. Stable since Ruff 0.8.0.
  Source: <https://docs.astral.sh/ruff/rules/unsorted-dunder-all> (certain)
- **No native support for grouped/sectioned `__all__`.** The rule docs explicitly state: "This is a common pattern used to delimit categories within a module's API, but it would be out of the scope of this rule to attempt to maintain these categories when alphabetically sorting the items of `__all__`." Full-line comments (category headers) do NOT exempt the list from the violation — they only downgrade the _fix_ to "unsafe" (won't auto-apply under plain `--fix`; requires `--unsafe-fixes`), so a bare `ruff check` still flags a grouped, comment-delimited `__all__` as unsorted.
  Source: <https://docs.astral.sh/ruff/rules/unsorted-dunder-all> (certain)
- **Fix-safety mechanics**: fix is unsafe if (a) any comment occupies a whole line inside the `__all__` list, or (b) more than two items share a line with a trailing comment (ambiguous which item the comment belongs to). Otherwise the fix is always considered safe.
  Source: same page (certain)
- **Open GitHub issues (as of fetch, no confirmed resolution)**:
  - astral-sh/ruff#20952 — request to allow sorting `__all__` by _definition order_ instead of alphabetical, explicitly to support grouped/curated ordering. Status: open feature request, not implemented.
  - astral-sh/ruff#14552 — "RUF022 autofix should be marked unsafe if there are own-line comments" (adjacent safety-hardening issue).
    Source: <https://github.com/astral-sh/ruff/issues/20952>, <https://github.com/astral-sh/ruff/issues/14552> (certain that issues exist and are open; speculating on maintainer intent)
- **`noqa` requirement**: the docs don't mention a category-specific suppression; the only way to keep a grouped, non-alphabetical `__all__` under Ruff is a per-line `# noqa: RUF022`, a per-file ignore, or not selecting `RUF` at all. (don't know of a `ruff.toml` option specifically for "sectioned dunder-all" — not documented.)

## 3. Exemplar library `__init__.py` structures (fetched raw from GitHub, current as of 2026-08-20)

### httpx (github.com/encode/httpx, master)

Top-level `__init__.py` is a pure re-export shim: `from ._api import *`, `from ._auth import *`, `from ._client import *`, etc. (star-imports gated by each submodule's own `__all__`), followed by one flat alphabetically-sorted `__all__` list (consistent with RUF022 isort-style — `"__description__"`, `"__title__"`, `"__version__"` first as dunders, then CamelCase classes, alphabetical). Every implementation module in the `httpx` package is underscore-prefixed:

```text
__init__.py  __version__.py  _api.py  _auth.py  _client.py  _config.py
_content.py  _decoders.py  _exceptions.py  _main.py  _models.py
_multipart.py  _status_codes.py  _transports/  _types.py  _urlparse.py
_urls.py  _utils.py  py.typed
```

Only `__init__.py`, `__version__.py`, and `py.typed` are unprefixed — a clean, unambiguous "everything else is internal" signal.
Source: <https://raw.githubusercontent.com/encode/httpx/master/httpx/__init__.py>, <https://api.github.com/repos/encode/httpx/contents/httpx> (certain)

### attrs (github.com/python-attrs/attrs, main, package dir `src/attr/`)

```python
from . import exceptions, setters
from ._cmp import cmp_using
from ._config import get_run_validators, set_run_validators
from ._funcs import asdict, assoc, astuple, has, resolve_types
from ._make import (NOTHING, Attribute, Converter, Factory, _Nothing,
                     attrib, attrs, evolve, fields, fields_dict, make_class, validate)
from ._next_gen import define, field, frozen, mutable
...
__all__ = [
    "NOTHING", "Attribute", "AttrsInstance", "Converter", "Factory",
    "NothingType", "asdict", "assoc", "astuple", "attr", "attrib",
    "attributes", "attrs", "cmp_using", "converters", "define", "evolve",
    "exceptions", "field", "fields", "fields_dict", "filters", "frozen",
    "get_run_validators", "has", "ib", "make_class", "mutable",
    "resolve_types", "s", "set_run_validators", "setters", "validate",
    "validators",
]
```

Flat, fully alphabetical `__all__` (SCREAMING_SNAKE_CASE `NOTHING` first, then CamelCase, then lowercase — exact RUF022 isort-style order), no grouping comments. Uses a `_LAZY_SUBMODULES` + module-level `__getattr__` to lazily import `converters`/`validators`/`filters` submodules on first access — a deep-module technique to keep import cost low while still exposing them at the top level. Also defines `__dir__()` returning `sorted(set(globals()) | set(__all__))` so introspection matches the declared surface.
Source: <https://raw.githubusercontent.com/python-attrs/attrs/main/src/attr/__init__.py> (certain)

### fastapi (github.com/tiangolo/fastapi, master) — 25 lines total

```python
"""FastAPI framework, high performance, easy to learn, fast to code, ready for production"""
__version__ = "0.141.1"
from starlette import status as status
from .applications import FastAPI as FastAPI
from .background import BackgroundTasks as BackgroundTasks
from .datastructures import UploadFile as UploadFile
from .exceptions import HTTPException as HTTPException
from .exceptions import WebSocketException as WebSocketException
from .param_functions import Body as Body
...
```

No `__all__` at all — relies entirely on the typing-spec redundant-alias re-export idiom (`X as X` on every line) for both runtime clarity and static-checker-recognized re-export. Deliberately tiny top-level surface (~19 exported names): the core app class, request/response primitives, and the `param_functions` (Body/Cookie/Depends/File/Form/Header/Path/Query/Security) — supporting types (models, routing internals, middleware) are NOT re-exported at top level; users import those from submodules directly.
Source: <https://raw.githubusercontent.com/tiangolo/fastapi/master/fastapi/__init__.py> (certain)

### pydantic (github.com/pydantic/pydantic, main) — 456 lines

Uses a lazy `__getattr__`-based re-export pattern (via `._migration.getattr_migration`) rather than eager imports: real imports only happen under `if TYPE_CHECKING:` for static analysis/IDE support; at runtime, `__getattr__` resolves names on demand. `__all__` is a large **grouped, comment-delimited tuple, NOT alphabetically sorted**:

```python
__all__ = (
    # dataclasses
    'dataclasses',
    # functional validators
    'field_validator',
    'model_validator',
    'AfterValidator',
    ...
    # JSON Schema
    'WithJsonSchema',
    # deprecated V1 functional validators, these are imported via `__getattr__` below
    'root_validator',
    'validator',
    # functional serializers
    ...
```

~25 named sections (dataclasses, functional validators, JSON Schema, config, errors, fields, alias, main, network, root_model, deprecated tools, types, ...). This directly contradicts RUF022's alphabetical convention — confirmed pydantic's `pyproject.toml` `[tool.ruff.lint] select` list does **not** include `"RUF"` at all (only F, E, I, D, UP, YTT, B, T10, T20, C4, PERF, PIE, and four specific PYI codes), so RUF022 never runs against this file. Also has a per-file-ignore `'pydantic/__init__.py' = ['F405', 'F403', 'D']` for the `TYPE_CHECKING` star-imports.
Source: <https://raw.githubusercontent.com/pydantic/pydantic/main/pydantic/__init__.py>, <https://raw.githubusercontent.com/pydantic/pydantic/main/pyproject.toml> (certain)

### polars

Attempted fetch of `py-polars/polars/__init__.py` via GitHub raw URL and API — both 404'd against `main` branch at this path (package layout likely differs, e.g. `polars/__init__.py` may be code-generated or the repo default branch/path changed). **Not verified** — dropped from exemplar set rather than guessing. (don't know — would need a repo-structure lookup, e.g. `gh api repos/pola-rs/polars/git/trees/main?recursive=1`, to find the actual path.)

## 4. Private-module naming convention

- Underscore-prefixed module filenames (`_client.py`, `_planner.py`) are the standard cross-tooling signal for "internal implementation, not part of the public seam" — confirmed by:
  - PEP 8 §"Public and internal interfaces" (applies the leading-underscore convention to "packages, modules, classes, functions, attributes").
  - The typing spec / PEP 561 py.typed rules, where type checkers treat underscore-prefixed module filenames as private and exclude them from the inferred public interface even without `__all__`.
  - httpx's actual package layout (above) is the clearest real-world instance: every non-`__init__`/`__version__` module is underscore-prefixed.
    Source: <https://peps.python.org/pep-0008>, <https://docs.basedpyright.com/v1.39.9/usage/typed-libraries> (certain)

## 5. "Curated table of contents" guidance

- Real Python's "Single and Double Underscores in Python Names" / "public API surface" reference article restates PEP 8's guidance operationally: pick deliberate public names, prefix everything else, and treat `__all__` as the introspection-facing contract — doesn't give a numeric surface-size target.
  Source: <https://realpython.com/ref/best-practices/public-api-surface> (speculating — secondary source, restates PEP 8 without new authority)
- Did not find a primary, citable Hynek Schlawack or Brett Cannon post/talk with a specific quantitative rule for `__init__.py` size or "table of contents" framing within the search budget for this pass — a YouTube talk title ("What You Can Do With `__init__.py` (But Probably Shouldn't)") surfaced but was not transcribed/verified. Treat any "keep `__init__.py` to N names" heuristic as **not found in primary sources**; the closest evidence-backed heuristic is empirical: FastAPI's top-level surface is ~19 names, httpx's is a few dozen (all of its own submodules' `__all__` unioned), pydantic's is ~150+ but organized into ~25 explicit sections. There is no single-number convention — surface size scales with library size, but curation-via-comments-vs-flat-list is the actual differentiator observed.
  Source: n/a (don't know — flagging as unconfirmed rather than fabricating a citation)

## Open questions

- Does any Ruff config/plugin support isort-style "sections" for `__all__` analogous to `[tool.ruff.lint.isort]` `known-first-party` sections for imports? Not found; astral-sh/ruff#20952 is the closest open ask (definition-order sorting) and is unresolved.
- polars' actual current `__init__.py` structure — fetch failed (404 on assumed path); would need a tree listing to locate it correctly.
- No primary-source (PEP, official style guide, or verified Hynek/Cannon writeup) gives a numeric or codified rule for "how large should a top-level `__init__.py` surface be" — only observed exemplar variance (19 to 150+ names) with grouping-via-comments as the scaling technique once a library exceeds a small handful of exports.
