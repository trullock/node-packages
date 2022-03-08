# About

Dollar is a DOM querying and manipulation library designed to massively reduce boilerplate syntax.

## Examples

### Setting deep properties on multiple elements

Instead of doing this:

```
const spans = [...document.querySelectorAll('span')];
spans.forEach(span => span.classList.add('foo'));
```

With Dollar you just do this:

```
const $spans = document.$('span');
$spans.classList.add('foo')
```

### Getting property values from multiple elements

Instead of doing this:

```
const inputs = [...document.querySelectorAll('input')];
const values = inputs.map(input => input.value);
```

With Dollar you just do this:

```
const $inputs = document.$('input');
const values = $inputs.value;
```

### Calling methods on multiple elements


Instead of doing this:

```
const buttons = [...document.querySelectorAll('button')];
buttons.forEach(button => button.addEventListener(e => {}, false));
```

With Dollar you just do this:

```
const $buttons = document.$('button');
$buttons.addEventListener(e => {}, false);

```

### Accessing underlying HTMLElements by index
```
const $inputs = document.$('input');
const input = $inputs[0];
```

## Interceptors

Interceptors are ways of... intercepting getters or setters called on Dollar objects.

### Example: Automatically localising `type=datetime-local` inputs

Say you have an application where you want to set the value of an `<input type="datetime-local" />` via javascript using a `Date` object. You're going to need to convert the date to a local representation manually, because the HTML API sucks for this. Include the below code once in your application:

```
document.$.intercept('input[type=datetime-local]').value = value => {
	if (!(value instanceof Date))
		return value;

	value.setMinutes(value.getMinutes() - value.getTimezoneOffset());
	return value.toISOString().slice(0, 16);
}
```

And then when you want to set the value of an input somewhere, you can do it transparently and not have to worry about the conversion every time:

```
const date = new Date();
date.setTime(xxx); // where xxx is some unlocalised (e.g. UTC) value, perhaps from some API you called
document.$('input[type=datetime-local].local-date').value = date;
```




## Caveats

### Equality comparison

This:

```
document.querySelector('#elem') == document.$('#elem'); // always false
```
Will always be false. Equality comparison against Dollar objects will always be a variable reference equality, so only the below would be true:

```
const $foo = document.$('.foo');
$foo == $foo; // true, obviously
```

However, to compare Dollar objects with themselves or HTMLElements, use the `equals()` method which supports single and multiple element selectors.

### Examples

```
const $elem = document.$('#elem');
$elem.equals(document.querySelector('#elem')); // true
```

```
const $elems = document.$('.elem');
const $elems2 = document.$('.elem');
$elems.equals($elems2); // true
```
