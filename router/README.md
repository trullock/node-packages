# Router

A small, dependency-free URL router for browsers and Node. It does two things, which are the inverse of each other:

- **parse** a URL to find which route it matches, and its parameters
- **interpolate** a route's name and some values into a URL

It doesn't touch the browser's location or history. For that, see [@trullock/page-manager](https://github.com/trullock/node-packages/tree/main/page-manager), which is
built on it.

- [Getting started](#getting-started)
- [Patterns](#patterns)
- [Matching](#matching)
- [Parsing](#parsing)
- [Interpolating](#interpolating)
- [Round trips](#round-trips)
- [Reserved names](#reserved-names)
- [API](#api)
- [Development](#development)
- [Changelog](#changelog)

## Getting started

```
npm install @trullock/router
```

```js
import Router from '@trullock/router';

const router = new Router();

router.addRoute('home', '/');
router.addRoute('view-thing', '/things/{thingId}', { some: 'data' });

router.parse('/things/123?tab=history#latest');
// {
//   name: 'view-thing',
//   path: '/things/123',
//   pattern: '/things/{thingId}',
//   data: { some: 'data' },
//   params: { thingId: '123', tab: 'history', hash: 'latest' }
// }

router.interpolate('view-thing', { thingId: 123, query: { tab: 'history' } });
// '/things/123?tab=history'
```

The package is an ES module. It needs `Object.hasOwn`: Node 16.9, Chrome 93, Firefox 92, Safari 15.4, or later.

## Patterns

| Syntax | Meaning | Example | Matches | Params |
|---|---|---|---|---|
| `text` | Literal text | `/things/new` | `/things/new` | |
| `{name}` | Required param, one segment | `/things/{id}` | `/things/1` | `{ id: '1' }` |
| `:name:` | Optional param, one segment | `/things/:id:` | `/things` | `{ id: undefined }` |
| | | | `/things/1` | `{ id: '1' }` |
| `{name*}` | Required rest, one or more segments | `/files/{path*}` | `/files/a/b` | `{ path: 'a/b' }` |
| `:name*:` | Optional rest, any number of segments | `/files/:path*:` | `/files` | `{ path: undefined }` |
| | | | `/files/a/b` | `{ path: 'a/b' }` |
| `{?name}` | Required query string | `/search{?q}` | `/search?term=x` | `{ term: 'x' }` |

Query strings are always captured, so they don't need declaring in the pattern. Use `{?name}` only to make a route
match solely when there is one. The name is then the key its values go under when interpolating (`q` above).

### Required params

These may appear anywhere in the path, and more than once per segment if there's something between them:

```js
router.addRoute('edit', '/things/{thingId}/edit');
router.addRoute('range', '/range/{from}-{to}');
router.addRoute('time', '/time/{hours}:{minutes}');
```

### Optional params

These must be whole segments at the **end of the path**. There may be several, each needing the one before it:

```js
router.addRoute('archive', '/archive/:year:/:month:');
// matches /archive, /archive/2024 and /archive/2024/12
```

The slash before an optional param belongs to it: it's there when the param is, and not when it isn't. So
`/things/:id:` matches `/things` and `/things/1`, but not `/things/` or `/things1`.

A rest param, optional or not, can't be followed by an optional one.

### Literal text

Text with characters which browsers encode can be written either way: `/café` and `/caf%C3%A9` both match either form in
a URL. It's encoded when interpolating.

### Invalid patterns

`addRoute` throws for anything else it can't match and build unambiguously:

- an optional param which isn't a whole segment at the end, or a stray `:` at the start of a segment
- unmatched braces, or params with no name
- adjacent params (`/{a}{b}`), or two with the same name
- empty, `.` or `..` segments
- `?` or `#`, other than a query string param at the end
- [reserved names](#reserved-names)

## Matching

**Order.** The route with the highest `priority` (default `0`) wins. Between equal priorities, the one registered
**first** wins, so register specific routes before general ones:

```js
router.addRoute('new-thing', '/things/new');
router.addRoute('view-thing', '/things/{thingId}');

router.parse('/things/new').name; // 'new-thing'
```

**Trailing slashes matter.** `/a` and `/a/` are different URLs and need separate routes. A leading slash is optional,
in both patterns and URLs.

**Case matters**, unless `ignoreCase` is set *before* adding routes:

```js
const router = new Router();
router.ignoreCase = true;
router.addRoute('about', '/about');
router.parse('/About').name; // 'about'
```

Whatever the setting, `path` and `params` keep the case used in the URL.

**The whole path must match**, excluding the query string and fragment. If no route matches, `parse` returns `null`.

## Parsing

`router.parse(url)` takes a path with an optional query string and fragment. It isn't for absolute URLs: remove the
protocol and host first.

| Property | Contents |
|---|---|
| `name` | The name of the route |
| `path` | The URL without its query string and fragment, exactly as given |
| `pattern` | The pattern given to `addRoute` |
| `data` | The object given to `addRoute` |
| `params` | Path params, query params and the fragment, below |

### Path params

Always strings, and percent-decoded: `/things/a%20b` gives `'a b'`, and `/things/a%2Fb` gives `'a/b'`. Optional params
which are absent are `undefined`.

### Query params

Merged into `params` alongside the path params. If the names clash, the path param wins, unless it's
an optional one which is absent.

| Query | Params |
|---|---|
| `?x=1&y=2` | `{ x: '1', y: '2' }` |
| `?x=1&x=2` | `{ x: ['1', '2'] }` |
| `?flag` | `{ flag: null }` |
| `?flag=` | `{ flag: '' }` |
| `?x=a%20b` or `?x=a+b` | `{ x: 'a b' }` |
| `?x=a%2Bb` | `{ x: 'a+b' }` |
| `?x=a=b?c` | `{ x: 'a=b?c' }` |
| `?x[]=1&x[]=2` | `{ 'x[]': ['1', '2'] }` |
| `?x=1&&y=2` | `{ x: '1', y: '2' }` |

A param is an array only if it's repeated, so check with `Array.isArray` if either is possible.

### Fragment

`params.hash` is the text after the first `#`, not decoded. It's `undefined` if there's no `#`, and `''` if nothing
follows it.

### Malformed encoding

A value which can't be decoded is left exactly as it was, so a bad link never causes an exception: `?x=100%` gives
`'100%'`.

## Interpolating

`router.interpolate(name, values)` builds a URL from a route.

```js
router.addRoute('view-thing', '/things/{thingId}/:tab:');

router.interpolate('view-thing', { thingId: 1 });                  // '/things/1'
router.interpolate('view-thing', { thingId: 1, tab: 'history' });  // '/things/1/history'
router.interpolate('view-thing', { thingId: 'a/b?c' });            // '/things/a%2Fb%3Fc'
```

- **Values are encoded for you**, so don't encode them first. Rest params keep their slashes as separators.
- **Optional params** are left out, with their slash, if `undefined`, `null` or `''`. `0` and `false` are kept.
- **Other values** not in the pattern are ignored. Query values go under `query`, rather than at the top level.

It throws an error if:

- there's no route with that name
- a required param is missing, `null` or `''`
- an optional param has a value, but one before it doesn't
- a path param is an object or array, or would make a segment `.` or `..`
- a path param's value would be parsed differently, such as `{ from: '1', to: '2-3' }` in `/range/{from}-{to}`
- a query isn't an object or string, or has nested objects or arrays
- a query uses a [reserved name](#reserved-names)

Only a values object's own properties are used, not inherited ones.

### Query strings

Pass an object, a string or `URLSearchParams` as `query`:

| `query` | Result |
|---|---|
| `{ x: 1, y: 'a b' }` | `?x=1&y=a%20b` |
| `{ x: [1, 2] }` | `?x=1&x=2` |
| `{ 'x[]': [1, 2] }` | `?x[]=1&x[]=2` |
| `{ flag: null }` | `?flag` |
| `{ flag: '' }` | `?flag=` |
| `{ x: undefined }`, `{ x: [] }`, `{}` | Nothing |
| `'?x=1'` or `'x=1'` | `?x=1` |

A string is used as it is, so must already be encoded (any `#` is encoded, as it would otherwise start the fragment).

Fragments aren't built: append `'#' + fragment` to the result.

## Round trips

Interpolating values and parsing the result gives the same values back, with these exceptions:

- Values other than strings come back as strings (`1` as `'1'`), though `null` in a query is kept.
- A query array with one item comes back as that item, and an empty one is left out.
- A query param with the same name as a path param is hidden by it.
- `undefined` in a query is left out, as is an empty string for an optional path param.

Path values which can't come back the same are rejected when interpolating.

Because parsing merges query params into `params`, but interpolating takes them under `query`, passing `parse(url).params`
straight to `interpolate` drops the query string.

## Reserved names

These can't be param names, as they have another purpose:

| Name | Purpose |
|---|---|
| `hash` | Holds the fragment when parsing |
| `query` | Holds the query values when interpolating |
| `__proto__` | Can't be stored as an ordinary property |

- **In a pattern**, `addRoute` throws.
- **In a URL**, query params called `hash` or `__proto__` are ignored. `query` is fine.
- **In a query** to interpolate, `hash` and `__proto__` throw. `query` is fine.

Any name can be used for a *route*.

## API

### `new Router()`

Creates an independent router.

### `router.addRoute(name, pattern, data, priority = 0)`

| Argument | |
|---|---|
| `name` | Unique name for the route |
| `pattern` | String [pattern](#patterns) |
| `data` | Optional. Anything, returned as it is by `parse` |
| `priority` | Optional number. Higher is matched first |

Returns the route. Throws, leaving the router unchanged, if the pattern is [invalid](#invalid-patterns) or the name is
already in use.

### `router.parse(url)`

Returns the [result](#parsing), or `null` if no route matches.

### `router.interpolate(name, values)`

Returns the [URL](#interpolating) as a string.

### `router.ignoreCase`

Set to `true` before adding routes to match them case-insensitively.

## Development

```
npm test
```

The tests use Node's built-in runner (Node 18 or later) and need no dependencies. [BUGS.md](https://github.com/trullock/node-packages/blob/main/router/BUGS.md) records how previously ambiguous
behaviour was decided.

## Changelog

### 2.0.0

**Breaking**

* Trailing slashes are significant: `/a` no longer matches `/a/`
* Path params are decoded when parsing and encoded when interpolating. Remove any manual decoding of params, and any
  encoding of values passed to `interpolate`
* `path` keeps its case, rather than being lowercased
* Optional params must be whole segments at the end of the path, and need their slash: `/a/:id:` no longer matches `/a1`
* Invalid or ambiguous patterns throw, see [Invalid patterns](#invalid-patterns)
* Rest params are named without their `*`, and no longer include the query string
* `+` in a query string is a space
* A query param without a value is `null`
* `interpolate` throws for empty required params, objects as path params, nested query objects, and values which would be
  parsed differently. It ignores inherited properties, and no longer throws for a `/` in a value
* `hash`, `query` and `__proto__` are reserved as param names
* The `pattern` in results is exactly the registered pattern
* Removed `shouldTypecast`, RegExp patterns and `toString`, none of which worked
* Removed `router.patternLexer`
* Removed the property defined on the router for each route's name

**Fixed**

* Repeated query params, and interpolating a `query` object, no longer throw
* Malformed percent encoding no longer throws
* Query params are no longer lost after `&&`, and keep any `?` in their value. Their names are decoded
* Interpolating leaves no double slash for omitted segments, nor a slash before the query string
* A duplicate route name leaves the router unchanged
* Any name can be used for a route
* Literal text can include any character, including `|`, and matches whether or not it's encoded
* An absent optional param no longer hides a query param with the same name

### 1.0.0

* `routeResult.routeName` renamed to `name`
* `routeResult.pageClass` renamed to `data`
