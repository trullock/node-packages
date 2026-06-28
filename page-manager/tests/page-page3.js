import './page3.htm'
import Page from './page.js';
import * as pageManager from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default pageManager.registerPage({
	name: 'page3', 
	route: '/page3', 
	loadMarkup,
	pageClass: class extends Page {

		title = "Page 3";
		
		beforeHide = () => 'Are you sure?'

		constructor($page) {
			super($page);

			$page.querySelector('.btnRemove').addEventListener('click', e => {
				pageManager.removeHistory(state => {
					return state.page.type == 'A';
				})
			})
		}
	}
});