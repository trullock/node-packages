export default class extends Error {
	constructor(url, message, data, action) {
		super(message || 'Error showing requested page')

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace)
			Error.captureStackTrace(this, PageShowError)

		this.name = 'PageShowError'
		this.url = url;
		this.data = data;
		this.action = action;
	}
}