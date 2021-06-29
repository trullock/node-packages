// HTMLElement.prototype.$$ = function (selector) {
// 	return [...this.querySelectorAll(selector)];
// }
// HTMLElement.prototype.$ = function (selector) {
// 	return this.querySelector(selector);
// }
// HTMLDocument.prototype.$$ = function (selector) {
// 	return [...this.querySelectorAll(selector)];
// }
// HTMLDocument.prototype.$ = function (selector) {
// 	return this.querySelector(selector);
// }

/**
 * Selects 0, 1 or more elements by css selector
 * @param {string} selector 
 * @returns a Dollar proxy object
 */
HTMLElement.prototype.$ = function (selector) {
	return new Proxy(this.querySelectorAll(selector), handler);
}

/**
 * Selects 0, 1 or more elements by css selector
 * @param {string} selector
 * @returns a Dollar proxy object
 */
HTMLDocument.prototype.$ = function (selector) {
	return new Proxy(this.querySelectorAll(selector), handler);
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

		if(type == 'object')
			return new Proxy(obj.map(o => o[prop]), handler);
		
		if(type == 'function')
		{
			return function() {
				obj.map(o => o[prop].apply(o, arguments));	
			};
		}

		return obj.map(o => o[prop]);
	},

	set: function(obj, prop, value) {
		
		if(obj instanceof NodeList)
		{			
			obj = [...obj];

			if(Array.prototype[prop] !== undefined)
			{
				obj[prop] = value;
				return;
			}	
		}

		obj.map(o => o[prop] = value);
	},

	apply: function(obj, thisArg, argumentsList) {
		debugger;
		obj.map(o => o.apply(thisArg, argumentsList));
	}
};