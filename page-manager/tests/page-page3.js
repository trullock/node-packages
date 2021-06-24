import './page3.htm'
import Page from './page.js';
import * as pageManager from '@trullock/page-manager';

export default pageManager.registerPage('page3', '/page3', class extends Page {

	title = "Page 3";
	
	constructor($page) {
		super($page);

		$page.querySelector('.btnRemove').addEventListener('click', e => {
			pageManager.removeHistory(state => {
				return state.page.type == 'A';
			})
		})
	}
});