import './page1.htm'
import Page from './page.js';
import {registerPage, refresh} from '@trullock/page-manager';

export default registerPage('page1', '/page1', class extends Page {

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
});