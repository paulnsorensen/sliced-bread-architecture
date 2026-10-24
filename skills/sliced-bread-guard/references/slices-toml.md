# `slices.toml` schema

`slices.toml` sits at the repository root.
A human owns it through CODEOWNERS; an agent only drafts it.
Unknown fields, duplicate names, overlapping paths, and globs in `paths` are errors (exit 2).

## Top level

| Field      | Type    | Meaning                         |
| ---------- | ------- | ------------------------------- |
| `version`  | integer | Schema version. Must be `1`.    |
| `policy`   | table   | Repository-wide policy.         |
| `slice`    | array   | One table per slice.            |
| `spine`    | array   | One table per spine node.       |
| `suppress` | array   | Human-approved exceptions only. |

## `[policy]`

| Field            | Required | Meaning                                                                          |
| ---------------- | -------- | -------------------------------------------------------------------------------- |
| `language`       | yes      | `"typescript"`. Other values have no backend yet.                                |
| `unmapped_files` | yes      | `"error"`. An unmapped source file fails SB-04.                                  |
| `suppressions`   | yes      | `"human-only"`. Exceptions live only in `[[suppress]]`, never inline.            |
| `test_patterns`  | yes      | Globs (`**`, `*`, `?`) that mark test files for SB-05.                           |
| `ignore`         | no       | Globs removed from the SB-04 inventory, such as build output.                    |
| `tsconfig`       | no       | Path of the tsconfig that holds path aliases. Set it when the code uses aliases. |

## `[[slice]]`

| Field           | Meaning                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `name`          | Unique node name.                                                       |
| `paths`         | Directories or files that the slice owns, including its test folders.   |
| `crust`         | The files that form the public seam. Each must be inside `paths`.       |
| `shape`         | `thin-facade`, `framework-bound`, or `service`. Recorded, not enforced. |
| `may_depend_on` | Nodes this slice may import.                                            |
| `requires`      | Nodes this slice must import in production code. A subset of the above. |

## `[[spine]]`

Spine nodes are `app`, `entrypoints`, `adapters`, `common`, and similar.
They have `name`, `paths`, and `may_depend_on`, and no crust.
SB-01 still applies when a spine file imports a slice internal.

## `[[suppress]]`

| Field    | Meaning                                                          |
| -------- | ---------------------------------------------------------------- |
| `rule`   | `SB-01` to `SB-06`. SB-00 and SB-07 cannot be suppressed.        |
| `from`   | The `from` part of the identity, exactly as the check prints it. |
| `to`     | The `to` part of the identity, exactly as the check prints it.   |
| `reason` | Why the exception is acceptable. Must not be empty.              |

A suppression that matches nothing is stale; `check --strict` fails on it.

## Example

The acceptance fixture holds a complete example: [`../fixtures/ts-shop/slices.toml`](../fixtures/ts-shop/slices.toml).
