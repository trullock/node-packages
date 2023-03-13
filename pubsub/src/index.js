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
var processing = null;

function processQueue() {
	if(processing)
		return;

	let promises = []
	while (!queue.isEmpty()) {
		var action = queue.dequeue();
		promises.push(action.call(null));
	}
	processing = Promise.allSettled(promises);
	processing.finally(() => processing = null)
}

function enqueue(handler, args) {
	queue.enqueue(function () {
		try
		{
			log(`PubSub:	Executing handler '${handler.name || '<anon>'}'`, args)
			return Promise.resolve(handler.func.apply(null, args));
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


export function subscribe (type, func, name) {
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

export function subscribeOnce (type, func, name) {
	var handler = function () {
		unsubscribe(handler);

		func.apply(null, arguments);
	};
	subscribe(type, handler, name);
};

export function publish (type) {
	var args = [];
	for (var j = 1; j < arguments.length; j++) {
		args.push(arguments[j]);
	}

	log(`PubSub: Publishing event '${type}`, args)

	if (!handlers[type])
		return;

	for (var i = 0; i < handlers[type].length; i++)
		enqueue(handlers[type][i], args);
	
	processQueue();

	return processing;
};

export function unsubscribeAll (type) {
	if (type)
		delete handlers[type]
	else
		handlers = {};
};

export function unsubscribe (handler) {
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