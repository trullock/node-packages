// names which can't be used for params:
// - hash holds the fragment of a parsed url
// - query holds the query string values when interpolating
// - __proto__ can't be stored as an ordinary property
export const RESERVED_PARAMS = new Set(['hash', 'query', '__proto__']);

// "query" is only special when interpolating, so is fine within a query string
const RESERVED_QUERY_PARAMS = new Set(['hash', '__proto__']);

// malformed encoding (e.g. "%") is left as-is, a bad link shouldn't break parsing
export function safeDecode(str)
{
	try
	{
		return decodeURIComponent(str);
	}
	catch(e)
	{
		return str;
	}
}

// encodes a path segment, leaving readable the characters which are safe within one
export function encodeSegment(val)
{
	return encodeURIComponent(val).replace(/%(?:3A|40|24|26|2B|2C|3B|3D)/g, decodeURIComponent);
}

// in a query string (unlike in a path) a literal plus means a space
function decodeQueryPart(str)
{
	return safeDecode(str.replace(/\+/g, ' '));
}

// queryStr must not include the leading "?"
export function decodeQuery(queryStr)
{
	let obj = {};

	for (let part of queryStr.split('&'))
	{
		if (!part)
			continue;

		let equalIndex = part.indexOf('=');
		let hasValue = equalIndex > -1;
		let name = decodeQueryPart(hasValue ? part.substring(0, equalIndex) : part);
		// "?flag" has no value, as distinct from the empty value of "?flag="
		let value = hasValue ? decodeQueryPart(part.substring(equalIndex + 1)) : null;

		if (RESERVED_QUERY_PARAMS.has(name))
			continue;

		if (!Object.hasOwn(obj, name))
			obj[name] = value;
		else if (Array.isArray(obj[name]))
			obj[name].push(value);
		else
			obj[name] = [obj[name], value];
	}

	return obj;
}

function checkQueryName(name)
{
	// parsing ignores these
	if (RESERVED_QUERY_PARAMS.has(name))
		throw new Error(`A query param can't be called "${name}", the name is reserved.`);
}

// the inverse of decodeQuery. Returns no leading "?"
export function encodeQuery(query)
{
	if (query instanceof URLSearchParams)
		query = query.toString();

	if (typeof query === 'string')
	{
		query = query.replace(/^\?/, '').replace(/#/g, '%23');
		query.split('&').forEach(part => checkQueryName(decodeQueryPart(part.split('=')[0])));
		return query;
	}

	if (typeof query !== 'object' || Array.isArray(query))
		throw new Error('A query should be an object or a string.');

	let parts = [];

	for (let key of Object.keys(query))
	{
		checkQueryName(key);
		let name = encodeURIComponent(key).replace(/%5B%5D$/, '[]');

		for (let val of Array.isArray(query[key]) ? query[key] : [query[key]])
		{
			if (val === undefined)
				continue;

			if (val !== null && (typeof val === 'object' || typeof val === 'function'))
				throw new Error(`Invalid value for query param "${key}", only simple values and arrays of them are supported.`);

			// null is a name with no value
			parts.push(val === null ? name : name + '=' + encodeURIComponent(val));
		}
	}

	return parts.join('&');
}
