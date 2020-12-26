import PatternLexer from './pattern-lexer.js'

function isKind(val, kind) {
	return '[object ' + kind + ']' === Object.prototype.toString.call(val);
}
function isRegExp(val) {
	return isKind(val, 'RegExp');
}

function decodeQueryString(queryStr, shouldTypecast) {
	var queryArr = (queryStr || '').replace('?', '').split('&'),
		reg = /([^=]+)=(.+)/,
		i = -1,
		obj = {},
		equalIndex, cur, pValue, pName;

	while ((cur = queryArr[++i])) {
		equalIndex = cur.indexOf('=');
		pName = cur.substring(0, equalIndex);
		pValue = decodeURIComponent(cur.substring(equalIndex + 1));

		if (pName in obj){
			if(isArray(obj[pName])){
				obj[pName].push(pValue);
			} else {
				obj[pName] = [obj[pName], pValue];
			}
		} else {
			obj[pName] = pValue;
	   }
	}
	return obj;
}

function Route(name, pattern, pageClass, priority, router) {
	var isRegexPattern = isRegExp(pattern);
	this._name = name;
	this._router = router;
	this._pattern = pattern;
	this._paramsIds = isRegexPattern ? null : router.patternLexer.getParamIds(pattern);
	this._optionalParamsIds = isRegexPattern ? null : router.patternLexer.getOptionalParamsIds(pattern);
	this._matchRegexp = isRegexPattern ? pattern : router.patternLexer.compilePattern(pattern, router.ignoreCase);
	this._pageClass = pageClass;
	this._priority = priority || 0;
}

Route.prototype = {

	match: function (request) {
		return this._matchRegexp.test(request);
	},

	_isValidParam: function (request, prop, values) {
		var validationRule = this.rules[prop],
			val = values[prop],
			isValid = false,
			isQuery = (prop.indexOf('?') === 0);

		if (val == null && this._optionalParamsIds && arrayIndexOf(this._optionalParamsIds, prop) !== -1) {
			isValid = true;
		}
		else if (isRegExp(validationRule)) {
			if (isQuery)
				val = values[prop + '_']; //use raw string

			isValid = validationRule.test(val);
		}
		else if (isArray(validationRule)) {
			if (isQuery)
				val = values[prop + '_']; //use raw string

			isValid = this._isValidArrayRule(validationRule, val);
		}
		else if (isFunction(validationRule)) {
			isValid = validationRule(val, request, values);
		}

		return isValid; //fail silently if validationRule is from an unsupported type
	},

	_isValidArrayRule: function (arr, val) {
		if (!this._router.ignoreCase) {
			return arrayIndexOf(arr, val) !== -1;
		}

		if (typeof val === 'string') {
			val = val.toLowerCase();
		}

		var n = arr.length,
			item,
			compareVal;

		while (n--) {
			item = arr[n];
			compareVal = (typeof item === 'string') ? item.toLowerCase() : item;
			if (compareVal === val) {
				return true;
			}
		}
		return false;
	},

	_getParamsObject: function (request) {
		var shouldTypecast = this._router.shouldTypecast,
			values = this._router.patternLexer.getParamValues(request, this._matchRegexp, shouldTypecast),
			o = {},
			n = values.length,
			param, val;
		while (n--) {
			val = values[n];
			if (this._paramsIds) {
				param = this._paramsIds[n];
				if (param.indexOf('?') === 0 && val) {
					val = decodeQueryString(val, shouldTypecast);
					
					for(var key in val){
						if(!o[key])
							o[key] = val[key];
						else
							o['?' + key] = val[key];
					}
					o[n] = val;
				} 
				else 
					o[param] = val;
			}
		}

		return o;
	},

	interpolate: function (replacements) {
		try {
			var str = this._router.patternLexer.interpolate(this._pattern, replacements);
			return str;
		}
		catch(e) {
			throw new Error(`Error interpolating route ${this._pattern} with values ${JSON.stringify(replacements)}\n` + e);
		}
	},

	toString: function () {
		return '[Route pattern:"' + this._pattern + '", numListeners:' + this.matched.getNumListeners() + ']';
	}

};


export default new class {
	constructor() {
		this.routes = [];
		this.routesByName = {};
		this.patternLexer = PatternLexer();
	}

	addRoute (name, pattern, pageClass, priority) {
		pattern += pattern.endsWith('/') ? ':?query:' : '/:?query:';
		var route = new Route(name, pattern, pageClass, priority, this);

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

	interpolate(name, data){
		if(!this.routesByName[name])
			throw new Error(`Cannot find route by name ${name}`);
			
		return this.routesByName[name].interpolate(data);
	}

	parse (request) {
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
		

		while (route = this.routes[--n]) {
			if (route.match(request)) {
				var params = route._getParamsObject(request);
				params.hash = hash;

				return {
					path: path.toLowerCase(),
					routeName: route._name,
					pattern: route._pattern,
					pageClass: route._pageClass,
					params: params
				};
			}
		}

		return null;
	}

	toString () {
		return '[Router numRoutes:' + this.getNumRoutes() + ']';
	}
}();