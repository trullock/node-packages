

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