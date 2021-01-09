import router from '@trullock/router';

var currentPage,
	currentPagePath,
	pageHash = {},
	pageCache = {},
	pageTemplateCache = {};

var currentState = { uid: 0 };
var manuallyAdjustingHistory = false;
var goal = null;

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
	var route = router.parse('/loading');
	var data = {
		route: route,
		event: {
			action: 'replace'
		}
	};

	var page = pageCache['/loading'].page;

	return page.show(data);
}

function fetchPageTemplate(route) {
	return fetch('/pages/' + route.routeName + '.html')
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
		document.body.appendChild($html);
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
		return Promise.reject(new Error(`Can't find page: '${url}'`));
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
			.then(() => document.title = currentPage.title)
			// todo: hide() should be passed an event object
			.then(() => pageCache['/loading'].page.hide(), e => {
				console.error(e);
				return showPage(e.url, e.data, { action: e.action || 'show' });
			})
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

export function init() {

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
	showPage(window.location.pathname + window.location.search + window.location.hash, null, { action: 'load', distance: 0 })

	// listen for browser navigations
	window.addEventListener("popstate", e => {
		// initial page has no state
		let state = e.state || { uid: 0 };
		let direction = state.uid > currentState.uid ? 'fwd' : 'back';
		let distance = Math.abs(state.uid - currentState.uid);
		// todo: should this be below the next IF?
		currentState = state;

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

		showPage(window.location.pathname + window.location.search + window.location.hash, state.data, { action: direction, distance });
	});
}

export function navigate(url, data) {
	if (url === 'goal') {
		url = goal ? goal.url : data?.fallback || getPath('root');
		data = goal?.data || {}
		goal = null;
	}

	return showPage(url, data, { action: 'push', distance: 0 });
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

export function back() {
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