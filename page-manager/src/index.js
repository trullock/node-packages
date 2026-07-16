import Router from '@trullock/router';

let pageCache = {},
	pageTemplateCache = {},
	stack = [],
	stackPointer = -1;

let manuallyAdjustingHistory = false;
let handlingBeforeHide = false;
let beforeHideNavDirection = null;

let router = new Router();

let goal = null;
let backData = {};
let options = {
	pageInterrupt: routeResult => null,
	attachMarkup: $html => document.body.appendChild($html),
	prepareMarkup: $html => { },
	loadingPageName: 'loading',
	error404PageName: 'error-404',
	defaultPageName: 'root',
	beforeHide: null
}

export function registerPage(opts) {

	let loadPageClass = opts.pageClass ? (() => opts.pageClass) : opts.loadPageClass;
	let namedRoutes = opts.namedRoutes || { [opts.name]: opts.route };
	let cacheMarkupBy = opts.cacheMarkupBy || 'path'
	let extra = opts.extra || {}

	for (const [name, route] of Object.entries(namedRoutes)) {
		router.addRoute(name, route, {
			route,
			loadPageClass,
			loadMarkup: opts.loadMarkup,
			cacheMarkupBy,
			extra
		});
	}
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

function emitUrlChanged(url)
{
	window.dispatchEvent(new CustomEvent('page-manager.url-changed', { 
		detail: {
			url: url
		},
		bubbles: true
	}))
}

// TODO: 404 and error too?
function initLoading()
{
	var url = router.interpolate(options.loadingPageName, {});
	var routeResult = router.parse(url);
	return loadPage(routeResult, {});
}

function showLoading() {
	var url = router.interpolate(options.loadingPageName, {});
	var route = router.parse(url);
	var data = {
		route: route,
		scrollY: window.scrollY,
		event: {
			action: 'replace'
		}
	};

	var page = (pageCache[route.path] || pageCache[route.pattern]).page;
	return Promise.resolve(page.show(data));
}

function hideLoading() {
	var url = router.interpolate(options.loadingPageName, {});
	var route = router.parse(url);
	var page = (pageCache[route.path] || pageCache[route.pattern]).page;
	return Promise.resolve(page.hide());
}

async function loadPage(routeResult, data)
{
	if(!pageTemplateCache[routeResult.pattern])
		pageTemplateCache[routeResult.pattern] = await routeResult.data.loadMarkup(routeResult);
	let $template = pageTemplateCache[routeResult.pattern]

	var $html = $template.cloneNode(true);
	options.prepareMarkup($html);
	options.attachMarkup($html);
	
	routeResult.data.pageClass = await Promise.resolve(routeResult.data.loadPageClass());
	let page = new (routeResult.data.pageClass)($html);
	
	await Promise.resolve(page.boot(data));
	
	let cacheKey = routeResult.data.cacheMarkupBy == 'path' ? routeResult.path : routeResult.pattern;
	pageCache[cacheKey] = {
		$html,
		page
	};
	
	return page;
}

async function showPage(url, data, event)
{
	var routeResult = router.parse(url);
	if (routeResult == null) {
		console.error(`Can't find page: '${url}'`);
		
		let url = router.interpolate(options.error404PageName, {});
		routeResult = router.parse(url)
	}

	data = data || {};
	for (let key in routeResult.params)
		data[key] = routeResult.params[key];

	data.route = {
		url: url,
		path: routeResult.path,
		name: routeResult.name,
		params: routeResult.params
	};
	if(!data.event)
		data.originalEvent = event;
	data.event = event;

	let interrupt = await Promise.resolve(options.pageInterrupt(routeResult));
	if(interrupt)
	{
		goal = { url, data };
		return showPage(interrupt.url, null, event);
	}
	
	await showLoading();

	var getPage = null
	if (pageCache[routeResult.path])
		getPage = pageCache[routeResult.path].page;
	else if (pageCache[routeResult.pattern])
		getPage = pageCache[routeResult.pattern].page;
	else
		getPage = loadPage(routeResult, data)

	// handle initial page
	if (event.action == 'load')
	{
		const page = await getPage;
		await doShow(page, data);
		await hideLoading();

		// clean initial load
		if (stackPointer == -1)
		{
			stack.push({ uid: 0, data, page });
			stackPointer = 0;
		}
		// page refresh
		else if(stack[stackPointer].data.route.url == data.route.url)
		{
			stack[stackPointer].page = page;
			stack[stackPointer].data = data;
		}
		// page replacement via address bar
		else
		{
			stack.splice(stackPointer + 1, stack.length - stackPointer);
			let newUid = getNewUid()
			stack.push({ uid: newUid, data, page });
			stackPointer++;
		}

		// set initial page
		emitUrlChanged(window.location.pathname + window.location.search + window.location.hash);

		return page;
	}

	let currentState = stack[stackPointer];

	// TODO: what does this logic really mean?
	if (currentState.data.route.path == routeResult.path) {
		handleHistoryAction(event, url, data, currentState.page);
		const page = await getPage;
		await doUpdate(page, data);
		await hideLoading();
		return page;
	}

	currentState.data.scrollY = window.scrollY;

	const results = await Promise.all([
		currentState.page.hide(event),
		getPage
	]);

	const page = results[1];

	handleHistoryAction(event, url, data, page);

	await doShow(page, data);
			// .catch(e => {
			// 	// TODO: what case is this?
			// 	manuallyAdjustingHistory = () => manuallyAdjustingHistory = false;
			// 	if (event.action == 'back')
			// 		history.go(1);
			// 	else if (event.action == 'fwd')
			// 		history.go(-1);
			// });
	await hideLoading();
	return page
}

async function doShow(page, data) {

	window.scroll(0, 0);

	await Promise.resolve(page.show(data));
	document.title = page.title;
}

async function doUpdate(page, data) {

	await Promise.resolve(page.update(data));
	document.title = page.title
}

function getNewUid()
{
	let uid = -1;

	for(let i = 0; i < stack.length; i++)
		uid = Math.max(uid, stack[i].uid)

	return uid + 1;
}

async function handleHistoryAction(event, url, data, page) {
	if (event.action == 'push') {
		let newUid = getNewUid()

		window.history.pushState({ uid: newUid }, null, url);
		
		// remove future
		stack.splice(stackPointer + 1, stack.length - stackPointer);

		stack.push({ uid: newUid, data, page });
		stackPointer++;

		emitUrlChanged(url);
	}
	else if (event.action == 'replace') 
	{
		if(data.route.url == stack[stackPointer - 1]?.data?.route?.url)
		{
			let statesToKeep = [];
			for (var i = 0; i < stackPointer - 1; i++)
				statesToKeep.push(stack[i]);
			statesToKeep.push({ uid: stack[stackPointer - 1].uid, data, page });

			await modifyHistory(statesToKeep);
		}
		else
		{
			let newId = getNewUid();
			window.history.replaceState({ uid: newId }, null, url);
			stack[stackPointer] = { uid: newId, data, page };

			emitUrlChanged(url);
		}
	}
	else if(event.action == 'back')
	{
		stackPointer -= event.distance;
		emitUrlChanged(url);
	}
	else if (event.action == 'fwd')
	{
		stackPointer += event.distance;
		emitUrlChanged(url);
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

function loadStack(fromFwdBack)
{
	if(!storageAvailable())
		return;
	
	let oldStack = stack;

	let storedStack = window.sessionStorage.getItem("stack");
	if(storedStack)
	{
		storedStack = JSON.parse(storedStack);
		stack = storedStack.stack;
		stackPointer = storedStack.stackPointer;
		// we can get out of sync with the history state if we have gone back/fwd over a hard page load
		if(window.history.state)
		{
			// if we've gone back over a page load, the stackpointer can be out of sync 
			if(window.history.state.uid != stack[stackPointer].uid)
			{
				stackPointer = stack.findIndex(s => s.uid == window.history.state.uid);
			}
			else
			{
				// we are in sync
			}
		}
		else
		{
			// no window.history.state means we are on a fresh page load (via direct load or a fwd)
			if(fromFwdBack)
			{
				// if we think we are on 0, then we navigated back before page 0, and have forwarded back to page 0, so we are in sync. Else..
				if(stackPointer > 0)
					stackPointer++;
			}
		}

		window.sessionStorage.removeItem("stack");
	}

	// retain page objects when we've refresh the stack across a hard load/bfcache
	if(oldStack)
	{
		for (var i = 0; i < stack.length; i++)
		{
			let oldPage = oldStack.find(s => s.uid == stack[i].uid)?.page;
			if(oldPage)
				stack[i].page = oldPage;
		}
	}
}

export async function init(opts) {
	Object.assign(options, opts);

	loadStack(false);

	await initLoading();
	await showLoading();
}

window.addEventListener('pageshow', function(event) {
		// TODO: remove me
	console.log('pageshow', event.persisted);

	if(event.persisted)
	{
		loadStack(true);
		// TODO: remove me
		printStack();
	}
});


export async function ready()
{
	// TODO: why isnt this awaited?
	showPage(window.location.pathname + window.location.search + window.location.hash, null, { action: 'load', distance: 0 }).catch(e => {
		console.error(e);
		
		if (e instanceof PageShowError)
		{
			return showPage(e.url, e.data, { action: 'load', distance: 0 }).then(async page => {
				if(e.action == 'replace')
					await handleHistoryAction({ action: e.action }, e.url, e.data, page);
				return page;
			});
		}
	});

	async function handlePopstate(context, direction, distance) {

		if (manuallyAdjustingHistory) {
			await manuallyAdjustingHistory(context, { action: direction, distance });
			return;
		}

		// TODO: whats going on here?
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

	function handleBeforeHidePart1(lastNavDirection) {
		// if we're ignoring beforeHide this navigation
		if (handlingBeforeHide === 'ignore') {
			handlingBeforeHide = false;
			return false;
		}

		// if we have a before-unload confirm to show
		if (stack[stackPointer].page.beforeHide && options.beforeHide && handlingBeforeHide === false) {
			beforeHideNavDirection = lastNavDirection;

			var interrupt = stack[stackPointer].page.beforeHide();
			if (interrupt) {
				handlingBeforeHide = 'step1';

				// do this in a new thread, you cant call history actions from inside a history-aciton-handler
				window.setTimeout(() => {
					// undo the navigation so the URL remains correct whilst we show the confirm dialog
					if (beforeHideNavDirection == 'fwd')
						history.back();
					else if (beforeHideNavDirection == 'back')
						history.forward();
				}, 1);

				return true;
			}
		}

		// we've finished beforeHiding
		if (handlingBeforeHide === 'step2')
		{
			handlingBeforeHide = false;
			beforeHideNavDirection = null;
		}

		return false;
	}

	function handleBeforeHidePart2() {
		if (handlingBeforeHide !== 'step1')
			return false;

		if(manuallyAdjustingHistory)
			return false;

		// do the beforeHide action, then...
		options.beforeHide(stack[stackPointer].page.beforeHide()).then(result => {

			// if the user confirmed, redo the original action
			if (result)
			{
				handlingBeforeHide = 'step2';

				if (beforeHideNavDirection == 'fwd')
					history.forward();
				else if (beforeHideNavDirection == 'back')
					history.back();
			}
			else
			{
				handlingBeforeHide = false;
				beforeHideNavDirection = null;
			}
		});

		return true;
	}

	// listen for browser navigations
	window.addEventListener("popstate", async e => {
		let newUid = -1;
		let context = null;

		if(!e.state)
		{
			// We must have backed to the first page, but this could be the true first page or a hard load/refresh mid-stack.
			// rewind to find the last LOAD
			for(let i = stackPointer; i >= 0; i--)
			{
				if(stack[i].data.originalEvent.action == 'load')
				{
					newUid = stack[i].uid;
					context = stack[i];
					break;
				}
			}
		}
		else
		{
			newUid = e.state.uid
			context = findContext(newUid);
		}

		let previousUid = stack[stackPointer].uid;
		let lastNavigationDirection = newUid > previousUid ? 'fwd' : 'back';
		let distance = Math.abs(newUid - previousUid);
		
		var interrupted = handleBeforeHidePart2();
		if (interrupted)
			return;

		var interrupted = handleBeforeHidePart1(lastNavigationDirection);
		if (interrupted)
			return;

		await handlePopstate(context, lastNavigationDirection, distance);
	});

	
	if(storageAvailable())
	{
		window.addEventListener("beforeunload", () => {

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

	if (checkBeforeHide === true && options.beforeHide && stack[stackPointer].page.beforeHide) {

		var interrupt = stack[stackPointer].page.beforeHide();
		if (interrupt) {
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
	console.log("Stack pointer: " + stackPointer);
	for(var i = 0; i < stack.length; i++)
		console.log((i == stackPointer ? "-> " : "   ") + "UID: " + stack[i].uid + " URL: " + stack[i].data.route.url + " action: " + stack[i].data.event.action + " originalAction: " + stack[i].data.originalEvent.action);
}

function modifyHistory(statesToKeep)
{
	// BUG: You can't remove the 2nd stack frame. This is because you'd have to go back to -1, to then go forward to 0 (removing frame 1)
	// For clarity, you can remove (replace) frame 0 (1st), and frame 2+ (3rd+)
	// As a workaround, we replace the 2nd stack frame, if it is the tail, with the root "/". 
	// This at least hopefully removes any meaning from it, simply taking you "home" rather than to wherever you were likely trying to remove.

	if (statesToKeep.length == stack.length)
		return Promise.resolve();

	return new Promise(async (resolve, reject) => {

		let backsToDo = stackPointer;

		//  TODO: handle stack pointer not being at the tail when this process starts
		
		// see BUG comments at the top of this method
		let apply2ndFrameHack = statesToKeep.length == 1 && stack.length > 1
		let secondFrameHackUid = -1
		let defaultPageRouteResult = null;
		let defaultPage = null;
		if(apply2ndFrameHack)
		{
			let url = getPath(options.defaultPageName);
			defaultPageRouteResult = router.parse(url);
			defaultPage = await loadPage(defaultPageRouteResult, {});

			secondFrameHackUid = getNewUid();
		}

		manuallyAdjustingHistory = async _ => {
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

				if (k == 0)
					window.history.replaceState({ uid: currentState.uid }, currentState.page.title, currentState.data.route.url);
				else
					window.history.pushState({ uid: currentState.uid }, currentState.page.title, currentState.data.route.url);
				
				// TODO: this doesnt seem to work when k=0
				document.title = currentState.page.title;

				stack.push(currentState);

				emitUrlChanged(currentState.data.route.url)
			}

			// see BUG comments at the top of this method
			if(apply2ndFrameHack)
			{
				stack.push({
					uid: secondFrameHackUid,
					data: {
						route: {
							url: defaultPageRouteResult.path,
							path: defaultPageRouteResult.path,
							name: defaultPageRouteResult.name,
							params: defaultPageRouteResult.params
						}
					},
					page: defaultPage
				})

				stackPointer = 0;
			}
			else
			{
				stackPointer = stack.length - 1;
			}
			
			manuallyAdjustingHistory = false;

			resolve();
		};

		// see BUG comments at the top of this method
		if(apply2ndFrameHack && backsToDo == 1)
		{
			window.history.replaceState({ uid: secondFrameHackUid }, defaultPage.title, defaultPageRouteResult.path);
			document.title = defaultPage.title;
		}

		backsToDo--;
		history.back();
	});
}


export function removeHistory(predicate)
{
	let statesToKeep = [];
	for (var i = 0; i < stack.length; i++)
	{
		if (!predicate(stack[i], i))
			statesToKeep.push(stack[i]);
	}

	return modifyHistory(statesToKeep);
}

export function purgeCache() {
	for (const key in pageCache)
	{
		pageCache[key].page.destroy && pageCache[key].page.destroy();
		if (!pageCache[key].page.constructor.existingDomSelector)
		{
			pageCache[key].$html.remove();
			delete pageCache[key];
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