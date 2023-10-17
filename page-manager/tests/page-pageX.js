import './pageX.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';

export default registerPage('pageX', '/page/{x}', class extends Page {

	title = "Page X";

	constructor($page) {
		super($page);
	}

	show(opts)
	{
		this.$page.querySelector('#PageX').textContent = "Page: " + opts.x;
		return super.show(opts);
	}
});