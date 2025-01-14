import * as Bus from '../src/index.js'


Bus.subscribe('*', function(e) {
	console.log("this:", this)
})

Bus.subscribe('asyncawait', function() {
	return new Promise(r => {
		console.log('a');
		setTimeout(() => {
			console.log('b');
			r()
			console.log('c');
		}, 100);
	})
})

console.log('d');

await Bus.publish('asyncawait', {});

console.log('e');


Bus.setLogger((m, e) => {
	console.log(m, e);
})


Bus.subscribe('test', e => {}, 'onTest');
Bus.subscribe('test', e => {});

await Bus.publish('test', { foo: 'bar'});
