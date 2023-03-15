import router from '@trullock/router';

var pageHash = {},
	pageCache = {},
	pageTemplateCache = {},
	stack = [],
	stackPointer = -1;

var manuallyAdjustingHistory = false;
var handlingBeforeHide = false;
var lastNavigationDirection = null;

var goal = null;
var backData = {};
var options = {
	fetchPath: route => '/pages/' + route.routeName + '.html',
	fetchPageTemplate: route => {
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
	},
	pageInterrupt: route => null,
	attachMarkup: $html => document.body.appendChild($html),
	prepareMarkup: $html => { },
	loadingPageName: 'loading',
	error404PageName: 'error-404',
	defaultPageName: 'root',
	beforeHide: null
}

export const pages = pageHash;

export function registerPage(argA, argB, argC) {

	let namedRoutes = null, 
		pageClass = null;

	if(argC == undefined)
	{
		namedRoutes = argA;
		pageClass = argB;
	} else {
		namedRoutes = {
			[argA]: argB
		};
		pageClass = argC;
	}
	

	for (const [name, route] of Object.entries(namedRoutes)) {
		router.addRoute(name, route, pageClass);

		pageHash[name] = {
			url: route,
			pageClass: pageClass
		}
	}

	return pageClass;
}

export function getPath(name, values) {
	let url = router.interpolate(name, values);
	if (values?.hash)
		url += '#' + values.hash;
	return url;
}

export function refresh() {
	let frame = stack[stackPointer];
	showPage(frame.data.route.url, frame.data, 'replace');
}

// TODO: 404 and error too?
function initLoading()
{
	var page = pageHash[options.loadingPageName];
	var route = router.parse(page.url);
	return loadPage(route, {});
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

	return Promise.resolve(page.show(data));
}

function loadPage(route, data) {

	var fetchPage = pageTemplateCache[route.pattern] ? Promise.resolve(pageTemplateCache[route.pattern]) : options.fetchPageTemplate(route);

	return fetchPage.then($template => {
		var $html = $template.cloneNode(true);
		options.prepareMarkup($html);
		options.attachMarkup($html);
		pageCache[route.path] = {
			$html,
			page: new (route.pageClass)($html)
		}

		var page = pageCache[route.path].page;
		
		let booted = new Promise(resolve => resolve(page.boot(data)));
		return booted.then(() => page);
	});
}

function showPage(url, data, event) {
	var route = router.parse(url);
	if (route == null) {
		console.error(`Can't find page: '${url}'`);
		let page404 = pageHash[options.error404PageName];
		if(!page404)
			return Promise.reject(new PageShowError('/', `Can't find page: '${url}'. Also can't find 404 page: '${options.error404PageName}'`, {}, 'replace'));

		return Promise.reject(new PageShowError(page404.url, `Can't find page: '${url}'`, {}, 'show'));
	}

	data = data || {};
	for (let key in route.params)
		data[key] = route.params[key];

	data.route = {
		url: url,
		path: route.path,
		routeName: route.routeName,
		params: route.params
	};
	data.event = event;

	let interrupt = options.pageInterrupt(route);
	if(interrupt)
	{
		goal = { url, data };
		return showPage(interrupt.url, null, event);
	}
	
	var getPage = showLoading().then(() => {
		if (pageCache[route.path])
			return pageCache[route.path].page;

		return loadPage(route, data)
	});

	// handle initial page
	if (event.action == 'load')
	{
		return getPage
					.then(page => doShow(page, data))
					.then(page => {
						// clean initial load
						if(stackPointer == -1)
						{
							stack.push({ uid: 0, data, page });
							stackPointer = 0;
						}
						// page refresh
						else
						{
							stack[stackPointer].page = page;
							stack[stackPointer].data = data;
						}
						return page;
					});
	}

	let currentState = stack[stackPointer];

	if (currentState.data.route.path == route.path) {
		handleHistoryAction(event, url, data, currentState.page);
		return getPage.then(page => doUpdate(page, data));
	}

	currentState.data.scrollY = window.scrollY;

	return Promise.all([
			currentState.page.hide(event),
			getPage
		])
			.then(results => results[1])
			.then(page => {
				handleHistoryAction(event, url, data, page);
				return doShow(page, data);
			});
			// .catch(e => {
			// 	// TODO: what case is this?
			// 	manuallyAdjustingHistory = () => manuallyAdjustingHistory = false;
			// 	if (event.action == 'back')
			// 		history.go(1);
			// 	else if (event.action == 'fwd')
			// 		history.go(-1);
			// });
}

function doShow(page, data) {

	window.scroll(0, 0);

	return Promise.resolve(page.show(data))
			.then(() => document.title = page.title)
			// todo: hide() should be passed an event object
			.then(() => pageCache[pageHash[options.loadingPageName].url].page.hide())
			// return page
			.then(() => page);
}


async function doUpdate(page, data) {

	await Promise.resolve(page.update(data));

	document.title = page.title
	// todo: hide() should be passed an event object
	await pageCache[pageHash[options.loadingPageName].url].page.hide()
	return page;
}

function handleHistoryAction(event, url, data, page) {
	if (event.action == 'push') {
		let newUid = stack[stackPointer].uid + 1;

		window.history.pushState({ uid: newUid }, null, url);
		
		// remove future
		stack.splice(stackPointer + 1, stack.length - stackPointer);

		stack.push({ uid: newUid, data, page });
		stackPointer++;
	}
	else if (event.action == 'replace') {
		// TODO: this case may be buggy

		let currentUid = stack[stackPointer].uid;
		window.history.replaceState({ uid: currentUid }, null, url);
		
		stack.pop();
		stack.push({ uid: currentUid, data, page });
	}
	else if(event.action == 'back')
	{
		stackPointer -= event.distance;
	}
	else if (event.action == 'fwd')
	{
		stackPointer += event.distance;
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

function storageAvailable() {
	return false;
    try {
        var x = '__storage_test__';
        window.sessionStorage.setItem(x, x);
        window.sessionStorage.removeItem(x);
        return true;
    }
    catch(e) {
        return false;
    }
}

export async function init(opts) {

	Object.assign(options, opts);

	if(storageAvailable())
	{
		let storedStack = window.sessionStorage.getItem("stack");
		if(storedStack)
		{
			storedStack = JSON.parse(storedStack);
			stack = storedStack.stack;
			stackPointer = storedStack.stackPointer;
			window.sessionStorage.removeItem("stack");
		}
	}

	// handle pages whose markup is already loaded in the page
	for (var key in pageHash) {
		if (pageHash[key].pageClass.existingDomSelector) {
			let $html = document.querySelector(pageHash[key].pageClass.existingDomSelector)
			if(!$html)
			{
				console.error(`Unable to find DOM element '${pageHash[key].pageClass.existingDomSelector}' for page '${key}'`)
				continue;
			}
			
			// TODO: this is inefficient for non parameterised routes. There will always be HTML in memory and then copied for the page once loaded
			pageTemplateCache[router.routesByName[key]._pattern] = $html;
			$html.parentElement.removeChild($html);	
		}
	}

	await initLoading();
	
	// set initial page
	showPage(window.location.pathname + window.location.search + window.location.hash, null, { action: 'load', distance: 0 }).catch(e => {
		console.error(e);
		
		if (e instanceof PageShowError)
		{
			return showPage(e.url, e.data, { action: stackPointer == -1 ? 'load' : e.action || 'show' }).then(page => {
				if(e.action == 'replace')
					handleHistoryAction({ action: e.action }, e.url, e.data, page);
				return page;
			});
			
		}
	});

	function handlePopstate(context, direction, distance) {

		if (manuallyAdjustingHistory) {
			manuallyAdjustingHistory(context, { action: direction, distance });
			return;
		}

		if (direction == 'back')
			Object.assign(context.data, backData);
		backData = {};

		showPage(context.data.route.url, context.data, { action: direction, distance }).catch(e => {
			console.error(e);
			if (e instanceof PageShowError)
				return showPage(e.url, e.data, { action: e.action || 'show' });
		}).then(page => {
			// set page as it can be missing in the case of refreshes
			context.page = page;
		})
	}

	function handleBeforeHidePart1() {
		// if we're ignoring beforeHide this navigation
		if (handlingBeforeHide === 'ignore') {
			handlingBeforeHide = false;
			return false;
		}

		// if we have a before-unload confirm to show
		if (stack[stackPointer].page.beforeHide && options.beforeHide && handlingBeforeHide === false) {
			var interrupt = stack[stackPointer].page.beforeHide();
			if (interrupt) {
				handlingBeforeHide = 'step1';

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

		// we've finished beforeHiding
		if (handlingBeforeHide === 'step2')
			handlingBeforeHide = false;

		return false;
	}

	function handleBeforeHidePart2() {
		if (handlingBeforeHide !== 'step1')
			return false;

		// do the beforeHide action, then...
		options.beforeHide(stack[stackPointer].page.beforeHide()).then(result => {

			// if the user confirmed, redo the original action
			if (result) {

				handlingBeforeHide = 'step2';

				if (lastNavigationDirection == 'fwd')
					history.forward();
				else if (lastNavigationDirection == 'back')
					history.back();
			} else {
				handlingBeforeHide = false;
			}
		});

		return true;
	}

	// listen for browser navigations
	window.addEventListener("popstate", e => {
		var interrupted = handleBeforeHidePart2();
		if (interrupted)
			return;

		let newUid = e.state?.uid || 0;
		let previousUid = stack[stackPointer].uid;

		lastNavigationDirection = newUid > previousUid ? 'fwd' : 'back';
		let distance = Math.abs(newUid - previousUid);

		var interrupted = handleBeforeHidePart1();
		if (interrupted)
			return;

		var context = findContext(newUid);
		handlePopstate(context, lastNavigationDirection, distance);
	});

	if(storageAvailable())
	{
		window.addEventListener("beforeHide", () => {

			let stackToSerialize = stack.map(s => ({
				uid: s.uid,
				data: s.data
			}));
			let stackToStore = {
				stack: stackToSerialize,
				stackPointer
			}
			window.sessionStorage.setItem('stack', JSON.stringify(stackToStore));
		});
	}
}

function findContext(uid){
	for (var i = 0; i < stack.length; i++) {
		if (stack[i].uid == uid)
			return stack[i];
	}
	return null;
}

function expandOnlyHash(url)
{
	if(url.startsWith('#'))
	{
		let currentState = stack[stackPointer];
		let currentUrl = currentState.data.route.url;
		let hashIndex = currentUrl.indexOf('#');
		if(hashIndex > -1)
			return currentUrl.substr(0, hashIndex);
		return currentUrl + url;
	}

	return url;
}

export function navigate(url, data, checkBeforeHide = true) {

	url = expandOnlyHash(url);

	if (checkBeforeHide === true && stack[stackPointer].page.beforeHide && options.beforeHide) {

		var interrupt = stack[stackPointer].page.beforeHide();
		if (interrupt !== false) {
			options.beforeHide(interrupt).then(result => {
				if (result)
					doNavigate(url, data);
			});
			return;
		}
	}

	doNavigate(url, data).catch(e => {
		console.error(e);
		if (e instanceof PageShowError)
			return showPage(e.url, e.data, { action: e.action || 'show' });
	});
}

export function replace(url, data) {
	url = expandOnlyHash(url);
	return showPage(url, data, { action: 'replace', distance: 0 });
}

export function show(url, data) {
	return showPage(url, data, { action: 'show', distance: 0 });
}

export function back(data, checkBeforeHide) {
	backData = data || {};
	handlingBeforeHide = checkBeforeHide === false ? 'ignore' : false;
	history.go(-1);
}

export function printStack() {
	console.log("Stack length: " + stack.length);
	console.log("Stack pointer: " + stackPointer);
	for(var i = 0; i < stack.length; i++)
		console.log(stack[i]);
}

export function removeHistory(predicate)
{
	let statesToKeep = [];
	for (var i = 0; i < stack.length; i++)
	{
		if (!predicate(stack[i], i))
			statesToKeep.push(stack[i]);
	}

	// TODO: ensure we always have at least 1 state to keep - must/can this always be the current page?

	if (statesToKeep.length == stack.length)
		return Promise.resolve();


	return new Promise((resolve, reject) => {


		let backsToDo = stackPointer - 1;
		let currentUid = -1;

		//  TODO: handle stack pointer not being at the tail when this process starts

		manuallyAdjustingHistory = _ => {
			// rewind to the first history position
			if(backsToDo > 0)
			{
				window.setTimeout(() => {
					backsToDo--;
					history.back();
				}, 1);
				return;
			}

			// reset the stack
			stack = [];

			for (var k = 0; k < statesToKeep.length; k++) {
				let currentState = statesToKeep[k];
				currentState.uid = ++currentUid;

				if (k == 0)
					window.history.replaceState({ uid: currentState.uid }, null, currentState.data.route.url);
				else
					window.history.pushState({ uid: currentState.uid }, null, currentState.data.route.url);
				
					// TODO: this doesnt seem to work when k=0
				document.title = currentState.page.title;

				stack.push(currentState);
			}

			stackPointer = stack.length - 1;

			manuallyAdjustingHistory = false;
		};

		history.back();
	});
}

export function purgeCache() {
	for (const path in pageCache)
	{
		pageCache[path].page.destroy && pageCache[path].page.destroy();
		if (!pageCache[path].page.constructor.existingDomSelector)
		{
			pageCache[path].$html.remove();
			delete pageCache[path];
		}
	}
}

export class PageShowError extends Error {
	constructor(url, message, data, action) {
		super(message || 'Error showing requested page')

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, PageShowError)

		this.name = 'PageShowError'
		this.url = url;
		this.data = data;
		this.action = action;
	}
}