/**
 * Takes a single function or an array of functions which return firestore references and executes onSnapshots on them all, calling call callback function once (initially) when all data is ready, and then repeatedly when any individual snapshot is updated
 * @param {function | array of functions} actions 
 * @param {function} callback called with arguments containing the snapshot from each action
 * @returns Promise resolving with a listener unsubscribe function
 */
export function onSnapshot(actions, callback) {

	if(!Array.isArray(actions))
		actions = [actions];

	return new Promise((resolve, reject) => {
		let unsubs = [];
		let data = [];

		let firstRuns = actions.map((action, i) => {
			let firstRun = true;
			return new Promise((resolve, reject) => {
				let unsub = action().onSnapshot(snap => {
					data[i] = snap;
					if (firstRun) {
						resolve(snap);
						firstRun = false;
						return;
					}

					try {
						callback.apply(null, data);
					}
					catch (e) {
						console.error(e);
						reject(e);
					}
				});
				unsubs.push(unsub);
			});
		});

		Promise.all(firstRuns).then(() => {
			try {
				callback.apply(null, data);
			}
			catch (e) {
				reject(e);
				unsubs.forEach(f => f());
			}

			resolve(() => unsubs.forEach(f => f()));
		})



	});
}
