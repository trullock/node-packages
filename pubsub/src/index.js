class Queue {
	queue = []
	offset = 0
	
	getLength() {
		return queue.length - offset;
	}

	isEmpty() {
		return queue.length === 0;
	}

	enqueue(item) {
		queue.push(item);
	}

	dequeue() {
		if (queue.length === 0)
			return undefined;

		var item = queue[offset];

		if (++offset * 2 >= queue.length) {
			queue = queue.slice(offset);
			offset = 0;
		}

		return item;
	}

	peek() {
		return queue.length > 0 ? queue[offset] : undefined;
	}
};


var handlers = {};
var queue = new Queue();
var processing = null;

function processQueue() {
	if(processing)
		return;

	promises = []
	while (!queue.isEmpty()) {
		var action = queue.dequeue();
		promises.push(action.call(null));
	}
	processing = Promise.all(promises);
	processing.finally(() => processing = null)
}

function enqueue(handler, args) {
	queue.enqueue(function () {
		try
		{
			return Promise.resolve(handler.apply(null, args));
		}
		catch(e)
		{
			errorHandler(e, handler, args);
			return Promise.resolve(false);
		}
	});
}

let errorHandler = function (error, handler, args)
{
	console.error('Error executing pubsub subscriber');
	console.error(error);
	console.error(handler);
	console.error(args);
}

export function setErrorHandler(fn)
{
	errorHandler = fn;
}

export function subscribe (type, func) {
	if (!handlers[type])
		handlers[type] = [];

	for (var i = 0; i < handlers[type].length; i++)
		if (handlers[type][i] === func)
			throw "Handler already subscribed to this message";

	handlers[type].push(func);

	return this;
};

export function subscribeOnce (type, func) {
	var handler = function () {
		unsubscribe(handler);

		func.apply(null, arguments);
	};
	subscribe(type, handler);
};

export function publish (type) {
	if (!handlers[type])
		return;

	for (var handler of handlers[type]) {
		var args = [];
		for (var j = 1; j < arguments.length; j++) {
			args.push(arguments[j]);
		}

		enqueue(handler, args);
	}

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
			if (handlers[type][i] === handler) {
				handlers[type].splice(i, 1);
				if (handlers[type].length === 0)
					delete handlers[type];
				return;
			}
		}
	}
};