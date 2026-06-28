import './page4.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'page4', 
	route: '/page4',
	loadMarkup,
	pageClass: class extends Page {

		title = "Page 4";

		constructor($page) {
			super($page);
		}

		show(opts)
		{
			throw new PageShowError('/page1', 'Cant show page4, showing page1 instead', {}, 'replace')
		}
	}
});