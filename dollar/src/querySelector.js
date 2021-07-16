let setInterceptors = [];

function intercept(selector)
{
	return new Proxy({}, {
		set: function (obj, prop, action) {
			setInterceptors.push({
				selector,
				prop,
				action
			})
			return true;
		}
	});
}

/**
 * Selects 0, 1 or more elements by css selector
 * @param {string} selector 
 * @returns a Dollar proxy object
 */
HTMLElement.prototype.$ = function (selector) {
	let nodeList = this.querySelectorAll(selector);
	let p = new Proxy(nodeList, handler);
	return p;
}
HTMLElement.prototype.$.intercept = intercept;

/**
 * Selects 0, 1 or more elements by css selector
 * @param {string} selector
 * @returns a Dollar proxy object
 */
HTMLDocument.prototype.$ = function (selector) {
	let nodeList = this.querySelectorAll(selector);
	let p = new Proxy(nodeList, handler);
	return p;
}
HTMLDocument.prototype.$.intercept = intercept;

const handler = {
	
	get: function(obj, prop) {

		// TODO: handle prop being Symbol(Symbol.iterator)

		if(obj instanceof NodeList)
		{
			obj = [...obj];

			// handle $$('selector')[i]
			if(!isNaN(prop))
				return obj[prop];
	
			if(Array.prototype[prop] !== undefined)
				return obj[prop];
		}

		if(obj.length === 0)
			return null;

		if (obj[0] == null)
			return null;
		
		var type = typeof obj[0][prop];

		if(type == 'object')
			return new Proxy(obj.map(o => o[prop]), handler);
		
		if(type == 'function')
		{
			return function() {
				if(obj.length > 1)
					return obj.map(o => o[prop].apply(o, arguments));	
				return obj[0][prop].apply(obj[0], arguments);
			};
		}

		if (obj.length > 1)
			return obj.map(o => o[prop]);
		return obj[0][prop];
	},

	set: function(obj, prop, value) {
		
		if(obj instanceof NodeList)
		{			
			obj = [...obj];

			if(Array.prototype[prop] !== undefined)
			{
				obj[prop] = value;
				return true;
			}	
		}

		obj.map(o => {
			let inters = setInterceptors.filter(i => prop == i.prop && o.matches(i.selector));
			if(inters.length)
			{
				let valueToSet = value;
				inters.forEach(i => {
					valueToSet = i.action(value)
				})
				o[prop] = valueToSet;
			}
			else
				o[prop] = value;
		});
		return true;
	},

	apply: function(obj, thisArg, argumentsList) {
		debugger;
		obj.map(o => o.apply(thisArg, argumentsList));
	}
};