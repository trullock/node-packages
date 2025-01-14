class Queue {
	queue = []
	offset = 0
	
	getLength() {
		return this.queue.length - this.offset;
	}

	isEmpty() {
		return this.queue.length === 0;
	}

	enqueue(item) {
		this.queue.push(item);
	}

	dequeue() {
		if (this.queue.length === 0)
			return undefined;

		var item = this.queue[this.offset];

		if (++this.offset * 2 >= this.queue.length) {
			this.queue = this.queue.slice(this.offset);
			this.offset = 0;
		}

		return item;
	}

	peek() {
		return this.queue.length > 0 ? this.queue[this.offset] : undefined;
	}
};


var handlers = {};
var queue = new Queue();

async function processQueue() {
	let promises = []
	while (!queue.isEmpty()) {
		var action = queue.dequeue();
		promises.push(action.call(null));
	}
	return await Promise.allSettled(promises);
}

function enqueue(type, handler, args) {
	queue.enqueue(function () {
		try
		{
			log(`PubSub:	Executing handler '${handler.name || '<anon>'}'`, args)
			return Promise.resolve(handler.func.apply({
				handlerName: handler.name,
				eventType: type
			}, args));
		}
		catch(e)
		{
			errorHandler(e, handler, args);
			return Promise.reject(e);
		}
	});
}

let errorHandler = function (error, handler, args)
{
	console.error('PubSub: Error executing pubsub subscriber', error, handler, args);
}

export function setErrorHandler(fn)
{
	errorHandler = fn;
}

let log = function (message, args)
{
	//console.log(message, args);
	// silence by default
}
export function setLogger(fn)
{
	log = fn;
}


export function subscribe(type, func, name) {
	if (!handlers[type])
		handlers[type] = [];

	for (var i = 0; i < handlers[type].length; i++)
		if (handlers[type][i].func === func)
			throw "Handler already subscribed to this message";

	handlers[type].push({
		func,
		name
	});

	return this;
};

export function subscribeOnce(type, func, name) {
	var handler = function () {
		unsubscribe(handler);

		func.apply(this, arguments);
	};
	subscribe(type, handler, name);
};


export function subscribeTemporarily(type, func, name) {
	var handler = function () {
		let result = func.apply(this, arguments);
		if(result === true)
			unsubscribe(handler);
	};
	subscribe(type, handler, name);
};


export function publish(type, ...args) {
	log(`PubSub: Publishing event '${type}`, args)

	let currentHandlers = []

	if (handlers[type])
		currentHandlers = currentHandlers.concat(handlers[type])
	
	if (handlers['*'])
		currentHandlers = currentHandlers.concat(handlers['*'])

	for (var i = 0; i < currentHandlers.length; i++)
		enqueue(type, currentHandlers[i], args);
	
	return processQueue();
};

export function unsubscribeAll(type) {
	if (type)
		delete handlers[type]
	else
		handlers = {};
};

export function unsubscribe(handler) {
	for (var type in handlers) {
		for (var i = 0; i < handlers[type].length; i++) {
			if (handlers[type][i].func === handler) {
				handlers[type].splice(i, 1);
				if (handlers[type].length === 0)
					delete handlers[type];
				return;
			}
		}
	}
};