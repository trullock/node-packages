import './pageQuery.htm'
import Page from './page.js';
import {registerPage, refresh} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'pageQuery', 
	route: '/page-query',
	loadMarkup,
	pageClass: class extends Page {

		title = "Page Query";

		constructor($page) {
			super($page);
		}

		show(data) {
			this.$page.querySelector('.js-query').textContent = window.location.search
		}
	}
});