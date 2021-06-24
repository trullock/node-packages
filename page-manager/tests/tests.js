import express from 'express';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()
const port = 3000

app.get('/main.js', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'main.js'));
})

app.get('/main.js.map', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'main.js.map'));
})

app.get('/pages/:page?', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', req.params.page));
})

app.get('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'dist', 'index.html'));
})

app.listen(port, () => {
	console.log(`Example app listening at http://localhost:${port}`)
})