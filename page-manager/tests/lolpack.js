import * as pageManager from '../src/index.js'

import pageLoading from './page-loading.js'
import page1 from './page-page1.js'
import page2 from './page-page2.js'
import page3 from './page-page3.js'
import page4 from './page-page4.js'
import page404 from './page-page404.js'

window.addEventListener('DOMContentLoaded', function () {
	pageManager.init({
		pageContainer: () => document.body,
		fetchPath: route => '/pages/' + route.routeName + '.htm',
		error404PageName: 'page404',
		beforeHide: message => new Promise(resolve => {
			resolve(confirm(message))
		})
	});


	// listen for navigations
	document.addEventListener('click', e => {
		if (e.ctrlKey || e.metaKey)
			return;

		var $a = e.target.matches('a') ? e.target : e.target.closest('a');
		if (!$a)
			return;

		var href = $a.pathname + $a.search + $a.hash;
		pageManager.navigate(href)

		e.preventDefault();
	}, false);

	document.querySelector('.btnStack').addEventListener('click', e => {
		pageManager.printStack();
	})
});