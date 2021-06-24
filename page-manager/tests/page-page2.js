import './page2.htm'
import Page from './page.js';
import {registerPage} from '@trullock/page-manager';

export default registerPage('page2', '/page2', class extends Page {

	title = "Page 2";

	type = 'A';
	
	constructor($page) {
		super($page);
	}
});