import test from "node:test";
import assert from "node:assert";
import Router from "../src/index.js";

test("should create a new router instance", (t) => {
	const router = new Router();
	assert.ok(router instanceof Router);
});

test("should parse query string properly", (t) => {
	const router = new Router();
	router.addRoute("test", "/test/{id}", {}, 0);
	const result = router.parse("/test/123?foo=bar&baz=qux");
	assert.deepEqual(result.params, { id: "123", foo: "bar", baz: "qux", hash: undefined });
});

test("should parse hash properly", (t) => {
	const router = new Router();
	router.addRoute("test", "/test/{id}", {}, 0);
	const result = router.parse("/test/123#section1");
	assert.deepEqual(result.params, { id: "123", hash: "section1" });
});

test("should parse query string and hash properly", (t) => {
	const router = new Router();
	router.addRoute("test", "/test/{id}", {}, 0);
	const result = router.parse("/test/123?foo=bar&baz=qux#section1");
	assert.deepEqual(result.params, { id: "123", foo: "bar", baz: "qux", hash: "section1" });
});

test("should match the correct route when multiple routes are added with equal priority", (t) => {
	const router = new Router();
	router.addRoute("test2", "/test/{id}/test/{id2}", {}, 0);
	router.addRoute("test1", "/test/{id}", {}, 0);
	const result = router.parse("/test/123");
	assert.equal(result.name, "test1");
});


// ---------------------------------------------------------------------------
// Tests named [BUG-n] / [DECISION-n] fail at the time of writing. See BUGS.md.
// ---------------------------------------------------------------------------

function routerWith(...patterns) {
	const router = new Router();
	for (const p of patterns)
		Array.isArray(p) ? router.addRoute(...p) : router.addRoute(p, p, {});
	return router;
}

function params(pattern, url) {
	const result = routerWith(pattern).parse(url);
	assert.notEqual(result, null, `${url} should match ${pattern}`);
	// spread so that key order and an undefined hash don't clutter expectations
	const { hash, ...rest } = result.params;
	return hash === undefined ? rest : { ...rest, hash };
}

function interpolate(pattern, values) {
	return routerWith(["route", pattern, {}]).interpolate("route", values);
}

// --- matching --------------------------------------------------------------

for (const [pattern, url, matches] of [
	["/", "/", true],
	["/", "", true],
	["/", "/?x=1", true],
	["/", "/#h", true],
	["/", "/b", false],
	["/a", "/a", true],
	["/a", "a", true],
	["/a", "/a/", true],
	["/a", "/a/?x=1", true],
	["/a", "/", false],
	["/a", "/abc", false],
	["/a", "/a/b", false],
	["/a", "/b/a", false],
	["/a", "/A", false],
	["a", "/a", true],
	["/a/", "/a", true],
	["/a/", "/a?x=1", true],
	["/a/b", "/a/b", true],
	["/a/b", "/a", false],
	["/a/{id}", "/a/1", true],
	["/a/{id}", "/a/1/", true],
	["/a/{id}", "/a", false],
	["/a/{id}", "/a/", false],
	["/a/{id}", "/a/1/2", false],
	["/a/{id}/edit", "/a/1/edit", true],
	["/a/{id}/edit", "/a/1/edit?x=1", true],
	["/a/{id}/edit", "/a/1", false],
	["/a.b", "/a.b", true],
	["/a.b", "/aXb", false],
	["/a+b", "/a+b", true],
	["/a+b", "/aab", false],
	["/a/:id:", "/a", true],
	["/a/:id:", "/a/", true],
	["/a/:id:", "/a/1", true],
	["/a/:id:", "/a/1/2", false],
	["/a/{r*}", "/a/1/2", true],
	["/a/{r*}", "/a", false],
	["/a/:r*:", "/a", true],
	["/a/:r*:", "/a/1/2", true],
]) {
	test(`match: "${pattern}" ${matches ? "matches" : "does not match"} "${url}"`, () => {
		assert.equal(routerWith(pattern).parse(url) !== null, matches);
	});
}

test("match: parse returns null when there are no routes", () => {
	assert.equal(new Router().parse("/a"), null);
});

test("match: ignoreCase makes matching case insensitive", () => {
	const router = new Router();
	router.ignoreCase = true;
	router.addRoute("a", "/Abc", {});
	assert.equal(router.parse("/aBC").name, "a");
});

test("[BUG-5] match: an optional segment still needs its separator", () => {
	assert.equal(routerWith("/a/:id:").parse("/a1"), null);
});

test("[BUG-6] match: RegExp patterns can be registered", () => {
	const router = new Router();
	router.addRoute("re", /^\/re\/(\d+)$/, {});
	assert.equal(router.parse("/re/1").name, "re");
	assert.equal(router.parse("/re/x"), null);
});

// --- route precedence and result -------------------------------------------

test("precedence: the first registered route wins ties", () => {
	assert.equal(routerWith("/a/new", "/a/{id}").parse("/a/new").name, "/a/new");
	assert.equal(routerWith("/a/{id}", "/a/new").parse("/a/new").name, "/a/{id}");
});

test("precedence: higher priority wins whatever the registration order", () => {
	for (const order of [[1, 3, 5], [5, 3, 1], [3, 5, 1], [5, 1, 3]]) {
		const router = routerWith(...order.map(p => [`p${p}`, "/x", {}, p]));
		assert.equal(router.parse("/x").name, "p5", order.join());
	}
});

test("precedence: priority defaults to 0", () => {
	assert.equal(routerWith(["none", "/x", {}], ["low", "/x", {}, -1]).parse("/x").name, "none");
	assert.equal(routerWith(["none", "/x", {}], ["high", "/x", {}, 1]).parse("/x").name, "high");
});

test("precedence: falls through to a less specific route", () => {
	assert.equal(routerWith("/a/new", "/a/{id}").parse("/a/1").name, "/a/{id}");
});

test("result: contains name, path, pattern and the same data object", () => {
	const data = { some: "thing" };
	const result = routerWith(["thing", "/things/{id}", data]).parse("/things/1?x=1#h");
	assert.equal(result.name, "thing");
	assert.equal(result.path, "/things/1");
	assert.ok(result.pattern.startsWith("/things/{id}"));
	assert.equal(result.data, data);
});

test("result: pattern is shared by all urls of a route and distinct between routes", () => {
	const router = routerWith("/a/{id}", "/b/{id}");
	assert.equal(router.parse("/a/1").pattern, router.parse("/a/2?x=1#h").pattern);
	assert.notEqual(router.parse("/a/1").pattern, router.parse("/b/1").pattern);
});

test("result: path excludes query and hash, in any combination", () => {
	const router = routerWith("/a");
	for (const url of ["/a", "/a?x=1", "/a#h", "/a?x=1#h", "/a#h?x=1"])
		assert.equal(router.parse(url).path, "/a", url);
});

test("result: parsing is repeatable and results are independent", () => {
	const router = routerWith("/a/{id}");
	const first = router.parse("/a/1?x=1");
	first.params.id = "changed";
	assert.equal(router.parse("/a/1?x=1").params.id, "1");
	assert.equal(router.parse("/a/2").params.x, undefined);
});

test("[DECISION-1] result: path keeps the url's case", () => {
	assert.equal(routerWith("/a/{id}").parse("/a/AbC").path, "/a/AbC");
});

test("[DECISION-2] result: path is the same with and without a trailing slash", () => {
	const router = routerWith("/a/{id}");
	assert.equal(router.parse("/a/1/").path, router.parse("/a/1").path);
});

// --- path params -----------------------------------------------------------

for (const [pattern, url, expected] of [
	["/a/{id}", "/a/1", { id: "1" }],
	["/a/{id}", "/a/1/", { id: "1" }],
	["/a/{id}", "/a/AbC", { id: "AbC" }],
	["/a/{id}/b/{id2}", "/a/1/b/2", { id: "1", id2: "2" }],
	["/a/{x}-{y}", "/a/1-2", { x: "1", y: "2" }],
	["/a/{id}", "/a/x.y_z~1", { id: "x.y_z~1" }],
	["/a/:id:", "/a/1", { id: "1" }],
	["/a/:id:", "/a/1?x=1", { id: "1", x: "1" }],
	["/a/:id:", "/a", { id: undefined }],
	["/a/:id:", "/a?x=1", { id: undefined, x: "1" }],
	["/:a:/x", "/x", { a: undefined }],
]) {
	test(`path params: "${pattern}" from "${url}"`, () => {
		assert.deepStrictEqual(params(pattern, url), expected);
	});
}

test("path params: take precedence over query params of the same name", () => {
	assert.equal(params("/a/{id}", "/a/1?id=2").id, "1");
});

test("[BUG-4] rest params: are named without the asterisk", () => {
	assert.equal(params("/a/{r*}", "/a/1/2").r, "1/2");
	assert.equal(params("/a/:r*:", "/a/1/2").r, "1/2");
});

test("[BUG-4] rest params: required rest does not swallow the query string", () => {
	assert.deepStrictEqual(params("/a/{r*}", "/a/1/2?x=1"), { r: "1/2", x: "1" });
});

test("[BUG-4] rest params: optional rest does not swallow the query string", () => {
	assert.deepStrictEqual(params("/a/:r*:", "/a?x=1"), { r: undefined, x: "1" });
});

test("[BUG-7] shouldTypecast does not throw", () => {
	const router = new Router();
	router.shouldTypecast = true;
	router.addRoute("a", "/a/{id}", {});
	assert.equal(router.parse("/a/1").params.id, 1);
});

test("[DECISION-3] path params: are percent decoded", () => {
	assert.equal(params("/a/{id}", "/a/x%20y").id, "x y");
	assert.equal(params("/a/{id}", "/a/x%2Fy").id, "x/y");
});

// --- query -----------------------------------------------------------------

for (const [query, expected] of [
	["", {}],
	["?", {}],
	["?x=1", { x: "1" }],
	["?x=1&y=2", { x: "1", y: "2" }],
	["?x=", { x: "" }],
	["?x=1=2", { x: "1=2" }],
	["?x=a%20b", { x: "a b" }],
	["?x=a%26b%3Dc", { x: "a&b=c" }],
	["?x=%2Fa%2Fb", { x: "/a/b" }],
	["?x=/a/b", { x: "/a/b" }],
	["?x=%C3%BC", { x: "ü" }],
	["?x=0", { x: "0" }],
	["?query=1", { query: "1" }],
	["?x[]=1", { "x[]": "1" }],
]) {
	test(`query: "${query}"`, () => {
		assert.deepStrictEqual(params("/a", "/a" + query), expected);
	});
}

test("[BUG-1] query: a repeated key becomes an array", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&x=2"), { x: ["1", "2"] });
});

test("[BUG-1] query: three repeats become one flat array", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&x=2&x=3"), { x: ["1", "2", "3"] });
});

test("[BUG-1] query: a key matching an Object.prototype member is an ordinary param", () => {
	assert.equal(params("/a", "/a?toString=1").toString, "1");
});

test("[BUG-2] query: malformed percent encoding does not throw", () => {
	assert.doesNotThrow(() => routerWith("/a").parse("/a?x=%"));
});

test("[BUG-3] query: a key with no value keeps its name", () => {
	assert.deepStrictEqual(params("/a", "/a?flag"), { flag: "" });
});

test("[BUG-3] query: an empty part does not discard later params", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&&y=2"), { x: "1", y: "2" });
});

test("[BUG-3] query: a question mark in a value is kept", () => {
	assert.equal(params("/a", "/a?x=a?b").x, "a?b");
});

test("[BUG-3] query: keys are percent decoded", () => {
	assert.deepStrictEqual(params("/a", "/a?x%20y=1"), { "x y": "1" });
});

test("[DECISION-4] query: plus decodes to a space", () => {
	assert.equal(params("/a", "/a?x=a+b").x, "a b");
});

// --- hash ------------------------------------------------------------------

for (const [url, hash] of [
	["/a", undefined],
	["/a#", ""],
	["/a#h", "h"],
	["/a?x=1#h", "h"],
	["/a#x#y", "x#y"],
	["/a#h?x=1", "h?x=1"],
	["/a?hash=q#h", "h"],
]) {
	test(`hash: "${url}"`, () => {
		assert.equal(routerWith("/a").parse(url).params.hash, hash);
	});
}

test("hash: contents are not parsed as query", () => {
	assert.equal(routerWith("/a").parse("/a#h?x=1").params.x, undefined);
});

test("[DECISION-5] hash: a query param called hash survives when there is no fragment", () => {
	assert.equal(routerWith("/a").parse("/a?hash=q").params.hash, "q");
});

// --- interpolate -----------------------------------------------------------

for (const [pattern, values, expected] of [
	["/", {}, "/"],
	["/a", {}, "/a"],
	["/a", undefined, "/a"],
	["/a", null, "/a"],
	["/a/{id}", { id: 1 }, "/a/1"],
	["/a/{id}", { id: "x" }, "/a/x"],
	["/a/{id}", { id: 0 }, "/a/0"],
	["/a/{id}", { id: false }, "/a/false"],
	["/a/{x}/b/{y}", { x: 1, y: 2 }, "/a/1/b/2"],
	["/a/{x}-{y}", { x: 1, y: 2 }, "/a/1-2"],
	["/a/{id}", { id: 1, other: 2 }, "/a/1"],
	["/a/:id:", {}, "/a"],
	["/a/:id:", { id: 1 }, "/a/1"],
	["/a/:id:/b", { id: 1 }, "/a/1/b"],
]) {
	test(`interpolate: "${pattern}" with ${JSON.stringify(values)}`, () => {
		assert.equal(interpolate(pattern, values), expected);
	});
}

test("interpolate: unknown route name throws", () => {
	assert.throws(() => new Router().interpolate("nope", {}), /Cannot find route by name nope/);
});

for (const id of [undefined, null]) {
	test(`interpolate: required param of ${id} throws`, () => {
		assert.throws(() => interpolate("/a/{id}", { id }), /segment \{id\} is required/);
	});
}

test("interpolate: a slash in a plain segment throws", () => {
	assert.throws(() => interpolate("/a/{id}", { id: "x/y" }), /Invalid value "x\/y"/);
});

test("interpolate: does not mutate its values", () => {
	const values = Object.freeze({ id: 1 });
	assert.equal(interpolate("/a/{id}", values), "/a/1");
});

test("[BUG-8] interpolate: an omitted middle segment leaves no double slash", () => {
	assert.equal(interpolate("/a/:id:/b", {}), "/a/b");
});

test("[BUG-4] interpolate: rest params accept slashes", () => {
	assert.equal(interpolate("/a/{r*}", { r: "x/y" }), "/a/x/y");
});

test("[BUG-1] interpolate: a query object builds a query string", () => {
	const url = interpolate("/a", { query: { x: 1, y: "b c" } });
	assert.deepStrictEqual(params("/a", url), { x: "1", y: "b c" });
});

test("[BUG-1] interpolate: a query object separates keys and values with a literal =", () => {
	assert.match(interpolate("/a", { query: { x: 1 } }), /^\/a\/?\?x=1$/);
});

test("[BUG-1] interpolate: a query array repeats its key", () => {
	assert.match(interpolate("/a", { query: { x: [1, 2] } }), /\?x=1&x=2$/);
});

test("[BUG-9] interpolate: an empty query object adds nothing", () => {
	assert.equal(interpolate("/a", { query: {} }), "/a");
});

test("[BUG-9] interpolate: a query string is not preceded by a slash", () => {
	assert.equal(interpolate("/a", { query: "?x=1" }), "/a?x=1");
});

test("[DECISION-6] interpolate: values are percent encoded", () => {
	assert.equal(interpolate("/a/{id}", { id: "a?b#c d" }), "/a/a%3Fb%23c%20d");
});

test("[DECISION-8] interpolate: a trailing slash in the pattern is kept", () => {
	assert.equal(interpolate("/a/", {}), "/a/");
});

test("[DECISION-7] interpolate: an empty required param throws", () => {
	assert.throws(() => interpolate("/a/{id}", { id: "" }), /required/);
});

// --- round trips -----------------------------------------------------------

for (const id of ["1", "AbC", "x-y_z.~", "a:b", "a=b&c"]) {
	test(`round trip: "${id}"`, () => {
		assert.equal(params("/a/{id}", interpolate("/a/{id}", { id })).id, id);
	});
}

for (const id of ["a?b", "a#b"]) {
	test(`[DECISION-6] round trip: "${id}"`, () => {
		assert.equal(params("/a/{id}", interpolate("/a/{id}", { id })).id, id);
	});
}

// --- registration and API --------------------------------------------------

test("registration: addRoute returns the route", () => {
	const route = new Router().addRoute("a", "/a", {});
	assert.equal(route.match("/a"), true);
	assert.equal(route.match("/b"), false);
	assert.equal(route.interpolate({}), "/a");
});

test("registration: router instances are independent", () => {
	const one = routerWith("/a");
	const two = routerWith("/b");
	assert.equal(one.parse("/b"), null);
	assert.equal(two.parse("/a"), null);
});

test("registration: one name per route, many routes per pattern", () => {
	const router = routerWith(["one", "/x", {}], ["two", "/x", {}]);
	assert.equal(router.interpolate("one"), "/x");
	assert.equal(router.interpolate("two"), "/x");
});

test("registration: a duplicate name throws", () => {
	const router = routerWith(["a", "/a", {}]);
	assert.throws(() => router.addRoute("a", "/b", {}));
});

test("[BUG-10] registration: a rejected duplicate leaves the router unchanged", () => {
	const router = routerWith(["a", "/a", {}]);
	assert.throws(() => router.addRoute("a", "/b", {}));
	assert.equal(router.interpolate("a"), "/a");
	assert.equal(router.parse("/b"), null);
});

for (const name of ["parse", "interpolate", "addRoute", "patternLexer", "routes"]) {
	test(`[BUG-11] registration: a route can be called "${name}"`, () => {
		const router = routerWith([name, "/a", {}], ["other", "/b", {}]);
		assert.equal(router.parse("/a").name, name);
		assert.equal(router.interpolate(name, {}), "/a");
	});
}

test("[BUG-12] toString: router does not throw", () => {
	assert.doesNotThrow(() => routerWith("/a").toString());
});

test("[BUG-12] toString: route does not throw", () => {
	assert.doesNotThrow(() => new Router().addRoute("a", "/a", {}).toString());
});
