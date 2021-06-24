import webpack from 'webpack';
import webpackConfig from './webpack.config.js';

var config, compiler, watching;

function bootWebpack()
{
	var wait = new Promise(r => watching ? watching.close(r) : r());
	return wait.then(async () => {
		config = await webpackConfig();
		compiler = webpack(config);
	});
}

var watching;
bootWebpack().then(() => {
	watching = compiler.watch({
		ignored: /node_modules/,
	}, handleError);
});

function handleError(err, stats){
	if (err) {
		console.error(err.stack || err);
		if (err.details)
			console.error(err.details);
		return;
	}

	const info = stats.toJson();

	if (stats.hasErrors())
		console.error(info.errors);

	if (stats.hasWarnings())
		console.warn(info.warnings);
}
