const { http, https } = require('follow-redirects');
const fs = require("fs");
let downloadStarted = false;
let mods_lock;
let dep = new Map();
try {
	mods_lock = new Map(Object.entries(mods_lock));
} catch {
	mods_lock = new Map;
}
global.config.mods.curse.forEach(mod => {
	getData(`search?categoryId=0&gameId=432&gameVersion=${encodeURI(global.config.gameVersion)}&index=0&pageSize=15&searchFilter=${encodeURI(mod)}&sectionId=6&sort=2`, (result) => { // resolve projectID
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
				dep.set(modId, {fileId: rightVersion.id, url: rightVersion.downloadUrl});
			}
		}
		rightVersion.dependencies.forEach(mod => {
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
	versionArray.forEach(version => {
		if(/^[a-zA-Z]+$/.test(version) && version != modloaderVersion) return false;
		return true;
	});
}

function downloadMods() {
	if(!downloadStarted) {
		downloadStarted = true;
		save_mods_lock = Object.fromEntries(dep);
		globCallback();
		dep.forEach((mod, modId) => {
			getData(modId, (data) => {
				let path = `mods/${data.name}.jar`
				if(mods_lock.has(String(modId))) {
					if(mods_lock.get(String(modId)).fileId === mod.fileId) return;
					fs.unlink(path);
				}
				downloadFile(mod.url, path);
			});
		});
	}
}

function downloadFile(url, dest) {
	let file = fs.createWriteStream(dest);
	console.log(`downloading... ${url}`);
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
		fs.unlink(dest);
		throw err;
	});

	file.on('error', (err) => { // Handle errors
		fs.unlink(dest);
		throw err;
	});
}
module.exports = function(saved_mods_lock, mods_lock_p, callback) {
	var save_mods_lock = saved_mods_lock;
	var mods_lock = mods_lock_p;
	globCallback = callback;
};
