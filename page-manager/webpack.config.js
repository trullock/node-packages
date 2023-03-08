import HtmlWebpackPlugin from 'html-webpack-plugin';
import path from "path";
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async () => {

	return {
		entry: './tests/lolpack.js',
		output: {
			publicPath: '/',
			path: path.resolve(__dirname, 'tests', 'dist')
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
							presets: [
								["@babel/preset-env", {"targets": "last 1 chrome version"}]
							],
							plugins: ["@babel/plugin-proposal-class-properties"]
						}
					}
				}
			]
		},
		plugins: [
			new HtmlWebpackPlugin({
				template: path.resolve(__dirname, "tests/index.html"),
				filename: 'index.html',
				scriptLoading: "defer"
			})
		],
		watch: true,
		watchOptions:
		{
			ignored: /node_modules/
		}
	};
};
