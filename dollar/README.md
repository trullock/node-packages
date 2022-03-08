# About

Dollar is a DOM querying and manipulation library designed to massively reduce boilerplate syntax.

# Selecting elements

When selecting element with Dollar you get a Dollar object back not a `NodeList` or single `HTMLElement`s, which proxies further usages to the underlying HTMLElements.

This allows the syntax shortcuts to take place, with the caveats noted below.

## Selecting elements with `$()`

This will select 0, 1 or many elements - depending on what `.selector` matches. It uses `querySelectorAll` underneath.

```
const $elements = document.$('.selector')
```

Note that if no elements are found, $elements is an empty Dollar object, not null. This means you shouldn't do `if(!$elements)` for seeing if you selected nothing. If thats the behaviour you want see `$1` below.

## Selecting elements with `$1()`

This will select 0 or 1 elements - depending on what `.selector` matches. It uses `querySelector` underneath.

```
const $singleElementOrNull = document.$1('.selector');
```

# Examples

## Setting deep properties on multiple elements

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

## Getting property values from multiple elements

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

## Calling methods on multiple elements


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

## Accessing underlying HTMLElements by index
```
const $inputs = document.$('input');
const input = $inputs[0];
```

## Converting a Dollar object into an array of HTMLElements
```
const $spans = document.$('span');
const spans = [...$spans];
```

## Selecting descendent elements from a Dollar object
```
const $sections = document.$('section');
const $allPs = $sections.$('p');
```

# Interceptors

Interceptors are ways of... intercepting getters or setters called on Dollar objects.

## Example: Automatically localising `type=datetime-local` inputs

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
document.$('input[type=datetime-local].example-input').value = date;
```

# Do i have a Dollar or not?
If you're not sure if an object reference is to a Dollar object or not, you can check the `__isDollarProxy` property.

```
const iAmTrue = document.$('span').__isDollarProxy;
```


# Caveats

## Null comparison

If you expect to select a single element and then want to check if it exists (or rather, was selected) using falseyness, you should use the `$1()` method, as `$()` will return a `.length == 0` collection rather than null.

```
const $singleElementOrNull = document.$1('.selector');
if(!$singleElementOrNull)
{
	// this will work
}
```


```
const $elements = document.$('.selector');
if(!$elements)
{
	// this will never be called, $elements will always be truey, even if no elements were selected. You'll get an empty collection instead.
}
```

## Equality comparison

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

## Examples

```
const $elem = document.$('#elem');
$elem.equals(document.querySelector('#elem')); // true
```

```
const $elems = document.$('.elem'); // this selects many things
const $elems2 = document.$('.elem'); // this selects the same many things again as a separate object
$elems.equals($elems2); // true
```
