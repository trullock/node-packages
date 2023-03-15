export default class Page {
	
	constructor($page){
		this.$page = $page;
		this.visible = false;
	}

	invalidateCache(){
		// TODO: pagemanager doesnt currently read this
		this.dirty = true;
	}

	_title = null;
	get title() {
		return this._title;
	}
	set title(value) {
		this._title = value;
	}

	boot(opts){
		return Promise.resolve();
	}

	update(data) {
		return Promise.resolve();
	}

	show(opts) {
		if(!this.visible)
		{
			this.$page.style.display = 'block';
			this.visible = true;
		} 
					
		return Promise.resolve();
	}

	hide() {
		if(this.visible)
		{
			this.$page.style.display = 'none';
			this.visible = false;
		} 
					
		return Promise.resolve();
	}
}