import PatternLexer from './pattern-lexer.js'

function isKind(val, kind)
{
	return '[object ' + kind + ']' === Object.prototype.toString.call(val);
}

function isRegExp(val)
{
	return isKind(val, 'RegExp');
}

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

function decodeQueryString(queryStr)
{
	let queryArr = (queryStr || '').replace('?', '').split('&'),
		i = -1,
		obj = {},
		equalIndex, cur, pValue, pName;

	while ((cur = queryArr[++i]))
	{
		equalIndex = cur.indexOf('=');
		pName = cur.substring(0, equalIndex);
		pValue = safeDecode(cur.substring(equalIndex + 1));

		if (Object.hasOwn(obj, pName))
		{
			if(Array.isArray(obj[pName]))
				obj[pName].push(pValue);
			else
				obj[pName] = [obj[pName], pValue];
			
		}
		else
		{
			obj[pName] = pValue;
	   }
	}
	return obj;
}

function Route(name, pattern, data, priority, router) {
	var isRegexPattern = isRegExp(pattern);
	this._name = name;
	this._router = router;
	this._pattern = pattern;
	this._paramsIds = isRegexPattern ? null : router.patternLexer.getParamIds(pattern);
	this._matchRegexp = isRegexPattern ? pattern : router.patternLexer.compilePattern(pattern, router.ignoreCase);
	this._data = data;
	this._priority = priority || 0;
}

Route.prototype = {

	match: function (request) {
		return this._matchRegexp.test(request);
	},

	_getParamsObject: function (request) {
		let shouldTypecast = this._router.shouldTypecast
		let values = this._router.patternLexer.getParamValues(request, this._matchRegexp, shouldTypecast)
		let o = {}
		let n = values.length
		let param
		let val

		while (n--)
		{
			if (!this._paramsIds)
				continue;

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
				o[param] = val;
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
		this.routesByName = {};
		this.patternLexer = PatternLexer();
	}

	addRoute (name, pattern, data, priority)
	{
		pattern += pattern.endsWith('/') ? ':?query:' : '/:?query:';
		var route = new Route(name, pattern, data, priority, this);

		var n = this.routes.length;
		do
		{ 
			--n; 
		} while (this.routes[n] && route._priority <= this.routes[n]._priority);

		this.routes.splice(n + 1, 0, route);

		this.routesByName[name] = route;
		Object.defineProperty(this, name, { get: () => pattern });

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
					path: path.toLowerCase(),
					
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