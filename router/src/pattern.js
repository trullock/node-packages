import { RESERVED_PARAMS, decodeQuery, encodeQuery, encodeSegment, safeDecode } from './encoding.js';

// Splits a pattern into parts, once, from which urls are both matched and built:
//
// segments: the required path segments, each a list of literals (strings) and params
// optionals: the optional params, which follow the segments
// query: the query string param
function tokenize(pattern)
{
	function fail(reason) {
		throw new Error(`Invalid route pattern "${pattern}": ${reason}`);
	}

	if (typeof pattern !== 'string')
		throw new TypeError('Route pattern should be a string.');

	let names = new Set();

	function createParam(text, name, props) {
		let param = { text, name: name.replace(/\*$/, ''), rest: name.endsWith('*'), ...props };

		if (!/^[^\s/?#*:{}]+$/.test(param.name))
			fail(`"${text}" doesn't have a valid name.`);
		if (RESERVED_PARAMS.has(param.name))
			fail(`a param can't be called "${param.name}", the name is reserved.`);
		if (names.has(param.name))
			fail(`there is more than one param called "${param.name}".`);

		names.add(param.name);
		return param;
	}

	function tokenizeSegment(segment) {
		// outside of a {param}, as names can't contain colons
		if (segment.startsWith(':') || /:[^:{}]+:/.test(segment))
			fail('an optional param should be a whole segment, like "/:name:". Other segments can\'t start with a colon.');
		if (segment === '.' || segment === '..')
			fail('segments can\'t be "." or "..", as browsers resolve them.');

		let tokens = [];
		for (let text of segment.split(/(\{[^{}]*\})/).filter(Boolean))
		{
			if (!/^\{[^{}]*\}$/.test(text))
			{
				if (/[{}]/.test(text))
					fail('it has an unmatched brace.');
				tokens.push(safeDecode(text));
				continue;
			}

			if (typeof tokens[tokens.length - 1] === 'object')
				fail('params need something between them.');
			tokens.push(createParam(text, text.slice(1, -1)));
		}
		return tokens;
	}

	let path = pattern;
	let query = { name: 'query', required: false };

	let queryMatch = /(?:\{\?([^{}]*)\}|:\?([^:{}]*):)$/.exec(pattern);
	if (queryMatch)
	{
		path = pattern.slice(0, queryMatch.index);
		query = createParam(queryMatch[0], queryMatch[1] ?? queryMatch[2], { required: queryMatch[1] !== undefined });
		if (query.rest)
			fail(`"${query.text}" doesn't have a valid name.`);
	}

	if (/[?#]/.test(path))
		fail('it can\'t contain "?" or "#", except for a query string param at the end.');

	let segments = [];
	let optionals = [];
	let hasRest = false;

	let parts = path.replace(/^\//, '').split('/');
	parts.forEach((segment, i) => {
		let optional = /^:([^:{}]+):$/.exec(segment);

		if (optional)
		{
			if (hasRest)
				fail('an optional param can\'t follow a rest param, which would always include it.');

			optionals.push(createParam(segment, optional[1]));
			hasRest = optionals[optionals.length - 1].rest;
			return;
		}

		if (optionals.length)
			fail('optional params should be at the end of the path.');
		if (!segment && i < parts.length - 1)
			fail('it has an empty segment.');

		let tokens = tokenizeSegment(segment);
		hasRest = hasRest || tokens.some(t => t.rest);
		segments.push(tokens);
	});

	return { segments, optionals, query };
}

// matches a literal whether or not it's been encoded, as browsers encode some characters in location.pathname
function literalToRegExp(literal)
{
	return [...literal].map(char => {
		let escaped = char.replace(/[\\^$.*+?()[\]{}|\/-]/, '\\$&');
		let encoded = encodeSegment(char);
		if (encoded === char)
			return escaped;

		encoded = encoded.replace(/[A-F]/g, hex => `[${hex}${hex.toLowerCase()}]`);
		// as themselves, these would be part of the url's structure
		return /[/?#]/.test(char) ? encoded : `(?:${escaped}|${encoded})`;
	}).join('');
}

function paramToRegExp(param)
{
	return param.rest ? '([^/].*)' : '([^/]+)';
}

function encodeParam(param, value)
{
	if (typeof value === 'object' || typeof value === 'function')
		throw new Error(`Invalid value for segment ${param.text}, objects are only supported for query strings.`);

	value = String(value);
	return param.rest ? value.split('/').map(encodeSegment).join('/') : encodeSegment(value);
}

export default class Pattern
{
	constructor(pattern, ignoreCase)
	{
		let { segments, optionals, query } = tokenize(pattern);

		this.segments = segments;
		this.optionals = optionals;
		this.query = query;
		this.leadingSlash = pattern.startsWith('/') ? '/' : '';
		this.params = segments.flat().filter(t => typeof t === 'object').concat(optionals);

		let source = segments
			.map(tokens => tokens.map(t => typeof t === 'string' ? literalToRegExp(t) : paramToRegExp(t)).join(''))
			.join('\\/');

		// each optional param brings its preceding slash, and needs the one before it
		let optionalSource = optionals.reduceRight((inner, param, i) => {
			let slash = i == 0 && !segments.length ? '' : '\\/';
			return `(?:${slash}${paramToRegExp(param)}${inner})?`;
		}, '');

		this.regExp = new RegExp(`^\\/?${source}${optionalSource}$`, ignoreCase ? 'is' : 's');
	}

	// returns the params, or null if it doesn't match. path and queryStr are the parts either side of the "?"
	parse(path, queryStr)
	{
		let match = this.regExp.exec(path);
		if (!match || (this.query.required && !queryStr))
			return null;

		let params = decodeQuery(queryStr);

		this.params.forEach((param, i) => {
			let value = match[i + 1];
			// an absent optional param doesn't hide a query param
			if (value !== undefined)
				params[param.name] = safeDecode(value);
			else if (!Object.hasOwn(params, param.name))
				params[param.name] = undefined;
		});

		return params;
	}

	interpolate(values)
	{
		// inherited properties, e.g. toString, aren't values
		let getValue = name => {
			let value = values != null && Object.hasOwn(values, name) ? values[name] : null;
			return value === '' || value === undefined ? null : value;
		};

		let encodeRequired = param => {
			let value = getValue(param.name);
			if (value === null)
				throw new Error(`The segment ${param.text} is required.`);
			return encodeParam(param, value);
		};

		let built = this.segments.map(tokens => tokens
			.map(t => typeof t === 'string' ? encodeSegment(t) : encodeRequired(t))
			.join(''));

		let omitted = null;
		for (let param of this.optionals)
		{
			let value = getValue(param.name);
			if (value === null)
				omitted = omitted || param;
			else if (omitted)
				throw new Error(`The segment ${omitted.text} is required when ${param.text} has a value.`);
			else
				built.push(encodeParam(param, value));
		}

		let path = this.leadingSlash + built.join('/');
		this.checkParsesBack(path, getValue);

		let query = getValue(this.query.name);
		let queryStr = query === null ? '' : encodeQuery(query);
		if (!queryStr && this.query.required)
			throw new Error(`The segment ${this.query.text} is required.`);

		return queryStr ? path + '?' + queryStr : path;
	}

	// some values are ambiguous in some patterns, e.g. one containing a "-" in {x}-{y}
	checkParsesBack(path, getValue)
	{
		if (path.split('/').some(segment => segment === '.' || segment === '..'))
			throw new Error('A segment can\'t be "." or "..", as browsers resolve them.');

		let match = this.regExp.exec(path);
		this.params.forEach((param, i) => {
			let value = getValue(param.name);
			let parsed = match?.[i + 1];
			if (value === null ? parsed !== undefined : parsed === undefined || safeDecode(parsed) !== String(value))
				throw new Error(`Invalid value for segment ${param.text}, the url would be parsed differently.`);
		});
	}
}
