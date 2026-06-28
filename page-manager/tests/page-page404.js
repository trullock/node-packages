import './page404.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'page404', 
	route: '/404',
	loadMarkup,
	pageClass: class extends Page {

		title = "Page 404";

		constructor($page) {
			super($page);
		}
	}
});