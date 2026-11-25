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
	["/a", "/a/", false],
	["/a", "/a/?x=1", false],
	["/a", "/", false],
	["/a", "/abc", false],
	["/a", "/a/b", false],
	["/a", "/b/a", false],
	["/a", "/A", false],
	["a", "/a", true],
	["/a/", "/a", false],
	["/a/", "/a/", true],
	["/a/", "/a//", false],
	["/a/", "/a?x=1", false],
	["/a/", "/a/?x=1", true],
	["/a/", "/a/#h", true],
	["/a/b", "/a/b", true],
	["/a/b", "/a", false],
	["/a/{id}", "/a/1", true],
	["/a/{id}", "/a/1/", false],
	["/a/{id}/", "/a/1/", true],
	["/a/{id}/", "/a/1", false],
	["/a/{id}/edit", "/a/1/edit/", false],
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
	["/a/:id:", "/a/", false],
	["/a/:id:", "/a/1/", false],
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

for (const [pattern, url, expected] of [
	["/a/:id:", "/a1", null],
	["/a/:id:", "/a1?x=1", null],
	["/a/:x:/:y:", "/a", { x: undefined, y: undefined }],
	["/a/:x:/:y:", "/a/1", { x: "1", y: undefined }],
	["/a/:x:/:y:", "/a/1/2", { x: "1", y: "2" }],
	["/a/:x:/:y:", "/a/1/2?q=1", { x: "1", y: "2", q: "1" }],
	["/a/:x:/:y:", "/a/1/2/?q=1", null],
	["/a/:x:/:y:", "/a1/2", null],
	["/a/{id}/:x:", "/a/1", { id: "1", x: undefined }],
	["/a/{id}/:x:", "/a/1/2", { id: "1", x: "2" }],
	["/a/:r*:", "/abc", null],
	["/a/:r*:", "/abc/d", null],
	["/:id:", "/", { id: undefined }],
	["/:id:", "/1", { id: "1" }],
]) {
	test(`optional segments: "${pattern}" ${expected ? "matches" : "does not match"} "${url}"`, () => {
		if (expected === null)
			assert.equal(routerWith(pattern).parse(url), null);
		else
			assert.deepStrictEqual(params(pattern, url), expected);
	});
}

for (const pattern of [/^\/re\/(\d+)$/, undefined, null, 1]) {
	test(`registration: a pattern of ${pattern} throws and is not registered`, () => {
		const router = new Router();
		assert.throws(() => router.addRoute("bad", pattern, {}), /pattern should be a string/);
		assert.equal(router.parse("/re/1"), null);
		assert.throws(() => router.interpolate("bad", {}), /Cannot find route/);
	});
}

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

test("result: path keeps the url's case", () => {
	assert.equal(routerWith("/a/{id}").parse("/a/AbC").path, "/a/AbC");
});

test("result: paths differing only by case are different", () => {
	const router = routerWith("/a/{id}");
	assert.notEqual(router.parse("/a/AbC").path, router.parse("/a/aBc").path);
});

test("result: path keeps its case when ignoreCase is on", () => {
	const router = new Router();
	router.ignoreCase = true;
	router.addRoute("a", "/a/{id}", {});
	assert.equal(router.parse("/A/AbC").path, "/A/AbC");
});

test("result: a trailing slash makes a different url", () => {
	const router = routerWith(["without", "/a/{id}", {}], ["with", "/a/{id}/", {}]);
	const without = router.parse("/a/1?x=1");
	const withSlash = router.parse("/a/1/?x=1");
	assert.equal(without.name, "without");
	assert.equal(without.path, "/a/1");
	assert.equal(withSlash.name, "with");
	assert.equal(withSlash.path, "/a/1/");
	assert.notEqual(without.pattern, withSlash.pattern);
});

for (const pattern of ["/a", "/a/", "/a/{id}", "/a/{id}/", "/a/:id:"]) {
	test(`round trip: "${pattern}" matches what it interpolates`, () => {
		for (const values of [{ id: 1 }, { id: 1, query: { x: 1 } }])
			assert.notEqual(routerWith(pattern).parse(interpolate(pattern, values)), null);
	});
}

// --- path params -----------------------------------------------------------

for (const [pattern, url, expected] of [
	["/a/{id}", "/a/1", { id: "1" }],
	["/a/{id}/", "/a/1/", { id: "1" }],
	["/a/{id}", "/a/AbC", { id: "AbC" }],
	["/a/{id}/b/{id2}", "/a/1/b/2", { id: "1", id2: "2" }],
	["/a/{x}-{y}", "/a/1-2", { x: "1", y: "2" }],
	["/a/{id}", "/a/x.y_z~1", { id: "x.y_z~1" }],
	["/a/:id:", "/a/1", { id: "1" }],
	["/a/:id:", "/a/1?x=1", { id: "1", x: "1" }],
	["/a/:id:", "/a", { id: undefined }],
	["/a/:id:", "/a?x=1", { id: undefined, x: "1" }],
]) {
	test(`path params: "${pattern}" from "${url}"`, () => {
		assert.deepStrictEqual(params(pattern, url), expected);
	});
}

test("path params: take precedence over query params of the same name", () => {
	assert.equal(params("/a/{id}", "/a/1?id=2").id, "1");
});

test("rest params: are named without the asterisk", () => {
	assert.equal(params("/a/{r*}", "/a/1/2").r, "1/2");
	assert.equal(params("/a/:r*:", "/a/1/2").r, "1/2");
});

test("rest params: required rest does not swallow the query string", () => {
	assert.deepStrictEqual(params("/a/{r*}", "/a/1/2?x=1"), { r: "1/2", x: "1" });
});

test("rest params: optional rest does not swallow the query string", () => {
	assert.deepStrictEqual(params("/a/:r*:", "/a?x=1"), { r: undefined, x: "1" });
});

for (const [pattern, url, expected] of [
	["/a/{r*}", "/a/1", { r: "1" }],
	["/a/{r*}", "/a/1?x=1", { r: "1", x: "1" }],
	["/a/{r*}", "/a/1/2/3?x=/b/c", { r: "1/2/3", x: "/b/c" }],
	["/a/{r*}", "/a?x=1", null],
	["/a/{r*}", "/a/?x=1", null],
	["/a/{r*}/b", "/a/1/2/b?x=1", { r: "1/2", x: "1" }],
	["/a/{r*}/b", "/a/1/2", null],
	["/a/{id}/{r*}", "/a/1/2/3", { id: "1", r: "2/3" }],
	["/a/:r*:", "/a", { r: undefined }],
	["/a/:r*:", "/a/", null],
	["/a/:r*:", "/a/1/2/", { r: "1/2/" }],
	["/a/:r*:", "/a/?x=1", null],
	["/a/:r*:", "/a/1/2?x=1", { r: "1/2", x: "1" }],
	["/{r*}", "/1/2?x=1", { r: "1/2", x: "1" }],
	["/:r*:", "/?x=1", { r: undefined, x: "1" }],
	["/:r*:", "/1/2?x=1", { r: "1/2", x: "1" }],
]) {
	test(`rest params: "${pattern}" ${expected ? "matches" : "does not match"} "${url}"`, () => {
		if (expected === null)
			assert.equal(routerWith(pattern).parse(url), null);
		else
			assert.deepStrictEqual(params(pattern, url), expected);
	});
}

for (const [pattern, values, expected] of [
	["/a/{r*}", { r: "x" }, "/a/x"],
	["/a/{r*}/b", { r: "x/y" }, "/a/x/y/b"],
	["/a/{r*}", { r: "x/y", query: { z: 1 } }, "/a/x/y?z=1"],
	["/a/:r*:", { r: "x/y" }, "/a/x/y"],
	["/a/:r*:", { query: { z: 1 } }, "/a?z=1"],
]) {
	test(`rest params: interpolate "${pattern}" with ${JSON.stringify(values)}`, () => {
		assert.equal(interpolate(pattern, values), expected);
	});
}

test("rest params: a missing required rest throws", () => {
	assert.throws(() => interpolate("/a/{r*}", {}), /is required/);
});

test("rest params: round trip", () => {
	const values = { r: "x/y/z", id: "1" };
	assert.deepStrictEqual(params("/a/{id}/{r*}", interpolate("/a/{id}/{r*}", values)), values);
});

test("path params: are percent decoded", () => {
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

test("query: a repeated key becomes an array", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&x=2"), { x: ["1", "2"] });
});

test("query: three repeats become one flat array", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&x=2&x=3"), { x: ["1", "2", "3"] });
});

test("query: a key matching an Object.prototype member is an ordinary param", () => {
	assert.equal(params("/a", "/a?toString=1").toString, "1");
});

test("query: malformed percent encoding does not throw", () => {
	assert.doesNotThrow(() => routerWith("/a").parse("/a?x=%"));
});

test("query: malformed values are kept raw and don't affect other params", () => {
	assert.deepStrictEqual(params("/a", "/a?x=100%&y=a%20b&z=%E0%A4%A"), { x: "100%", y: "a b", z: "%E0%A4%A" });
});

for (const [query, expected] of [
	["?flag", { flag: null }],
	["?flag=", { flag: "" }],
	["?flag&x=1", { flag: null, x: "1" }],
	["?x=1&flag", { x: "1", flag: null }],
	["?x=1&flag&y=2", { x: "1", flag: null, y: "2" }],
	["?flag#h", { flag: null, hash: "h" }],
	["?my%20flag", { "my flag": null }],
	["?flag&flag", { flag: [null, null] }],
	["?flag&flag=1", { flag: [null, "1"] }],
	["?flag=1&flag", { flag: ["1", null] }],
]) {
	test(`query: valueless: "${query}"`, () => {
		assert.deepStrictEqual(params("/a", "/a" + query), expected);
	});
}

test("query: a valueless param doesn't override a path param", () => {
	assert.equal(params("/a/{id}", "/a/1?id").id, "1");
});

for (const [query, expected] of [
	["?&x=1", { x: "1" }],
	["?x=1&", { x: "1" }],
	["?&", {}],
	["?x=?", { x: "?" }],
	["?x=1&y=/b?z", { x: "1", y: "/b?z" }],
	["?a%3Db=1", { "a=b": "1" }],
	["?x%=1", { "x%": "1" }],
	["?x%20y=1&x%20y=2", { "x y": ["1", "2"] }],
]) {
	test(`query: edge case: "${query}"`, () => {
		assert.deepStrictEqual(params("/a", "/a" + query), expected);
	});
}

test("query: an empty part does not discard later params", () => {
	assert.deepStrictEqual(params("/a", "/a?x=1&&y=2"), { x: "1", y: "2" });
});

test("query: a question mark in a value is kept", () => {
	assert.equal(params("/a", "/a?x=a?b").x, "a?b");
});

test("query: keys are percent decoded", () => {
	assert.deepStrictEqual(params("/a", "/a?x%20y=1"), { "x y": "1" });
});

for (const [query, expected] of [
	["?x=a+b", { x: "a b" }],
	["?x=a++b+", { x: "a  b " }],
	["?x=a%2Bb", { x: "a+b" }],
	["?x=a+b%20c%2Bd", { x: "a b c+d" }],
	["?x+y=1", { "x y": "1" }],
	["?my+flag", { "my flag": null }],
	["?x=a+b%", { x: "a b%" }],
]) {
	test(`query: plus is a space: "${query}"`, () => {
		assert.deepStrictEqual(params("/a", "/a" + query), expected);
	});
}

test("path params: plus is a literal plus", () => {
	assert.equal(params("/a/{id}", "/a/x+y").id, "x+y");
});

test("hash: plus is a literal plus", () => {
	assert.equal(routerWith("/a").parse("/a#x+y").params.hash, "x+y");
});

test("interpolate: a plus in a query value is encoded", () => {
	assert.equal(interpolate("/a", { query: { x: "a+b" } }), "/a?x=a%2Bb");
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

test("reserved names: a query param called hash is ignored", () => {
	assert.equal(routerWith("/a").parse("/a?hash=q").params.hash, undefined);
	assert.deepStrictEqual(params("/a", "/a?hash=q&x=1#h"), { x: "1", hash: "h" });
});

test("reserved names: a query param called __proto__ is ignored", () => {
	const result = routerWith("/a").parse("/a?__proto__=q&x=1").params;
	assert.equal(Object.getPrototypeOf(result), Object.prototype);
	assert.equal(result.x, "1");
});

for (const name of ["hash", "query", "__proto__"]) {
	for (const pattern of [`/a/{${name}}`, `/a/:${name}:`, `/a/{${name}*}`, `/a/:${name}*:`, `/a{?${name}}`, `/a:?${name}:`]) {
		test(`reserved names: pattern "${pattern}" throws and is not registered`, () => {
			const router = new Router();
			assert.throws(() => router.addRoute("a", pattern, {}), /name is reserved/);
			assert.equal(router.parse("/a/1"), null);
			assert.throws(() => router.interpolate("a", {}), /Cannot find route/);
		});
	}
}

for (const name of ["hashes", "Hash", "queryId", "myhash"]) {
	test(`reserved names: "${name}" is allowed`, () => {
		assert.deepStrictEqual(params(`/a/{${name}}`, "/a/1"), { [name]: "1" });
	});
}

test("reserved names: a literal segment is allowed", () => {
	assert.notEqual(routerWith("/hash/query").parse("/hash/query"), null);
});

test("reserved names: interpolating a query param called hash throws", () => {
	assert.throws(() => interpolate("/a", { query: { hash: "q" } }), /name is reserved/);
});

test("reserved names: a query param called query is allowed", () => {
	const query = { query: "q" };
	assert.deepStrictEqual(params("/a", interpolate("/a", { query })), query);
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

test("interpolate: a slash in a plain segment is encoded", () => {
	assert.equal(interpolate("/a/{id}", { id: "x/y" }), "/a/x%2Fy");
});

test("interpolate: an object as a path param throws", () => {
	assert.throws(() => interpolate("/a/{id}", { id: {} }), /objects are only supported for query strings/);
});

test("interpolate: characters which are safe in a path stay readable", () => {
	assert.equal(interpolate("/a/{id}", { id: "a:b@c$d&e+f,g;h=i" }), "/a/a:b@c$d&e+f,g;h=i");
});

for (const [query, expected] of [
	[{ flag: null }, "/a?flag"],
	[{ flag: "" }, "/a?flag="],
	[{ flag: undefined }, "/a"],
	[{ x: 1, flag: null, y: undefined, z: 2 }, "/a?x=1&flag&z=2"],
	[{ flag: [null, "1"] }, "/a?flag&flag=1"],
	[{ x: ["1", undefined, "2"] }, "/a?x=1&x=2"],
	[{ "my flag": null }, "/a?my%20flag"],
	["x=a#b", "/a?x=a%23b"],
]) {
	test(`interpolate: query values: ${JSON.stringify(query)} to "${expected}"`, () => {
		assert.equal(interpolate("/a", { query }), expected);
	});
}

test("interpolate: does not mutate its values", () => {
	const values = Object.freeze({ id: 1 });
	assert.equal(interpolate("/a/{id}", values), "/a/1");
});

for (const [pattern, values, expected] of [
	["/a/:x:/:y:", {}, "/a"],
	["/a/:x:/:y:", { x: 1 }, "/a/1"],
	["/a/:x:/:y:", { x: 1, y: 2 }, "/a/1/2"],
	["/:x:", {}, "/"],
	["/:x:/:y:", {}, "/"],
	["/a/:r*:", {}, "/a"],
]) {
	test(`interpolate: optional segments: "${pattern}" with ${JSON.stringify(values)}`, () => {
		assert.equal(interpolate(pattern, values), expected);
	});
}

test("interpolate: rest params accept slashes", () => {
	assert.equal(interpolate("/a/{r*}", { r: "x/y" }), "/a/x/y");
});

test("interpolate: a query object builds a query string", () => {
	const url = interpolate("/a", { query: { x: 1, y: "b c" } });
	assert.deepStrictEqual(params("/a", url), { x: "1", y: "b c" });
});

test("interpolate: a query object separates keys and values with a literal =", () => {
	assert.match(interpolate("/a", { query: { x: 1 } }), /^\/a\/?\?x=1$/);
});

test("interpolate: a query array repeats its key", () => {
	assert.match(interpolate("/a", { query: { x: [1, 2] } }), /\?x=1&x=2$/);
});

for (const [pattern, values, expected] of [
	["/a", { query: {} }, "/a"],
	["/a", { query: "" }, "/a"],
	["/a", { query: "?" }, "/a"],
	["/a", { query: { x: [] } }, "/a"],
	["/a", { query: null }, "/a"],
	["/a", { query: "?x=1" }, "/a?x=1"],
	["/a", { query: "x=1" }, "/a?x=1"],
	["/a", { query: "?x=/b" }, "/a?x=/b"],
	["/a", { query: { x: 1, y: 2 } }, "/a?x=1&y=2"],
	["/a", { query: { x: "a/b?c&d=e" } }, "/a?x=a%2Fb%3Fc%26d%3De"],
	["/a", { query: { "x[]": [1, 2] } }, "/a?x[]=1&x[]=2"],
	["/a/", { query: { x: 1 } }, "/a/?x=1"],
	["/a/", { query: {} }, "/a/"],
	["/a/{id}/", { id: 1, query: { x: 1 } }, "/a/1/?x=1"],
	["/", { query: { x: 1 } }, "/?x=1"],
	["/", { query: {} }, "/"],
	["/a/{id}", { id: 1, query: { x: 1 } }, "/a/1?x=1"],
	["/a/:id:", { query: { x: 1 } }, "/a?x=1"],
	["/a/:id:", { id: 1, query: { x: 1 } }, "/a/1?x=1"],
	["/:id:", { query: { x: 1 } }, "/?x=1"],
	["/:x:/:y:", { query: { x: 1 } }, "/?x=1"],
	["/a/{id}{?q}", { id: 1, q: { x: 1 } }, "/a/1?x=1"],
]) {
	test(`interpolate: query: "${pattern}" with ${JSON.stringify(values)}`, () => {
		assert.equal(interpolate(pattern, values), expected);
	});
}

test("interpolate: query: an empty required query throws", () => {
	assert.throws(() => interpolate("/a/{?q}", { q: {} }), /segment \{\?q\} is required/);
});

test("interpolate: query: round trips", () => {
	const query = { x: "a b", y: "?&=#/+%", z: ["1", "2"] };
	assert.deepStrictEqual(params("/a/{id}", interpolate("/a/{id}", { id: 1, query })), { ...query, id: "1" });
});

test("interpolate: values are percent encoded", () => {
	assert.equal(interpolate("/a/{id}", { id: "a?b#c d" }), "/a/a%3Fb%23c%20d");
});

test("interpolate: a trailing slash in the pattern is kept", () => {
	assert.equal(interpolate("/a/", {}), "/a/");
});

test("interpolate: an empty required param throws", () => {
	assert.throws(() => interpolate("/a/{id}", { id: "" }), /required/);
});

// --- round trips -----------------------------------------------------------

for (const id of ["1", "AbC", "x-y_z.~", "a:b", "a=b&c"]) {
	test(`round trip: "${id}"`, () => {
		assert.equal(params("/a/{id}", interpolate("/a/{id}", { id })).id, id);
	});
}

for (const id of ["a?b", "a#b"]) {
	test(`round trip: "${id}"`, () => {
		assert.equal(params("/a/{id}", interpolate("/a/{id}", { id })).id, id);
	});
}

const awkward = ["1", "a b", "a/b", "a?b", "a#b", "a%b", "%", "%20", "%2F", "a+b", "a&b=c", "ü", "日本", "😀", "{x}", ":x:", "a*", "[]", "\"'", "$&", "a\\b"];

for (const value of awkward) {
	test(`round trip: path param ${JSON.stringify(value)}`, () => {
		assert.deepStrictEqual(params("/a/{id}/b", interpolate("/a/{id}/b", { id: value })), { id: value });
		assert.deepStrictEqual(params("/a/:id:", interpolate("/a/:id:", { id: value })), { id: value });
	});

	test(`round trip: rest param ${JSON.stringify(value)}`, () => {
		const values = { r: `x/${value}/y` };
		assert.deepStrictEqual(params("/a/{r*}", interpolate("/a/{r*}", values)), values);
	});

	test(`round trip: query ${JSON.stringify(value)}`, () => {
		const query = { v: value, [value]: "v", list: [value, "", null] };
		assert.deepStrictEqual(params("/a", interpolate("/a", { query })), query);
	});
}

// --- pattern validation ----------------------------------------------------

for (const [pattern, reason] of [
	// optional params are whole segments, at the end
	["/a/:id:/", /end of the path/],
	["/a/:id:/b", /end of the path/],
	["/:x:/b", /end of the path/],
	["/a/:x:/{y}", /end of the path/],
	["/a/:x:/:y:/b", /end of the path/],
	["/a/:r*:/b", /end of the path/],
	["/a/:r*:/:y:", /can't follow a rest param/],
	["/a/{r*}/:y:", /can't follow a rest param/],
	["/a/x:id:", /whole segment/],
	["/a/x-:id:", /whole segment/],
	["/a/:id:x", /whole segment/],
	["/a/{x}:y:", /whole segment/],
	// stray syntax
	["/a/:b", /whole segment/],
	["/a/::", /whole segment/],
	["/a/{id", /unmatched brace/],
	["/a/id}", /unmatched brace/],
	["/a/{{id}}", /unmatched brace/],
	["/a/{}", /valid name/],
	["/a/{*}", /valid name/],
	["/a/{x y}", /valid name/],
	["/a/{a/b}", /unmatched brace/],
	["/a{?}", /valid name/],
	["/a{?q*}", /valid name/],
	["/a?x=1", /can't contain/],
	["/a#h", /can't contain/],
	["/a{?q}/b", /can't contain/],
	["//a", /empty segment/],
	["/a//b", /empty segment/],
	["/a/../b", /browsers resolve/],
	["/a/./b", /browsers resolve/],
	// ambiguous params
	["/{a}{b}", /between them/],
	["/{id}/b/{id}", /more than one param called "id"/],
	["/{id}/:id:", /more than one param called "id"/],
	["/{id}/{id*}", /more than one param called "id"/],
	["/{id}{?id}", /more than one param called "id"/],
]) {
	test(`validation: "${pattern}" is rejected`, () => {
		const router = new Router();
		assert.throws(() => router.addRoute("a", pattern, {}), reason);
		assert.equal(router.routes.length, 0);
		assert.throws(() => router.interpolate("a", {}), /Cannot find route/);
	});
}

// --- literals --------------------------------------------------------------

for (const [pattern, url, matches] of [
	["/a|b", "/a|b", true],
	["/a|b", "/a", false],
	["/x|/y", "/zzz/y", false],
	["/a(b)[c]^$.*+-!", "/a(b)[c]^$.*+-!", true],
	["/a\\d", "/a1", false],
	["/café", "/café", true],
	["/café", "/caf%C3%A9", true],
	["/café", "/caf%c3%a9", true],
	["/café", "/cafe", false],
	["/caf%C3%A9", "/café", true],
	["/caf%C3%A9", "/caf%C3%A9", true],
	["/a b", "/a%20b", true],
	["/a%20b", "/a%20b", true],
	["/😀", "/😀", true],
	["/😀", "/%F0%9F%98%80", true],
	["/a%2Fb", "/a%2Fb", true],
	["/a%2Fb", "/a/b", false],
	["/100%", "/100%", true],
	["/a:b", "/a:b", true],
	["/a:b", "/a", false],
]) {
	test(`literals: "${pattern}" ${matches ? "matches" : "does not match"} "${url}"`, () => {
		assert.equal(routerWith(pattern).parse(url) !== null, matches);
	});
}

for (const pattern of ["/café", "/a b", "/a|b", "/😀", "/a%2Fb", "/100%", "/a:b", "/a-/{id}", "/é/{id}"]) {
	test(`literals: "${pattern}" is built as a browser would show it`, () => {
		const url = interpolate(pattern, { id: 1 });
		assert.match(url, /^[\x21-\x7e]+$/);
		assert.notEqual(routerWith(pattern).parse(url), null);
	});
}

test("params: can be separated by a colon", () => {
	assert.deepStrictEqual(params("/t/{h}:{m}:{s}", "/t/1:2:3"), { h: "1", m: "2", s: "3" });
	assert.equal(interpolate("/t/{h}:{m}:{s}", { h: 1, m: 2, s: 3 }), "/t/1:2:3");
});

for (const pattern of ["/a-/:id:", "/é/:id:", "/a./:id:", "/{x}/:id:", "/a)/:id:"]) {
	test(`optional segments: "${pattern}" works whatever precedes it`, () => {
		const without = interpolate(pattern, { x: 1 });
		const withId = interpolate(pattern, { x: 1, id: 2 });
		assert.equal(without + "/2", withId);
		assert.equal(params(pattern, without).id, undefined);
		assert.equal(params(pattern, withId).id, "2");
		assert.equal(routerWith(pattern).parse(without + "/"), null);
	});
}

for (const [pattern, url, expected] of [
	[":id:", "/", { id: undefined }],
	[":id:", "/1", { id: "1" }],
	["/:x:/:y:", "/", { x: undefined, y: undefined }],
	["/:x:/:y:", "/1", { x: "1", y: undefined }],
	["/:x:/:y:", "/1/2", { x: "1", y: "2" }],
	["/a/:x:/:r*:", "/a/1", { x: "1", r: undefined }],
	["/a/:x:/:r*:", "/a/1/2/3", { x: "1", r: "2/3" }],
	["/a/:id::?q:", "/a?x=1", { id: undefined, x: "1" }],
	["/a/:id:", "/a?id=5", { id: "5" }],
	["/a/:id:", "/a/1?id=5", { id: "1" }],
]) {
	test(`optional segments: "${pattern}" from "${url}" gives ${JSON.stringify(expected)}`, () => {
		assert.deepStrictEqual(params(pattern, url), expected);
	});
}

for (const url of ["/", "//", "//a"]) {
	test(`rest params: "/{r*}" does not match "${url}"`, () => {
		assert.equal(routerWith("/{r*}").parse(url), null);
	});
}

// --- unsafe and ambiguous values -------------------------------------------

test("interpolate: a later optional param needs the earlier ones", () => {
	assert.throws(() => interpolate("/a/:x:/:y:", { y: 2 }), /segment :x: is required when :y: has a value/);
});

test("interpolate: inherited properties are not values", () => {
	assert.equal(interpolate("/a/:constructor:", {}), "/a");
	assert.throws(() => interpolate("/a/{toString}", {}), /is required/);
	assert.throws(() => interpolate("/a/{id}", Object.create({ id: 1 })), /is required/);
});

for (const value of [".", ".."]) {
	test(`interpolate: a segment of "${value}" throws`, () => {
		assert.throws(() => interpolate("/a/{id}", { id: value }), /browsers resolve/);
		assert.throws(() => interpolate("/a/:id:", { id: value }), /browsers resolve/);
		assert.throws(() => interpolate("/a/{r*}", { r: `x/${value}/y` }), /browsers resolve/);
	});
}

test("interpolate: dots within a segment are fine", () => {
	assert.equal(interpolate("/a/{id}", { id: "..." }), "/a/...");
	assert.equal(interpolate("/a/{id}", { id: ".x" }), "/a/.x");
	assert.equal(interpolate("/a/{name}.{ext}", { name: "x", ext: "js" }), "/a/x.js");
});

test("interpolate: a value can't make a protocol relative url", () => {
	assert.throws(() => interpolate("/{r*}", { r: "/evil.example" }), /parsed differently/);
	assert.throws(() => interpolate("/:r*:", { r: "/evil.example" }), /parsed differently/);
});

test("interpolate: values which would parse differently throw", () => {
	assert.equal(interpolate("/{x}-{y}", { x: "1-2", y: "3" }), "/1-2-3");
	assert.deepStrictEqual(params("/{x}-{y}", "/1-2-3"), { x: "1-2", y: "3" });
	assert.throws(() => interpolate("/{x}-{y}", { x: "1", y: "2-3" }), /parsed differently/);
	assert.throws(() => interpolate("/{a*}/{b*}", { a: "1", b: "2/3" }), /parsed differently/);
});

for (const value of ["__CR_OS__", "__CR_OMITTED__", "__CR_QUERY__", "{id}", ":id:"]) {
	test(`interpolate: "${value}" is an ordinary value`, () => {
		assert.equal(params("/a/{id}", interpolate("/a/{id}", { id: value })).id, value);
	});
}

test("interpolate: an unpaired surrogate throws", () => {
	assert.throws(() => interpolate("/a/{id}", { id: "\ud800" }), /Error interpolating route/);
});

for (const query of [{ x: { y: 1 } }, { x: [[1]] }, { x: new Date(0) }, { x: () => 1 }, ["x"], 5, true]) {
	test(`interpolate: query of ${JSON.stringify(query)} ${typeof query} throws`, () => {
		assert.throws(() => interpolate("/a", { query }), /Invalid value for query param|should be an object or a string/);
	});
}

test("interpolate: query can be URLSearchParams", () => {
	assert.deepStrictEqual(params("/a", interpolate("/a", { query: new URLSearchParams({ x: "a b", y: "+" }) })), { x: "a b", y: "+" });
});

for (const query of ["hash=1", "?x=1&hash=2", "h%61sh=1", "hash", "__proto__=1"]) {
	test(`reserved names: query string "${query}" throws`, () => {
		assert.throws(() => interpolate("/a", { query }), /name is reserved/);
	});
}

test("interpolate: errors keep their cause", () => {
	assert.throws(() => interpolate("/a/{id}", {}), e => e.cause instanceof Error && /\/a\/\{id\}/.test(e.message));
});

test("result: pattern is the registered pattern", () => {
	assert.equal(routerWith("/a/{id}").parse("/a/1?x=1").pattern, "/a/{id}");
});

test("performance: long urls which don't match are rejected quickly", () => {
	const long = "/" + "a/".repeat(5000) + "!";
	const start = Date.now();
	for (const pattern of ["/{x}/{y}/{z}", "/a/:x:/:y:/:z:", "/{r*}/z", "/a/:x:/:r*:"])
		routerWith(pattern).parse(long + "/");
	assert.ok(Date.now() - start < 1000);
});

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
	assert.throws(() => router.addRoute("a", "/b", {}), /A route called a already exists/);
});

test("interpolate: names of Object.prototype members are unknown routes", () => {
	assert.throws(() => new Router().interpolate("toString", {}), /Cannot find route by name toString/);
});

test("registration: a rejected duplicate leaves the router unchanged", () => {
	const router = routerWith(["a", "/a", {}]);
	assert.throws(() => router.addRoute("a", "/b", {}));
	assert.equal(router.interpolate("a"), "/a");
	assert.equal(router.parse("/b"), null);
});

for (const name of ["parse", "interpolate", "addRoute", "patternLexer", "routes", "routesByName", "constructor", "toString", "__proto__"]) {
	test(`registration: a route can be called "${name}"`, () => {
		const router = routerWith([name, "/a", {}], ["other", "/b", {}]);
		assert.equal(router.parse("/a").name, name);
		assert.equal(router.interpolate(name, {}), "/a");
	});
}

test("toString: router does not throw", () => {
	assert.doesNotThrow(() => routerWith("/a").toString());
});

test("toString: route does not throw", () => {
	assert.doesNotThrow(() => new Router().addRoute("a", "/a", {}).toString());
});
