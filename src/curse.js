let mods_lock;
function main() {
	const { http, https } = require('follow-redirects');
	const fs = require("fs");
	let downloadStarted = false;
	let dep = new Map();
	mods_lock = new Map(Object.entries(mods_lock));
	global.config.mods.curse.forEach(mod => {
		getData(`search?categoryId=0&gameId=432&gameVersion=${encodeURI(global.config.gameVersion)}&index=0&pageSize=1&searchFilter=${encodeURI(mod)}&sectionId=6&sort=0`, (result) => { // resolve projectID
			resolveDep(result[0].id, downloadMods);
		});
	});

	var resolveDepRecursionCount = [];
	function resolveDep(modId, callback, index) {
		if(index === undefined) index = resolveDepRecursionCount.push(0) - 1;
		++resolveDepRecursionCount[index];
		getData(`${modId}/files`, (files) => {
			let rightVersion;
			for(let i = files.length - 1; i >= 0; --i) {
				let versionArray = files[i].gameVersion;
				if(versionMatch(versionArray, global.config.gameVersion) && (versionMatch(versionArray, global.config.modloader) || modloaderMatch(versionArray, global.config.modloader))) {
					rightVersion = files[i];
				}
			}
			dep.set(String(modId), {fileId: rightVersion.id, url: rightVersion.downloadUrl, filename: rightVersion.fileName});
			rightVersion.dependencies.forEach(mod => {
				if(mod.type !== 3) return
				resolveDep(mod.addonId, callback, index);
			});
			--resolveDepRecursionCount[index];
			if(resolveDepRecursionCount[index] == 0) callback();
		});
	}

	function getData(url, callback) {
		https.get(`https://addons-ecs.forgesvc.net/api/v2/addon/${url}`, (resp) => {
			let data = '';
			resp.on('data', (chunk) => {
				data += chunk;
			});
			resp.on("end", () => {
				callback(JSON.parse(data));
			});
		});
	}

	function versionMatch(versionArray, gameVersion) {
		let gameVersionMatch = false;
		versionArray.forEach(version => {
			gameVersionMatch = gameVersionMatch || version == gameVersion;
		});
		return gameVersionMatch;
	}

	function modloaderMatch(versionArray, modloaderVersion) {
		for(let i = 0; i < versionArray.length; ++i) {
			if(/^[a-zA-Z]+$/.test(versionArray[i]) && versionArray[i] != modloaderVersion) return false;
		}
		return true;
	}

	function downloadMods() {
		if(!downloadStarted) {
			downloadStarted = true;
			globCallback(Object.fromEntries(dep));
			dep.forEach((mod, modId) => {
					let path = getPath(mod)
					if(mods_lock.has(modId)) {
						if(mods_lock.get(modId).fileId === mod.fileId) return;
						fs.unlink(path, () => {});
					}
					downloadFile(mod.url, path);
			});
			mods_lock.forEach((mod, modId) => {
				if(!dep.has(modId)) fs.unlink(getPath(mod), () => {})
			});
		}
	}
	function getPath(mod) {
		return `mods/${mod.filename}`
	}

	function downloadFile(url, dest) {
		let file = fs.createWriteStream(dest);
		console.log(`downloading ${url}`);
		let request = https.get(url, (response) => {
			// check if response is success
			if (response.statusCode !== 200) {
				throw response.statusCode;
			}

			response.pipe(file);
		});

		// close() is async, call cb after close completes
		file.on('finish', () => file.close());

		// check for request error too
		request.on('error', (err) => {
			fs.unlink(dest, () => {});
			throw err;
		});

		file.on('error', (err) => { // Handle errors
			fs.unlink(dest);
			throw err;
		});
	}
}
module.exports = function(mods_lock_p, callback) {
	mods_lock = mods_lock_p;
	globCallback = callback;
	main();
};
