export default class Page {

	static cacheMarkupBy = 'route'
	
	constructor($page){
		this.$page = $page;
	}

	get title() {
		return this.$page.dataset['title'] || 'PageManager'
	}

	boot(opts){
		return Promise.resolve();
	}

	show(opts) {
		this.$page.style.display = 'block';
		return Promise.resolve();
	}

	update() {
		return Promise.resolve();
	 }

	hide() {
		this.$page.style.display = 'none';
		return Promise.resolve();
	}
}