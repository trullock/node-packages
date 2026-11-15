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
