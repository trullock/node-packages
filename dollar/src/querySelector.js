let interceptors = [];

function intercept(selector)
{
	return new Proxy({}, {
		set: function (obj, prop, getterAndSetter) {
			interceptors.push({
				selector,
				prop,
				getter: getterAndSetter.get,
				setter: getterAndSetter.set
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

/**
 * Provides interceptors for getters and setters of proxied properties
 */
HTMLElement.prototype.$.intercept = intercept;

/**
 * Selects 0, 1 or more elements by css selector
 * @param {string} selector
 * @returns a Dollar proxy object
 */
Document.prototype.$ = function (selector) {
	let nodeList = this.querySelectorAll(selector);
	let p = new Proxy(nodeList, handler);
	return p;
}
Document.prototype.$.intercept = intercept;

const equals = a =>
{
	return b => {
		if(b.__isDollarProxy)
		{
			if(a.length != b.length)
				return false;

			for(let i = 0; i < a.length; i++)
			{
				if(a[i] != b[i])
					return false;
			}

			return true;
		}

		if(b instanceof HTMLElement)
		{
			if(a.length == 1 && a[0] == b)
				return true;

			return false;
		}

		return false;
	};
}

const handler = {
	
	get: function(obj, prop) {

		if(prop === '__isDollarProxy')
			return true;

		// TODO: handle prop being Symbol(Symbol.iterator)

		if(obj instanceof NodeList)
		{
			obj = [...obj];

			if (prop == Symbol.iterator)
				return obj[Symbol.iterator];

			// handle $$('selector')[i]
			if(!isNaN(prop))
				return obj[prop];
	
			if(Array.prototype[prop] !== undefined)
				return obj[prop];
		}

		if(prop === 'equals')
			return equals(obj);
		
		if(obj.length === 0)
			return null;

		if (obj[0] == null)
			return null;
		
		var type = typeof obj[0][prop];

		if(type == 'object' && (obj.length > 1 || type.constructor.toString().indexOf(' Object()') > -1))
			return new Proxy(obj.map(o => o[prop]), handler);
		
		if(type == 'function')
		{
			return function() {
				let args = [...arguments].map(a => {
					if (a != null && a.__isDollarProxy === true)
					{
						if(a.length == 0)
							return null;

						let unwrapped = [...a];
						if(unwrapped.length == 1)
							return unwrapped[0];
						return unwrapped;
					};
					return a;
				})
				if(obj.length > 1)
					return obj.map(o => o[prop].apply(o, args));	
				return obj[0][prop].apply(obj[0], args);
			};
		}

		let results = obj.map(o => {
			let inters = interceptors.filter(i => prop == i.prop && i.getter && o.matches(i.selector));
			if (inters.length) {
				let valueToGet = o[prop];
				inters.forEach(i => {
					valueToGet = i.getter(valueToGet)
				})
				return valueToGet;
			}
			else
				return o[prop];
		})

		if (results.length > 1)
			return results;
		return results[0];
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
			let inters = interceptors.filter(i => prop == i.prop && i.setter && o.matches(i.selector));
			if(inters.length)
			{
				let valueToSet = value;
				inters.forEach(i => {
					valueToSet = i.setter(valueToSet)
				})
				o[prop] = valueToSet;
			}
			else
				o[prop] = value;
		});
		return true;
	}
};