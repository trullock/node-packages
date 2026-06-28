export async function loadMarkup (routeResult) {
	let url = '/pages/' + routeResult.name + '.htm';
	let response = await fetch(url)
	let text = await response.text();

    const parser = new DOMParser()
    const doc = parser.parseFromString(text, "text/html")
	const elem = doc.querySelector('body').firstElementChild;
	
	return elem;
}