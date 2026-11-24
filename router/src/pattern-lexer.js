export default function () {

	var
		//match chars that should be escaped on string regexp
		ESCAPE_CHARS_REGEXP = /[\\.+*?\^$\[\](){}\/'#]/g,

		LEADING_SLASH_REGEXP = /^\//,

		//params - everything between `{ }` or `: :`
		PARAMS_REGEXP = /(?:\{|:)([^}:]+)(?:\}|:)/g,

		//used to save params during compile (avoid escaping things that
		//shouldn't be escaped).
		TOKENS = {
			'OS': {
				//optional slashes
				//slash between `::` or `}:` or `\w:`, but not before a query string, where a slash is significant
				rgx: /([:}]|\w(?=\/))\/?(:(?!\?))/g,
				save: '$1{{id}}$2',
				res: '\\/?'
			},
			'RS': {
				//required slashes
				//used to insert slash between `:{` and `}{`
				rgx: /([:}])\/?(\{(?!\?))/g,
				save: '$1{{id}}$2',
				res: '\\/'
			},
			'RQ': {
				//required query string - everything in between `{? }`
				rgx: /\{\?([^}]+)\}/g,
				//everything from `?` till `#` or end of string
				res: '\\?([^#]+)'
			},
			'OQ': {
				//optional query string - everything in between `:? :`
				rgx: /:\?([^:]+):/g,
				//everything from `?` till `#` or end of string
				res: '(?:\\?([^#]*))?'
			},
			'OR': {
				//optional rest - everything in between `: *:`
				rgx: /:([^:]+)\*:/g,
				res: '([^?]*)?' // optional group to avoid passing empty string as captured
			},
			'RR': {
				//rest param - everything in between `{ *}`
				rgx: /\{([^}]+)\*\}/g,
				res: '([^?]+)'
			},
			// required/optional params should come after rest segments
			'RP': {
				//required params - everything between `{ }`
				rgx: /\{([^}]+)\}/g,
				res: '([^\\/?]+)'
			},
			'OP': {
				//optional params - everything between `: :`
				rgx: /:([^:]+):/g,
				res: '([^\\/?]+)?'
			}
		};


	function precompileTokens() {
		var key, cur;
		for (key in TOKENS) {
			if (TOKENS.hasOwnProperty(key)) {
				cur = TOKENS[key];
				cur.id = '__CR_' + key + '__';
				cur.save = ('save' in cur) ? cur.save.replace('{{id}}', cur.id) : cur.id;
				cur.rRestore = new RegExp(cur.id, 'g');
			}
		}
	}
	precompileTokens();


	var OPTIONAL_PARAM_SEGMENT_REGEXP = new RegExp(TOKENS.OS.id + TOKENS.OP.id, 'g'),
		OPTIONAL_REST_SEGMENT_REGEXP = new RegExp(TOKENS.OS.id + TOKENS.OR.id, 'g'),

		//placeholder for optional params with no value during interpolation
		OMITTED = '__CR_OMITTED__',
		//placeholder marking where a query string starts during interpolation
		QUERY = '__CR_QUERY__',
		QUERY_REGEXP = new RegExp('(?:' + TOKENS.OS.id + ')*' + QUERY, 'g'),
		OMITTED_REGEXP = new RegExp(OMITTED, 'g'),
		OMITTED_SEGMENT_REGEXP = new RegExp('(?:\\/|' + TOKENS.OS.id + ')' + OMITTED + '(?=\\/|' + TOKENS.OS.id + ')', 'g');

	function captureVals(regex, pattern) {
		var vals = [], match;
		// very important to reset lastIndex since RegExp can have "g" flag
		// and multiple runs might affect the result, specially if matching
		// same string multiple times on IE 7-8
		regex.lastIndex = 0;
		while (match = regex.exec(pattern)) {
			vals.push(match[1]);
		}
		return vals;
	}

	//rest params are declared as `name*` but known as `name`
	function stripRest(id) {
		return id.replace(/\*$/, '');
	}

	function getParamIds(pattern) {
		return captureVals(PARAMS_REGEXP, pattern).map(stripRest);
	}

	function compilePattern(pattern, ignoreCase) {
		pattern = pattern || '';

		if (pattern) {
			pattern = pattern.replace(LEADING_SLASH_REGEXP, '');

			//save tokens
			pattern = replaceTokens(pattern, 'rgx', 'save');
			//regexp escape
			pattern = pattern.replace(ESCAPE_CHARS_REGEXP, '\\$&');
			//an optional segment and its preceding slash are present or absent together,
			//otherwise "/a/:id:" would match "/a1"
			pattern = pattern
				.replace(OPTIONAL_PARAM_SEGMENT_REGEXP, '(?:\\/([^\\/?]+))?')
				.replace(OPTIONAL_REST_SEGMENT_REGEXP, '(?:\\/([^?]+))?');
			//restore tokens
			pattern = replaceTokens(pattern, 'rRestore', 'res');

			pattern = '\\/?' + pattern;
		}

		return new RegExp('^' + pattern + '$', ignoreCase ? 'i' : '');
	}

	function replaceTokens(pattern, regexpName, replaceName) {
		var cur, key;
		for (key in TOKENS) {
			if (TOKENS.hasOwnProperty(key)) {
				cur = TOKENS[key];
				pattern = pattern.replace(cur[regexpName], cur[replaceName]);
			}
		}
		return pattern;
	}

	function getParamValues(request, regexp) {
		var vals = regexp.exec(request);
		if (vals) {
			vals.shift();
		}
		return vals;
	}

	//encodes a path segment, leaving readable the characters which are safe within one
	function encodeSegment(val) {
		return encodeURIComponent(val).replace(/%(?:3A|40|24|26|2B|2C|3B|3D)/g, decodeURIComponent);
	}

	//the inverse of parsing: null is a name with no value, undefined is absent
	function encodeQueryString(query) {
		if (typeof query !== 'object')
			return String(query).replace(/^\?/, '').replace(/#/g, '%23');

		var parts = [];

		for (var key of Object.keys(query)) {
			//parsing can't return these, the fragment and the prototype take their place
			if (key === 'hash' || key === '__proto__')
				throw new Error('A query param can\'t be called "' + key + '", the name is reserved.');

			for (var val of [].concat(query[key])) {
				if (val === undefined)
					continue;

				var name = encodeURIComponent(key).replace(/%5B%5D$/, '[]');
				parts.push(val === null ? name : name + '=' + encodeURIComponent(val));
			}
		}

		return parts.join('&');
	}

	function interpolate(pattern, replacements) {
		// default to an empty object because pattern might have just
		// optional arguments
		replacements = replacements || {};
		if (typeof pattern !== 'string') {
			throw new Error('Route pattern should be a string.');
		}
		
		var replaceFn = function (match, prop) {
			var val;
			var isQuery = prop.substr(0, 1) === '?';
			var isRest = match.indexOf('*') !== -1;
			var isRequired = match.indexOf('{') !== -1;
			var replacement = replacements[stripRest(isQuery ? prop.substr(1) : prop)];

			if (replacement == null)
				val = '';
			else if (isQuery) {
				val = encodeQueryString(replacement);
				if (val)
					val = QUERY + '?' + val;
			}
			else if (typeof replacement === 'object')
				throw new Error('Invalid value for segment "' + match + '", objects are only supported for query strings.');
			else if (isRest)
				val = String(replacement).split('/').map(encodeSegment).join('/');
			else
				val = encodeSegment(replacement);

			// an empty value wouldn't match this route when parsed
			if (!val && isRequired)
				throw new Error('The segment ' + match + ' is required.');

			// an empty optional param is the same as an omitted one
			if (!val)
				val = OMITTED;

			return val;
		};

		if (!TOKENS.OS.trail) {
			TOKENS.OS.trail = new RegExp('(?:' + TOKENS.OS.id + ')+$');
		}

		var result = pattern
			.replace(TOKENS.OS.rgx, TOKENS.OS.save)
			.replace(PARAMS_REGEXP, replaceFn)
			.replace(OMITTED_SEGMENT_REGEXP, '') // remove omitted segments, along with their preceding slash
			.replace(OMITTED_REGEXP, '')
			.replace(QUERY_REGEXP, '') // remove query placeholder, along with any optional slash before it
			.replace(TOKENS.OS.trail, '') // remove trailing
			.replace(TOKENS.OS.rRestore, '/'); // add slash between segments

		// every segment was omitted
		if ((!result || result.indexOf('?') === 0) && pattern.indexOf('/') === 0)
			return '/' + result;

		return result;
	}

	//API
	return {
		getParamIds: getParamIds,
		getParamValues: getParamValues,
		compilePattern: compilePattern,
		interpolate: interpolate
	};

}