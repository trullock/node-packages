import './page404.htm' // doesnt matter
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';

export default registerPage('pageShowFail', '/show-fail', class extends Page {

	title = "Page 4";

	constructor($page) {
		super($page);
	}

	show(opts)
	{
		throw new PageShowError('/page1', 'Cant show pageShowFail, showing page1 instead', {}, 'replace')
	}
});