import './pageX.htm'
import Page from './page.js';
import {registerPage, PageShowError} from '@trullock/page-manager';
import { loadMarkup } from './helpers.js';

export default registerPage({
	name: 'pageX', 
	route: '/page/{x}',
	loadMarkup,
	pageClass: class extends Page {

		title = "Page X";

		constructor($page) {
			super($page);
		}

		show(opts)
		{
			this.$page.querySelector('#PageX').textContent = "Page: " + opts.x;
			return super.show(opts);
		}
	}
});