HTMLElement.prototype.$$ = function (selector) {
	return new Proxy(this.querySelectorAll(selector));
}

HTMLDocument.prototype.$$ = function (selector) {
	return new Proxy(this.querySelectorAll(selector), handler);
}

function proxyLol(obj, prop, type)
{
	if(type == 'object')
		return new Proxy(obj.map(o => o[prop]), handler);
	
	if(type == 'function')
		return function() {
			obj.map(o => o[prop].apply(o, arguments));	
		};

	return obj.map(o => o[prop]);
}

const handler = {
	
	get: function(obj, prop) {

		if(obj instanceof NodeList)
		{
			
			obj = [...obj];

			// handle $$('selector')[i]
			if(!isNaN(prop))
				return obj[prop];
	
			if(Array.prototype[prop] !== undefined)
				return obj[prop];
			
		}

		var type = typeof obj[0][prop];
		return proxyLol(obj, prop, type);
	},
	set: function(obj, prop, value) {
		
		if(obj instanceof NodeList)
		{			
			obj = [...obj];

			if(Array.prototype[prop] !== undefined)
				obj[prop] = value;
			
		}

		obj.map(o => o[prop] = value);
	},
	apply: function(obj, thisArg, argumentsList) {
		obj.map(o => o.apply(this, argumentsList));
	}
};