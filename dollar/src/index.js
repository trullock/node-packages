HTMLElement.prototype.addClickListener = function(cb, useCapture){
	return this.addEventListener('click', e => {
		e.preventDefault()
		cb.call(this, e);
	}, useCapture || false);
}
HTMLElement.prototype.$$ = function (selector) {
	return [...this.querySelectorAll(selector)];
}
HTMLElement.prototype.$ = function (selector) {
	return this.querySelector(selector);
}
HTMLElement.prototype.remove = function () {
	if(!this.parentElement)
		return null;
	return this.parentElement.removeChild(this);
}
HTMLDocument.prototype.$$ = function (selector) {
	return [...this.querySelectorAll(selector)];
}
HTMLDocument.prototype.$ = function (selector) {
	return this.querySelector(selector);
}

HTMLElement.prototype.empty = function () {
	while(this.firstElementChild)
		this.removeChild(this.firstElementChild);
}


HTMLElement.prototype.offset = function(){
	let offsetTop = 0;
	let offsetLeft = 0;
	let elem = this;
	do {
		if (!isNaN(elem.offsetTop))
			offsetTop += elem.offsetTop;
		if (!isNaN(elem.offsetLeft))
			offsetTop += elem.offsetLeft;
	} while (elem = elem.offsetParent);
	return {
		top: offsetTop,
		left: offsetLeft
	};
}