import './loading.htm'
import { loadMarkup } from './helpers.js';
import Page from './page.js';
import {registerPage} from '@trullock/page-manager';

export default registerPage({
	name: 'loading', 
	route: '/loading', 
	loadMarkup,
	pageClass: class extends Page {

		static existingDomSelector = '#page-loading';

		constructor($page) {
			super($page);
		}
	}
});