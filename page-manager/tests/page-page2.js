import './page2.htm'
import Page from './page.js';
import {registerPage, replace} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'page2', 
	route: '/page2', 
	loadMarkup,
	pageClass: class extends Page {

		title = "Page 2";

		type = 'A';
		
		constructor($page) {
			super($page);

			$page.querySelector('button').addEventListener('click', e => {
				e.preventDefault();
				replace('/page1')
			})
		}
	}
});