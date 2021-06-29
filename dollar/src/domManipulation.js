/**
 * Removes the current element from its parent
 * @returns The removed element
 */
HTMLElement.prototype.remove = function () {
	if(!this.parentElement)
		return null;
	return this.parentElement.removeChild(this);
}

/**
 * Removes all child elements from this element
 */
HTMLElement.prototype.empty = function () {
	while(this.firstElementChild)
		this.removeChild(this.firstElementChild);
}