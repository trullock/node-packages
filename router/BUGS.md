# Router: known failures

None: all tests pass (`npm test`). BUG-1 to 12 and DECISION-1 to 8 are resolved. RegExp routes (BUG-6), `shouldTypecast`
(BUG-7), `toString` (BUG-12) and the slash modes were removed, then the rest of `patternLexer` was replaced by a tokenizer (`src/pattern.js`), as were the per-route properties on the router (BUG-11).

## Behaviour worth knowing

- The **first** registered route wins ties; higher priority always wins.
- Matching is case-sensitive unless `router.ignoreCase` is set before `addRoute`.
- Path params beat query params with the same name. Unused `interpolate` values are ignored.
- A trailing slash is significant: `/a` and `/a/` are different URLs and need separate routes (formerly DECISION-2 and 8).
  The leading slash is optional. Optional params are only allowed at the end of the path, and are omitted along with their
  slash, so `/a/:id:` matches `/a`, not `/a/`.
- A query param without a value (`?flag`) is `null`; with an empty value (`?flag=`) it is `""`.
- Interpolation is the inverse of parsing (formerly DECISION-3, 6 and 7): path params are encoded and decoded, empty
  required params throw, `null` query values give `?flag`, and `undefined` ones are skipped.
  Values are strings after parsing. Path values which would be parsed differently throw. These don't round trip:
  - a query array of one or zero items
  - query params with the same name as a path param
- `+` is a space in a query (formerly DECISION-4), but literal in a path or hash. Interpolation writes a literal plus in a query object as `%2B`.
- `path` keeps the case of the URL (formerly DECISION-1), including when `ignoreCase` is on.
- `hash`, `query` and `__proto__` are reserved (formerly DECISION-5): `addRoute` rejects them as param names.
  In a URL, query params called `hash` or `__proto__` are ignored, and `interpolate` rejects them in a query.
- A duplicate route name throws and leaves the router unchanged. Any name is allowed, including `parse` and `toString`.
