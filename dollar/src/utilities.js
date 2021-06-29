HTMLElement.prototype.offset = function(){
	let offsetTop = 0;
	let offsetLeft = 0;
	let elem = this;
	do {
		if (!isNaN(elem.offsetTop))
			offsetTop += elem.offsetTop;
		if (!isNaN(elem.offsetLeft))
			offsetLeft += elem.offsetLeft;
	} while (elem = elem.offsetParent);
	return {
		top: offsetTop,
		left: offsetLeft
	};
}
