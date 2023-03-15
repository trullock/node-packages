# Page Manager

This project provides a skeleton for building single page webapps, with a focus on advanced browser navigation support, history manipulation and lazy loading.

## Pages

Create a basic page like this:

```
import {registerPage, Page} from '@trullock/page-manager';
registerPage('view-thing', '/things/{thingId}', class extends Page {

});
```

The first argument `'view-thing'` is the name of the page, this can be used to build/look-up its url later without needing to hardcode url strings everywhere

The second argument `'/things/{thingId}'` is the url (route) of the page

The third arguent is a class definition for the page.

### Routing

Routes are definied in a simple way, e.g.

* `/path/to/my/page`
* `/things/{thingId}`
* `/parentThings/{parentId}/childThings/{childId}`

Query strings are always decoded and captured, they do not need specifying in the route.

To build a URL from a route and some parameters, do this:

```
import { getPath, registerPage } from '@trullock/page-manager';

registerPage('view-thing', '/things/{thingId}', class extends Page { } );

let url = getPath('view-thing', { thingId: 1 })
// url == '/things/1'
```

### Page methods

#### Constructor

A page's constructor is called when an instance of the page is first created. Assuming the default caching policy this will only happen once per route definition. See the Caching section for more info. 

The constructor is called without any knowledge of the URL it was requested on, for that use `boot(opts)`.

The page markup is accessible in the constructor but it has not yet been attached to the main page DOM.

e.g.

```
	constructor($page){
		super($page);

		this.$thingName = $page.getElementById('ThingName');
	}
```

#### Boot

`boot(opts)` is called once the page has been attached to the DOM and is about to be shown for the first time. Assuming the default caching policy this will only happen once per route definition. See the Caching section for more info.

`opts` contains information about the request that was made to the page:

`opts.event` contains information about the navigation which occurred to this page.

`opts.hash` contains any hash fragment from the request url

`opts.route` contains information about the route and the request url and parameters

Any query or url parameters will also be present on opts. Currently these are at the top level meaning you could get conflicts between the formally defined properties above and any parameters. For now, avoid creating conflicting parameters with these names.


e.g. get a `Thing` from the database based on a url parameter and update the page markup with details of the `Thing`

```
	async boot(opts){
		let thing = await getThing(opts.thingId);
		this.$thingName.textContent = thing.name;
	}
```

#### Show

`show(opts)` is called before the page is shown. This may happen multiple times in a page's life.

Assuming the default caching strategy, the markup for a page will remain between consecutive show/hide events. Consequently any content which is present on one show which should not be on the next show will need manually adjusting.

e.g. Update the time the page was shown, every time its shown

```
	constructor($page){
		super($page);
		this.$time = $page.getElementById('Time');
	}

	async show(opts){
		this.$time.textContent = new Date().getTime();
	}
```

#### Update

`update(opts)` is similar to show. If `pageManager.navigate()` is called to the same url (route) as the current page, `show` and `hide` are not called as you might expect, instead `update(opts)` gets called where you can update the page with the new information from `opts`

#### Hide
`hide()` is called when the page needs hiding, i.e. the user has navigated away and the next page is about to be shown.


```
	async hide(){
		// Do some clean up, like stopping any animations which may be happening
	}
```

## Navigating

To show a new page, use the `navigate(url, data, checkBeforeHide = true)` method.

`url` is the URL of the page to show

`data` is optional data to pass to the page, as well as certain special instructions for how to perform the navigation

`checkBeforeHide` defaults to true, and causes the current page's `beforeHide` method to be called before hiding the current page and showing the next

### beforeHide

If you wish to force the user to confirm a navigation away from the current page (e.g. to prevent losing unsaved changes in a form) you can use the `beforeHide` functionality.

Define the `beforeHide` handler on the PageManager setup:

```
pageManager.init({
	beforeHide: message => new Promise(resolve => {
		resolve(confirm(message))
	})
});
```

and then define page specific `beforeHide` begaviours:

```
pageManager.registerPage('edit-thing', '/thing/{thingId}/edit', class extends Page {
	beforeHide = () => 'Are you sure?'
});
```

## Page Container

The `pageContainer` option is a function which returns a document element which will contain the markup for each page when it's loaded:

`pageContainer: () => document.body`

## Prepare Markup

The `prepareMarkup` option is a function which takes the HTML for each loaded page as an argument. It is exectuted after the HTML has been fetched and before it is inserted into the DOM and shown.
This is useful if you want to modify the HTML in some way, a common example is to bind validation libraries to forms.

To add a class to all `<p>`s within the page, you could do:

```
prepareMarkup: $html => {
	[...$html.querySelectorAll('.p')].forEach($p => $p.classList.add('example'));
}
```