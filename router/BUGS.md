# Router: known failures

Run `npm test`. Every failing test is tagged `[BUG-n]` or `[DECISION-n]`, matching the entries below.
No source has been changed; these await review.

- **BUG**: throws unexpectedly, loses data, or a feature present in the code does not work.
- **DECISION**: the test states a proposed behaviour, but the current one may be intended. If so, change the test.

## Bugs

| # | Problem | Cause | Severity |
|---|---|---|---|
| 1 | Repeated query keys, keys such as `toString`, and interpolating a `query` object all throw `isArray is not defined` | Missing helper in both files. Behind it: `pName in obj` also matches inherited members; interpolation encodes the `=` (`encodeURIComponent(key + '=' + val)`) | High |
| 2 | `?x=%` throws `URI malformed`, so a bad link breaks parsing | Unguarded `decodeURIComponent` | High |
| 3 | Query parsing loses data: `?flag` becomes `{"": "flag"}`; `?x=1&&y=2` drops `y`; `?x=a?b` gives `ab`; keys are not decoded | `decodeQueryString`: no check for a missing `=`; loop stops at an empty part; `replace('?', '')` removes a value's `?` after the leading one is already gone | High |
| 4 | Rest params are named `r*`, swallow the query, and cannot be interpolated | `getParamIds` keeps the `*`; rest tokens compile to `.+` / `.*`, which cross `?`; interpolation looks up `r*` | Medium |
| 5 | `/a/:id:` matches `/a1` | The separator before an optional param is itself optional | Medium |
| 6 | RegExp patterns throw when registered, despite `isRegExp` handling | `addRoute` calls `pattern.endsWith`; interpolation of a RegExp would need defining too | Low |
| 7 | `shouldTypecast` throws | `typecastArrayValues` does not exist | Low |
| 8 | `/a/:id:/b` without `id` interpolates to `/a//b` | Separators around an omitted segment are both kept | Medium |
| 9 | Query interpolation adds a slash (`/a/?x=1`), and `{}` gives `/a/?` | `addRoute` appends `/:?query:`, and an empty object still emits `?` | Low |
| 10 | A duplicate name throws, but the second route stays registered and takes over `interpolate` | State changes before `defineProperty` throws | Low |
| 11 | Route names such as `parse` or `routes` break the router | Each name is defined as a property on the instance | Low |
| 12 | `toString` throws on routers and routes | They call methods or members that do not exist | Low |

Untested, dead code: `_isValidParam` and `_isValidArrayRule` are never called and use undefined
`arrayIndexOf`, `isArray` and `isFunction`.

## Decisions

| # | Proposed (tested) | Current | Consideration |
|---|---|---|---|
| 1 | `path` keeps case | Lowercased | page-manager uses `path` as cache key and same-page test, so ids differing only by case collide |
| 2 | `path` ignores a trailing slash | `/a/1/` and `/a/1` differ | page-manager treats them as different pages |
| 3 | Path params are decoded | Raw, though query values are decoded | Breaking for callers who decode themselves |
| 4 | `+` in a query is a space | Literal `+` | Form encoding convention; breaks links with an unencoded `+` |
| 5 | `?hash=q` is kept when there is no fragment | Always overwritten | Alternatively, reserve the name |
| 6 | `interpolate` encodes values | Inserted raw, so `?` and `#` change the URL | Decide with 3. Breaking for callers who pre-encode |
| 7 | An empty required param throws | `/a/{id}` gives `/a/`, which does not match its own route | |
| 8 | `/a/` interpolates to `/a/` | Gives `/a` | Harmless in loose mode, which matches both |

## Behaviour worth knowing (passing)

- The **first** registered route wins ties; higher priority always wins.
- Matching is case-sensitive unless `router.ignoreCase` is set before `addRoute`.
- Path params beat query params with the same name. Unused `interpolate` values are ignored.
- A `/` in an ordinary segment throws on interpolation.
