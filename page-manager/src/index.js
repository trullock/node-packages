import router from '@trullock/router';
import PageShowError from './pageshowerror.js';

var currentPage,
	currentPagePath,
	pageHash = {},
	pageCache = {},
	pageTemplateCache = {};

var currentState = { uid: 0, data: {} };
var manuallyAdjustingHistory = false;
var handlingBeforeUnload = false;
var lastNavigationDirection = null;

var goal = null;
var backData = {};
var options = {
	fetchPath: route => '/pages/' + route.routeName + '.html',
	pageContainer: () => document.body,
	prepareMarkup: $html => { },
	loadingPageName: 'loading',
	error404PageName: 'error-404',
	defaultPageName: 'root',
	beforeUnload: null
}

export const pages = pageHash;

export function registerPage(name, route, pageClass) {
	router.addRoute(name, route, pageClass);

	pageHash[name] = {
		url: route,
		pageClass: pageClass
	}

	return pageClass;
}

export function getPath(name, values) {
	let url = router.interpolate(name, values);
	if (values?.hash)
		url += '#' + values.hash;
	return url;
}

function showLoading() {
	var page = pageHash[options.loadingPageName];
	var route = router.parse(page.url);
	var data = {
		route: route,
		scrollY: window.scrollY,
		event: {
			action: 'replace'
		}
	};

	var page = pageCache[page.url].page;

	return page.show(data);
}

function fetchPageTemplate(route) {
	return fetch(options.fetchPath(route))
		.then(r => r.text())
		.then(html => {
			var $div = document.createElement('div');
			$div.innerHTML = html;
			// Pages are assumed to have a single wrapping element
			return $div.firstElementChild;
		})
		.then($template => {
			pageTemplateCache[route.pattern] = $template;
			return $template;
		});
}

function loadPage(route, data) {

	var fetchPage = pageTemplateCache[route.pattern] ? Promise.resolve(pageTemplateCache[route.pattern]) : fetchPageTemplate(route);

	return fetchPage.then($template => {
		var $html = $template.cloneNode(true);
		options.prepareMarkup($html);
		options.pageContainer().appendChild($html);
		pageCache[route.path] = {
			$html,
			page: new (route.pageClass)($html)
		}

		var page = pageCache[route.path].page;
		return page.boot(data).then(() => page);
	});
}

function showPage(url, data, event) {
	var route = router.parse(url);
	if (route == null) {
		console.error(`Can't find page: '${url}'`);
		return Promise.reject(new PageShowError(pageHash[options.error404PageName].url, `Can't find page: '${url}'`, {}, 'replace'));
	}

	data = data || {};
	for (let key in route.params)
		data[key] = route.params[key];

	data.route = {
		path: route.path,
		routeName: route.routeName,
		params: route.params
	};
	data.event = event;

	if (route.pageClass.requireAuth && !firebase.auth().currentUser) {
		goal = { url, data };
		return showPage(getPath('sign-in'), null, event);
	}

	var getPage = showLoading().then(() => {
		if (pageCache[route.path])
			return pageCache[route.path].page;

		return loadPage(route, data)
	});

	// handle initial page
	if (!currentPage)
		return getPage.then(page => doShow(route, page, data));

	if (currentPagePath == route.path) {
		handleHistoryAction(event, url, data);
		return getPage.then(page => doShow(route, page, data));
	}

	currentState.data.scrollY = window.scrollY;
	handleHistoryAction({ action: 'replace' }, window.location, currentState.data);
	return currentPage.hide(event).then(() =>
		getPage.then(page => {
			handleHistoryAction(event, url, data);
			return doShow(route, page, data);
		})
		, e => {
			manuallyAdjustingHistory = () => manuallyAdjustingHistory = false;
			if (event.action == 'back')
				history.go(1);
			else if (event.action == 'fwd')
				history.go(-1);
		});
}

function doShow(route, page, data) {

	window.scroll(0, 0);
	currentPagePath = route.path;
	currentPage = page;

	return showLoading().then(() =>
		currentPage.show(data)
			.then(() => {
				document.title = currentPage.title;
				window.scroll(0, data.scrollY || 0);
			})
			// todo: hide() should be passed an event object
			.then(() => pageCache[pageHash[options.loadingPageName].url].page.hide())
	)
}

function handleHistoryAction(event, url, data) {
	if (event.action == 'push') {
		currentState = { uid: ++currentState.uid, data };
		window.history.pushState(currentState, null, url);
	}
	else if (event.action == 'replace') {
		currentState = { uid: currentState.uid, data };
		window.history.replaceState(currentState, null, url);
	}
}

function doNavigate(url, data) {

	if (url === 'goal') {
		url = goal ? goal.url : data?.fallback || getPath(options.defaultPageName);
		data = goal?.data || {}
		goal = null;
	}

	return showPage(url, data, { action: 'push', distance: 0 });
}

export function init(opts) {

	Object.assign(options, opts);

	// handle pages whose markup is already loaded in the page
	for (var key in pageHash) {
		if (pageHash[key].pageClass.existingDomSelector) {
			let $html = document.$(pageHash[key].pageClass.existingDomSelector)
			pageCache[pageHash[key].url] = {
				$html: $html,
				page: new (pageHash[key].pageClass)($html)
			}
		}
	}

	// set initial page
	showPage(window.location.pathname + window.location.search + window.location.hash, null, { action: 'load', distance: 0 }).catch(e => {
		console.error(e);
		if (e instanceof PageShowError)
			return showPage(e.url, e.data, { action: e.action || 'show' });
	})

	function handlePopstate(state, direction, distance) {
		// todo: isnt this in the wrong place? should be further down...
		currentState = state;

		if (direction == 'back')
			Object.assign(state.data, backData);
		backData = {};

		if (manuallyAdjustingHistory) {
			manuallyAdjustingHistory({
				state,
				direction,
				distance,
				path: window.location.pathname,
				search: window.location.search,
				hash: window.location.hash
			});
			return;
		}

		showPage(window.location.pathname + window.location.search + window.location.hash, state.data, { action: direction, distance }).catch(e => {
			console.error(e);
			if (e instanceof PageShowError)
				return showPage(e.url, e.data, { action: e.action || 'show' });
		});
	}

	function handleBeforeUnloadPart1() {
		// if we're ignoring beforeUnload this navigation
		if (handlingBeforeUnload === 'ignore') {
			handlingBeforeUnload = false;
			return false;
		}

		// if we have a before-unload confirm to show
		if (currentPage.beforeUnload && options.beforeUnload && handlingBeforeUnload === false) {
			var interrupt = currentPage.beforeUnload();
			if (interrupt) {
				handlingBeforeUnload = 'step1';

				// do this in a new thread, you cant call history actions from inside a history-aciton-handler
				window.setTimeout(() => {
					// undo the navigation so the URL remains correct whilst we show the confirm dialog
					if (lastNavigationDirection == 'fwd')
						history.back();
					else if (lastNavigationDirection == 'back')
						history.forward();
				}, 1);

				return true;
			}
		}

		// we've finished beforeUnloading
		if (handlingBeforeUnload === 'step2')
			handlingBeforeUnload = false;

		return false;
	}

	function handleBeforeUnloadPart2() {
		if (handlingBeforeUnload !== 'step1')
			return false;

		// do the beforeUnload action, then...
		options.beforeUnload(currentPage.beforeUnload()).then(result => {

			// if the user confirmed, redo the original action
			if (result) {

				handlingBeforeUnload = 'step2';

				if (lastNavigationDirection == 'fwd')
					history.forward();
				else if (lastNavigationDirection == 'back')
					history.back();
			} else {
				handlingBeforeUnload = false;
			}
		});

		return true;
	}

	// listen for browser navigations
	window.addEventListener("popstate", e => {

		var interrupted = handleBeforeUnloadPart2();
		if (interrupted)
			return;

		let state = e.state || { uid: 0, data: {} };
		lastNavigationDirection = state.uid > currentState.uid ? 'fwd' : 'back';
		let distance = Math.abs(state.uid - currentState.uid);

		var interrupted = handleBeforeUnloadPart1();
		if (interrupted)
			return;

		handlePopstate(state, lastNavigationDirection, distance);
	});
}

export function navigate(url, data, checkBeforeUnload) {

	if (checkBeforeUnload === true && currentPage.beforeUnload && options.beforeUnload) {

		var interrupt = currentPage.beforeUnload();
		if (interrupt !== false) {
			options.beforeUnload(interrupt).then(result => {
				if (result)
					doNavigate(url, data);
			});
			return;
		}
	}

	doNavigate(url, data);
}

export function update(opts) {
	opts = Object.assign({
		url: window.location.pathname + window.location.search + window.location.hash,
		data: {}
	}, opts);
	handleHistoryAction({ action: 'replace', distance: 0 }, opts.url, opts.data);
}

export function replace(url, data) {
	return showPage(url, data, { action: 'replace', distance: 0 });
}

export function show(url, data) {
	return showPage(url, data, { action: 'show', distance: 0 });
}

export function back(data, checkBeforeUnload) {
	backData = data || {};
	handlingBeforeUnload = checkBeforeUnload === false ? 'ignore' : false;
	history.go(-1);
}

export function rewind(method) {
	// This is only safe if youre confident theres a hashless path in our history, else it may go offsite
	if (method == 'drop-hash') {
		let originalUrl = window.location.pathname + window.location.search + window.location.hash;
		return new Promise((resolve) => {
			manuallyAdjustingHistory = opts => {
				if (!opts.hash) {
					handleHistoryAction({ action: 'push', distance: 0 }, originalUrl, {});
					manuallyAdjustingHistory = false;
					resolve();
				} else {
					history.go(-1);
				}
			};
			history.go(-1);
		});
	}

	return Promise.reject(new Error(`Unrecognised rewind method ${method}`))
}