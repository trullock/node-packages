HTMLElement.prototype.addClickListener = function(cb, useCapture){
	return this.addEventListener('click', e => {
		e.preventDefault()
		cb.call(this, e);
	}, useCapture || false);
}