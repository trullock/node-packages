export class PageShowError extends Error {
	constructor(url, data, action) {
		super('Error showing requested page')

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, PageShowError)

		this.name = 'PageShowError'
		this.url = url;
		this.data = data;
		this.action = action;
	}
}