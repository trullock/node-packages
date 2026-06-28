import './page1.htm'
import Page from './page.js';
import {registerPage, refresh} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'page1', 
	route: '/page1',
	loadMarkup,
	pageClass: class extends Page {

		title = "Page 1";

		type = 'A';

		constructor($page) {
			super($page);

			$page.querySelector('button').addEventListener('click', e => {
				refresh();
			})
		}

		update(data) {
			this.$page.querySelector('.js-time').textContent = new Date().getTime();
		}
	}
});