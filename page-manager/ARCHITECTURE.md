# Page Manager: internals

How `src/index.js` works, what it must keep true, how it is used in practice, and the defects
suspected so far. For the public API see [readme.md](readme.md).

Written from reading the code and two real consuming apps. **Nothing here has been confirmed by running
it**; the defects in particular are hypotheses until reproduced. Functions are named rather than
line-numbered so that references survive edits.

## Core model

The browser won't let us enumerate or edit its session history, so we keep a shadow copy:

| State | Meaning |
|---|---|
| `stack` | Frames `{ uid, data, page }`, one per browser history entry we know about |
| `stackPointer` | Index of the current frame; `-1` before the first load |
| `pageCache` | Booted page instances with their DOM, keyed by path (default) or route pattern |
| `pageTemplateCache` | Markup templates, keyed by route pattern |
| `goal` | `{ url, data }` of the last interrupted navigation |
| `backData` | Data passed to `back()`, merged into the target frame's data on the next back |
| `manuallyAdjustingHistory` | `false`, or a callback which consumes popstates during a history rewrite |
| `handlingBeforeHide` | `false`, `'ignore'`, `'step1'` or `'step2'` |

`uid` links a frame to its browser entry through `history.state.uid`. An entry created by a hard load has
**null** state, so its frame must be inferred.

### Invariants

1. `stack[stackPointer]` describes the browser's current entry. (Interrupts and `show()` deliberately let
   the displayed page differ from the address bar.)
2. `stack[stackPointer].page` is the visible page; it is the one the next navigation will hide.
3. Stack order matches browser order. **Uids are identities, not positions**: `replace` allocates a new
   maximum uid wherever the frame is.
4. Only one transition runs at a time. Nothing enforces this.

## Startup

1. `init(opts)`: merge options, `loadStack(false)`, load and show the loading page.
2. `ready()`: start `showPage(<current url>, null, load)` (not awaited) and attach `popstate` and
   `beforeunload` listeners.

They are separate so that an app can show the loader while, for example, auth initialises.

`showPage` handles `load` separately and reconciles the restored stack:

| Condition | Result |
|---|---|
| No stack | Push frame, uid 0 |
| Current frame has the same URL | Treat as refresh; update that frame |
| Otherwise | Treat as a hard navigation; drop the future and push a frame |

## `showPage(url, data, event)`

1. Parse the route, falling back to the 404 route. `data.route.url` stays as requested.
2. Copy route/query params onto `data`; set `data.route` and `data.event`. `data.originalEvent` is set only
   if `data` has no event yet, so it records how a frame was first created.
3. Await `pageInterrupt(routeResult)`. If it redirects, store `goal` and restart with the new URL and the
   **same event**.
4. Find the cached page, or start `loadPage` (template, clone, attach, construct, `boot`).
5. `load` event: show, reconcile, done (above).
6. Same path as the current frame: `handleHistoryAction`, then `page.update(data)`. No show/hide or loader.
   This covers refresh, hash changes and query changes.
7. Otherwise: save `scrollY` on the old frame, show loader, hide the old page while awaiting the new one,
   `handleHistoryAction`, scroll to top, `page.show(data)`, set title, hide loader.

### Actions

| Action | Source | Effect in `handleHistoryAction` |
|---|---|---|
| `load` | `ready()` | None; handled in `showPage` |
| `push` | `navigate()` | `pushState`, truncate future, append frame |
| `replace` | `replace()`, `refresh()` | `replaceState` and new frame; or collapse, below |
| `back` / `fwd` | `popstate` | Move pointer by `event.distance` |
| `show` | `show()`, `PageShowError` without an action | None |

**Collapse:** replacing with the *previous* frame's URL would leave duplicate neighbours, so it instead
rewrites history without the current frame.

History changes **before** `show()` runs. If `show()` throws, the failing page already has an entry, which
is why a `PageShowError` redirect usually specifies `replace`.

## Back and forward

`popstate` finds the frame by `e.state.uid`, or for null state walks back from `stackPointer` to a frame
whose `originalEvent` is `load`. It derives direction and distance, then offers the event to:

1. `handleBeforeHidePart2`: we just undid a navigation; ask the user, then redo it if confirmed.
2. `handleBeforeHidePart1`: the page objects; undo the browser's move so the URL stays correct meanwhile.
3. `handlePopstate`: an active history rewrite, or a normal `showPage`.

A confirmed back therefore produces three popstates: original, undo, redo.

## Rewriting history

`modifyHistory(statesToKeep)` (used by `removeHistory` and collapse) walks back one entry per popstate to
the first, then uses `replaceState`/`pushState` to rebuild.

Entry 1 cannot be removed: truncation needs a push, and pushing from entry 0 creates entry 1. When only
one frame survives, the leftover entry becomes a default-page frame ahead of the pointer.

## Hard loads and bfcache

`beforeunload` stores the stack in `sessionStorage` **without page instances**. `loadStack` restores it and
aligns the pointer with `history.state.uid`; with null state after bfcache it guesses pointer + 1.
A restored frame has no `page` until it is next shown, except when bfcache kept the old instances.

## Use in practice

Two apps were examined: **A** on 1.4.0 and **B** on 0.14.1. B uses the pre-1.0 API
(`registerPage(name, route, class)`, `fetchPageTemplate`, class statics), so B's behaviour is not direct
evidence about the current code.

A's installed 1.4.0 **differs from this repository's source, also labelled 1.4.0**: the repo shows the
loader later, not on same-path updates, and guards a missing frame in `beforeunload`. Establish which copy
a bug was seen in.

| Feature | Usage |
|---|---|
| `navigate` | Both; a delegated link-click handler and after form saves |
| `replace` | Both, sparingly; A keeps list filters in the query string with it |
| `navigate('goal')` | Both; after sign-in, sign-up and similar |
| `pageInterrupt` | Both; authentication and authorisation. Async in A |
| `beforeHide` | Both, heavily; unsaved form changes, through an async modal |
| `PageShowError` | Both, heavily; not found, forbidden, already signed in, locked |
| `page-manager.url-changed` | A; analytics |
| `show`, `back`, `refresh`, `removeHistory`, `purgeCache` | No app use found in either |

Both wrap each page in a Vue app: `boot` mounts it and later calls forward to component hooks. `update`
falls back to the component's `show` (A) or always calls it (B), so `show` hooks must be repeatable. A's
filtered pages skip `show` when `event.action == 'replace'` to avoid looping.

Both use the base page to restore `opts.scrollY` or scroll to `opts.route.params.hash`. Pages cannot call
`navigate()` inside `show()`; they throw `PageShowError`.

`PageShowError` recovery exists for `navigate`, `popstate` and `ready`, but not `replace`, `refresh`,
`show`, or a `navigate` continued after a `beforeHide` prompt.

## Suspected defects

### Likely to affect current usage

| # | Defect | Trigger |
|---|---|---|
| 1 | `popstate` infers direction from uids, violating invariant 3 | Back to a list, change filter (`replace`), Forward: treated as back |
| 2 | Null-state lookup can match the current, refreshed frame | Load `/a`, go to `/b`, refresh, Back: stays on `/b` |
| 3 | Pointer moves after async work; transitions overlap | Two quick Backs subtract 1 then 2 |
| 4 | `handleHistoryAction` is not awaited by `showPage` | `PageShowError('/', …, 'replace')` when `/` is the previous frame: show races the rewind |
| 5 | Rewrite reads `page.title` from frames with no page; throws, and popstate handling stays captured | Refresh mid-stack, then collapse or `removeHistory` keeping older frames |
| 6 | Entry-1 workaround always calls `loadPage`, duplicating a cached default page; its frame has no `event` | Case 4 with two frames |
| 7 | A `push` recovery leaves the failing entry behind | Page fails, error page is pushed, Back fails and pushes again |
| 8 | `show` action does not update the frame's page (invariant 2) | `PageShowError` without an action: next navigation hides the wrong page |
| 9 | Recovery in `ready()` can add a frame with no browser entry | Failing page hard-loaded with a restored stack |
| 10 | `expandOnlyHash` drops the new hash | `navigate('#b')` on `/x#a` (the link handlers pass full paths, so avoid this) |
| 11 | Unload prompt calls `preventDefault` after `await`, too late | Closing a tab with unsaved changes |
| 12 | `beforeHide` undo moves one entry only | Jumping several entries with the history menu |
| 13 | Failed `show` skips `hideLoading` | Any throw which recovery does not cover |

### Other

| # | Defect |
|---|---|
| 14 | `removeHistory` on a page with `beforeHide`: part 1 ignores `manuallyAdjustingHistory` and undoes the rewind |
| 15 | `modifyHistory` at pointer 0 still calls `history.back()`, possibly leaving the app |
| 16 | `modifyHistory` assumes the pointer is at the tail (existing TODO) |
| 17 | Two unknown URLs in a row share the 404 path, so the second gets `update` |
| 18 | A uid missing from the stack leaves pointer/context as `-1`/`null` and throws |
| 19 | Router: undefined `isArray` throws on a repeated query key (`?a=1&a=2`) |

## Readme discrepancies

- `Page` is imported from the package but is not exported.
- `pageClassLoader` should be `loadPageClass`.
- Some examples use the old `registerPage(name, route, class)` signature.
- `pageInterrupt` reads `route.pageClass`; custom values are now in `routeResult.data.extra`.
- `opts.hash` is also available as `opts.route.params.hash`.
- Caching is described as per route; the default is per path.
- The example `loadMarkup` writes to the internal `pageTemplateCache`, which apps cannot reach.

## Testing

No automated tests. `npm run build` (webpack, watching) plus `npm run tests` serves a manual app on
port 3000, with `printStack()` on every URL change. Defects 1-5 are good first candidates for real-browser
tests, since they depend on genuine history behaviour.
