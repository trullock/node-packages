import * as pageManager from '../src/index.js'

import pageLoading from './page-loading.js'
import page1 from './page-page1.js'
import page2 from './page-page2.js'
import page3 from './page-page3.js'
import page4 from './page-page4.js'
import pageX from './page-pageX.js'
import page404 from './page-page404.js'
import pageShowFail from './page-show-fail.js'
import pageQuery from './page-pageQuery.js'

window.addEventListener('DOMContentLoaded', async function () {
	await pageManager.init({
		error404PageName: 'page404',
		defaultPageName: 'page1',
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

	
	window.addEventListener("page-manager.url-changed", e => {
		console.log("----------------------------------");
		console.log(e.detail.url);

		pageManager.printStack();
	});

	await pageManager.ready()
});