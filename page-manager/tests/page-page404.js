import './page404.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';

export default registerPage('page404', '/404', class extends Page {

	title = "Page 404";

	constructor($page) {
		super($page);
	}
});