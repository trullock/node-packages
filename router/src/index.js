import Pattern from './pattern.js'

// splits a url into its parts. The hash is undefined if there isn't one
function splitUrl(url)
{
	let hash, query = '';

	let index = url.indexOf('#');
	if (index > -1)
	{
		hash = url.substring(index + 1);
		url = url.substring(0, index);
	}

	index = url.indexOf('?');
	if (index > -1)
	{
		query = url.substring(index + 1);
		url = url.substring(0, index);
	}

	return { path: url, query, hash };
}

class Route
{
	constructor(name, pattern, data, priority, ignoreCase)
	{
		this._name = name;
		this._pattern = pattern;
		this._compiled = new Pattern(pattern, ignoreCase);
		this._data = data;
		this._priority = priority || 0;
	}

	match(url)
	{
		let { path, query } = splitUrl(url);
		return this._compiled.parse(path, query) !== null;
	}

	interpolate(values)
	{
		try
		{
			return this._compiled.interpolate(values);
		}
		catch(e)
		{
			throw new Error(`Error interpolating route ${this._pattern}: ${e.message}`, { cause: e });
		}
	}
}

export default class Router
{
	constructor()
	{
		// highest priority first
		this.routes = [];
		// no prototype, so that any name is usable
		this.routesByName = Object.create(null);
	}

	addRoute(name, pattern, data, priority)
	{
		if (this.routesByName[name])
			throw new Error(`A route called ${name} already exists.`);

		let route = new Route(name, pattern, data, priority, this.ignoreCase);

		// after any of equal priority
		let index = this.routes.findIndex(r => r._priority < route._priority);
		this.routes.splice(index == -1 ? this.routes.length : index, 0, route);
		this.routesByName[name] = route;

		return route;
	}

	interpolate(name, values)
	{
		if (!this.routesByName[name])
			throw new Error(`Cannot find route by name ${name}`);

		return this.routesByName[name].interpolate(values);
	}

	parse(url)
	{
		let { path, query, hash } = splitUrl(url);

		for (let route of this.routes)
		{
			let params = route._compiled.parse(path, query);
			if (!params)
				continue;

			params.hash = hash;

			return {
				path,
				name: route._name,
				pattern: route._pattern,
				data: route._data,
				params
			};
		}

		return null;
	}
};
