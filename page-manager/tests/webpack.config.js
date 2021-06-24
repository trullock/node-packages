import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async () => {

	return {
		entry: './lolpack.js',
		output: {
			publicPath: '/',
			path: path.resolve(__dirname, 'dist')
		},
		mode: 'development',
		devtool: 'source-map',
		module: {
			rules: [
				{
					test: /\.htm$/,
					loader: 'file-loader',
					options: {
						name: '[name].[ext]'
					}
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
							plugins: ["@babel/plugin-proposal-class-properties"]
						}
					}
				}
			]
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, "index.html"),
				filename: 'index.html',
				scriptLoading: "defer"
			})
		]
	};
};
