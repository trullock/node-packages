# Page Manager

This project provides a skeleton for building single page webapps, with a focus on advanced browser navigation support and history manipulation.

## Pages

Create a basic page like this:

```
import {registerPage, Page} from '@trullock/page-manager';
registerPage('my-page', '/my-page', class extends Page {

});

```

The first argument `'my-page'` is the name of the page, this can be used to build/look-up its url later without needing to hardcode url strings everywhere

The second argument `'/my-page'` is the url (route) of the page

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

		let $thing = $page.getElementById('Thing');
	}
```

#### Boot

`boot(opts)` is called once the page has been attached to the DOM and is about to be shown for the first time. Assuming the default caching policy this will only happen once per route definition. See the Caching section for more info.

`opts` contains information about the request that was made to the page:

`opts.event` contains information about the navigation which occurred to this page.

`opts.hash` contains any hash fragment from the request url

`opts.route` contains information about the route and the request url and parameters

Any query or url parameters will also be present on opts. Currently these are at the top level meaning you could get conflicts between the formally defined properties above and any parameters. For now, avoid creating conflicting parameters with these names.

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