import './page4.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';

export default registerPage('page4', '/page4', class extends Page {

	title = "Page 4";

	constructor($page) {
		super($page);
	}

	show(opts)
	{
		throw new PageShowError('/page1', 'Cant show page4, showing page1 instead', {}, 'replace')
	}
});