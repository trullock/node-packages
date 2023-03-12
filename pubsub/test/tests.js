import * as Bus from '../src/index.js'


Bus.setLogger((m, e) => {
	console.log(m, e);
})


Bus.subscribe('test', e => {}, 'onTest');
Bus.subscribe('test', e => {});

await Bus.publish('test', { foo: 'bar'});