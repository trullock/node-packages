import './page1.htm'
import Page from './page.js';
import {registerPage} from '@trullock/page-manager';

export default registerPage('page1', '/page1', class extends Page {

	title = "Page 1";

	type = 'A';

	constructor($page) {
		super($page);
	}
});