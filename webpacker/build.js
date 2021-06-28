import webpack from 'webpack';
import webpackConfig, { paths } from './webpack.config.js';
import chokidar from 'chokidar';

var mode = process.argv.length > 2 && process.argv[2] == 'watch' ? 'development' : 'production';

var config, compiler, watching;

function bootWebpack()
{
	var wait = new Promise(r => watching ? watching.close(r) : r());
	return wait.then(async () => {
		config = await webpackConfig(mode);
		compiler = webpack(config);
	});
}

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

export function run(mode) {

	if (mode == 'development') {
		var watching;

		function startWatching() {
			watching = compiler.watch({
				ignored: /node_modules/,
			}, handleError);
		}

		const newFilesWatcher = chokidar.watch(paths.pages, { persistent: true, ignoreInitial: true });
		var debounce = null;
		var changedFiles = [];
		var handler = path => {
			if (debounce)
				clearTimeout(debounce);

			changedFiles.push(path);

			debounce = setTimeout(e => {
				console.log('Detected file changes `' + changedFiles + "`, refreshing config");
				changedFiles = [];
				bootWebpack().then(startWatching);
			}, 100);
		}
		newFilesWatcher.on('add', handler);
		newFilesWatcher.on('unlink', handler);

		bootWebpack().then(startWatching);

	} else {
		bootWebpack().then(() => compiler.run(handleError));
	}
}
