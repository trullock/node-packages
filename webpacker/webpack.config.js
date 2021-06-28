import HtmlWebpackPlugin from 'html-webpack-plugin';
//import PurgecssPlugin from 'purgecss-webpack-plugin';
import MiniCssExtractPlugin from "mini-css-extract-plugin";
//import purgecssFromHtml from 'purgecss-from-html';
import fs from "fs";
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

// both lines needed to init page scripts
import { pages } from '@trullock/page-manager'

const __dirname = dirname(fileURLToPath(import.meta.url));

const PATHS = {
	src: path.join(__dirname, 'src'),
	appPages: path.join(__dirname, 'src', 'app', 'pages'),
	landingPages: path.join(__dirname, 'src', 'landing', 'pages')
}



function generateHtmlPlugins(templateDir, outputSubfolder) {
	const templateFiles = fs.readdirSync(path.resolve(__dirname, templateDir))
	return templateFiles.map(filename => {
		const parts = filename.split('.');
		const name = parts[0];
		const extension = parts[1];

		if(extension != 'html')
			return null;

		return new HtmlWebpackPlugin({
			filename: `pages/${outputSubfolder}/${name}.html`,
			template: path.resolve(__dirname, `${templateDir}/${name}.${extension}`),
			templateParameters: {
				pages
			},
			inject: false
		})
	}).filter(x => x != null);
}

export default async (mode) => {

	const appPagePlugins = generateHtmlPlugins(PATHS.appPages, 'app')
	const landingPagePlugins = generateHtmlPlugins(PATHS.landingPages, 'landing')

	var isDevelopment = mode === 'development';

	if (isDevelopment)
		console.log('Webpack: Configured in Development mode');
	else
		console.log('Webpack: Configured in Production mode');

	var plugins = [
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "src", "app", "app.html"),
			templateParameters: {
				pages
			},
			filename: 'app.html',
			scriptLoading: "defer",
			chunks: ['app']
		}),
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "src", "landing", "landing.html"),
			templateParameters: {
				pages
			},
			filename: 'landing.html',
			scriptLoading: "defer",
			chunks: ['landing']
		}),
		new HtmlWebpackPlugin({
			template: path.resolve(__dirname, "src", "landing", "placeholder.html"),
			templateParameters: {
				pages
			},
			filename: 'placeholder.html',
			scriptLoading: "defer",
			chunks: ['landing']
		}),
		new MiniCssExtractPlugin({
			filename: isDevelopment ? '[name].css' : '[name].[contenthash].css',
		})
	].concat(appPagePlugins).concat(landingPagePlugins);

	// if (!isDevelopment) {
	// 	plugins.push(new PurgecssPlugin({
	// 		paths: glob.sync(`${PATHS.src}/**/*.*`),
	// 		styleExtensions: ['.css'],
	// 		whitelist: ['whitelisted'],
	// 		extractors: [
	// 			{
	// 				extractor: purgecssFromHtml,
	// 				extensions: ['html']
	// 			},
	// 			{
	// 				extractor: (content) => {
	// 					var reg = /classList\.(add|remove)\(([^\)]+)\)/gi;
	// 					var matches = [...content.matchAll(reg)];
	// 					var map = matches.map(m => m[2].replace(/['"\s]/g, '').split(','));
	// 					var classes = map.length > 0 ? map.reduce((acc, c) => acc.concat(c)) : [];
	// 					return classes;
	// 				},
	// 				extensions: ['js']
	// 			}
	// 		]
	// 	}));
	// }

	return {
		entry: {
			app: './src/app/app.js',
			landing: './src/landing/landing.js'
		},
		output: {
			publicPath: '/',
			path: path.resolve(__dirname, 'dist'),
			filename: isDevelopment ? '[name].js' : '[name].[contenthash].js',
		},
		mode: isDevelopment ? 'development' : 'production',
		devtool: 'source-map',
		module: {
			rules: [
				{
					test: /\.(mp3|png|jpg|gif|ico|svg|woff2?)$/,
					use: 'file-loader'
				},
				{
					test: /(site\.webmanifest|robots\.txt|sitemap\.xml)$/,
					loader: 'file-loader',
					options: {
						name: '[name].[ext]'
					}
				},
				{
					test: /\.scss$/i,
					use: [
						MiniCssExtractPlugin.loader,
						'css-loader',
						'sass-loader',
					],
				},
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: { 
						loader: "babel-loader",
						options: {
							// https://babeljs.io/docs/en/babel-preset-env
							// https://github.com/browserslist/browserslist
							presets: [["@babel/preset-env", { "targets": "defaults" }]],
							// presets: [["@babel/preset-env", {
							// 	useBuiltIns: "entry",
							// 	corejs: '3'
							// }]],
							plugins: ["@babel/plugin-proposal-class-properties"]
						}
					}
				}
			]
		},
		externals: {
		// For chart-js
		// 	moment: 'moment'
		},
		plugins: plugins
	};
};

export const paths = PATHS;
