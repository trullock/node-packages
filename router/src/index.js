import PatternLexer from './pattern-lexer.js'

// malformed encoding (e.g. "%") is left as-is, a bad link shouldn't break parsing
function safeDecode(str)
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

// in a query string (unlike in a path) a literal plus means a space
function decodeQueryPart(str)
{
	return safeDecode(str.replace(/\+/g, ' '));
}

// queryStr must not include the leading "?"
function decodeQueryString(queryStr)
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

		if (!Object.hasOwn(obj, name))
			obj[name] = value;
		else if (Array.isArray(obj[name]))
			obj[name].push(value);
		else
			obj[name] = [obj[name], value];
	}

	return obj;
}

// names which can't be used for params in a route's pattern:
// - hash holds the fragment of a parsed url
// - query holds the query string values when interpolating
// - __proto__ can't be stored as an ordinary property
const RESERVED_NAMES = new Set(['hash', 'query', '__proto__']);

function checkReservedParams(pattern, paramIds)
{
	for (let id of paramIds)
	{
		let name = id.replace(/^\?/, '');
		if (RESERVED_NAMES.has(name))
			throw new Error(`Route pattern ${pattern} can't have a param called "${name}", the name is reserved.`);
	}
}

function Route(name, pattern, data, priority, router) {
	this._name = name;
	this._router = router;
	this._pattern = pattern;
	this._paramsIds = router.patternLexer.getParamIds(pattern);
	this._matchRegexp = router.patternLexer.compilePattern(pattern, router.ignoreCase);
	this._data = data;
	this._priority = priority || 0;
}

Route.prototype = {

	match: function (request) {
		return this._matchRegexp.test(request);
	},

	_getParamsObject: function (request) {
		let values = this._router.patternLexer.getParamValues(request, this._matchRegexp)
		let o = {}
		let n = values.length
		let param
		let val

		while (n--)
		{
			param = this._paramsIds[n];
			val = values[n];
			
			if (param.indexOf('?') === 0 && val)
			{
				val = decodeQueryString(val);
				
				for(var key in val){
					if(!Object.hasOwn(o, key))
						o[key] = val[key];
					else
						o['?' + key] = val[key];
				}
			}
			else if(param == '?query' && !val)
			{
				// noop
			}
			else 
			{
				// optional params have no value when omitted
				o[param] = typeof val === 'string' ? safeDecode(val) : val;
			}
			
		}

		return o;
	},

	interpolate: function (replacements) {
		try
		{
			var str = this._router.patternLexer.interpolate(this._pattern, replacements);
			return str;
		}
		catch(e)
		{
			throw new Error(`Error interpolating route ${this._pattern} with values ${JSON.stringify(replacements)}\n` + e);
		}
	}

};


export default class
{
	constructor()
	{
		this.routes = [];
		// no prototype, so that any name is usable
		this.routesByName = Object.create(null);
		this.patternLexer = PatternLexer();
	}

	addRoute (name, pattern, data, priority)
	{
		if (typeof pattern !== 'string')
			throw new TypeError('Route pattern should be a string.');

		if (this.routesByName[name])
			throw new Error(`A route called ${name} already exists.`);

		checkReservedParams(pattern, this.patternLexer.getParamIds(pattern));

		pattern += ':?query:';
		var route = new Route(name, pattern, data, priority, this);

		var n = this.routes.length;
		do
		{ 
			--n; 
		} while (this.routes[n] && route._priority <= this.routes[n]._priority);

		this.routes.splice(n + 1, 0, route);

		this.routesByName[name] = route;

		return route;
	}

	interpolate(name, data)
	{
		if(!this.routesByName[name])
			throw new Error(`Cannot find route by name ${name}`);
			
		return this.routesByName[name].interpolate(data);
	}

	parse (request)
	{
		var n = this.routes.length;
		var route, hash, path;

		var index = request.indexOf('#');
		if(index > -1)
		{
			hash = request.substr(index + 1);
			request = request.substr(0, index);
		}

		index = request.indexOf('?');
		if(index > -1)
			path = request.substr(0, index)
		else
			path = request;	
		
		while (route = this.routes[--n])
		{
			if (route.match(request))
			{
				var params = route._getParamsObject(request);
				params.hash = hash;

				return {
					path,
					
					name: route._name,
					pattern: route._pattern,
					data: route._data,
					params: params
				};
			}
		}

		return null;
	}
};