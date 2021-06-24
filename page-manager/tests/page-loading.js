import Page from './page.js';
import {registerPage} from '@trullock/page-manager';

export default registerPage('loading', '/loading', class extends Page {

	static existingDomSelector = '#page-loading';

	constructor($page) {
		super($page);
	}
});