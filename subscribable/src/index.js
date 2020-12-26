export default class Subscribable {
	constructor() {
		this.subscribers = [];
	}

	publish(event){
		this.subscribers.forEach(o => {
			try {
				o(event)
			} 
			catch(e) { 
				console.error(e);
			}
		})
	}

	subscribe(subscriber) {
		this.subscribers.push(subscriber)
	}
}