import router from './router';

var currentPage, currentPagePath, pageHash = {}, pageCache = {};
var currentState = { uid: 0 };
var manuallyAdjustingHistory = false;
var goal = null;

var $navbar = null;

export const pages = pageHash;

export function registerPage(name, route, pageClass)
{
	router.addRoute(name, route, pageClass);

	pageHash[name] = { 
		url: route,
		pageClass: pageClass
	}

	return pageClass;
}


export function getPath(name, values)
{
	let url = router.interpolate(name, values);
	if(values?.hash)
		url += '#' + values.hash;
	return url;
}

function doShow(route, page, data, event){

	window.scroll(0, 0);
	currentPagePath = route.path;
	currentPage = page;

	document.title = page.title;

	if(page.constructor.showNavbar !== false)
		$navbar.classList.remove('d-none');
	else
		$navbar.classList.add('d-none');

	return pageCache['/loading'].page.show().then(() => 
		currentPage.show(data, event)
			.then(() => pageCache['/loading'].page.hide(), e => {
				console.error(e);
				return showPage(e.url, e.data, { action: e.action || 'show' });
			})
		)
}

function loadPage(route){
	return fetch('/pages/' + route.routeName + '.html')
		.then(r => r.text())
		.then(html => {
			var $div = document.createElement('div');
			$div.innerHTML = html;
			// Pages are assumed to have a single wrapping element
			return $div.firstElementChild;
		})
		.then($html => {
			document.body.appendChild($html);
			pageCache[route.pattern] = {
				$html,
				page: new (route.pageClass)($html)
			}
			return pageCache[route.pattern].page;
		})
}

function showPage(url, data, event) {
	var route = router.parse(url);
	if(route == null)
	{
		console.error(`Can't find page: '${url}'`);
		return Promise.reject(new Error(`Can't find page: '${url}'`));
	}

	data = data || {};
	for(let key in route.params)
		data[key] = route.params[key];
	
	if (route.pageClass.requireAuth && !firebase.auth().currentUser) {
		goal = { url, data, event };
		return showPage(getPath('sign-in'), null, event);
	}
	
	var getPage = pageCache['/loading'].page.show().then(() => {
		if(pageCache[route.pattern])
			return pageCache[route.pattern].page;

		return loadPage(route)
	});

	// handle initial page
	if(!currentPage)
		return getPage.then(page => doShow(route, page, data, event));
	
	if (currentPagePath == route.path){
		handleHistoryAction(event, url, data);
		return getPage.then(page => doShow(route, page, data, event));
	}

	return currentPage.hide(event).then(() => 
			getPage.then(page => {
				handleHistoryAction(event, url, page.title, data);
				return doShow(route, page, data, event);
			})
		, e => {
			manuallyAdjustingHistory = () => manuallyAdjustingHistory = false;
			if (event.action == 'back')
				history.go(1);
			else if (event.action == 'fwd')
				history.go(-1);
		});
}

function handleHistoryAction(event, url, title, data){
	if(event.action == 'push')
	{
		currentState = { uid: ++currentState.uid, data };
		window.history.pushState(currentState, title, url);
	}
	else if(event.action == 'replace')
	{
		currentState = { uid: currentState.uid, data };
		window.history.replaceState(currentState, title, url);
	}
}

export function init() {
	
	$navbar = document.$('.js-navbar');

	// handle pages whose markup is already loaded in the page
	for(var key in pageHash){
		if(pageHash[key].pageClass.existingDomSelector){
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

		if(manuallyAdjustingHistory){
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
	if(url === 'goal')
	{
		url = goal ? goal.url : data?.fallback || getPath('root');
		data = goal?.data || {}
		goal = null;
	}

	return showPage(url, data, { action: 'push', distance: 0 });
}

export function update(opts) {
	opts = Object.assign({
		url: window.location.pathname + window.location.search + window.location.hash,
		title: currentPage.title,
		data: {}
	}, opts);
	handleHistoryAction({ action: 'replace', distance: 0 }, opts.url, opts.title, opts.data);
}

export function replace(url, data) {
	return showPage(url, data, { action: 'replace', distance: 0 });
}

export function show(url, data) {
	return showPage(url, data, { action: 'show', distance: 0 });
}

export function back(){
	history.go(-1);
}

export function rewind(method) {
	// This is only safe if youre confident theres a hashless path in our history, else it may go offsite
	if(method == 'drop-hash'){
		let originalUrl = window.location.pathname + window.location.search + window.location.hash;
		let originalTitle = currentPage.title;
		return new Promise((resolve) => {
			manuallyAdjustingHistory = opts => {
				if (!opts.hash)
				{
					handleHistoryAction({ action: 'push', distance: 0 }, originalUrl, originalTitle, {});
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