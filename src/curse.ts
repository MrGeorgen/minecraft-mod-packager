import { https } from "follow-redirects";
import fs from "fs";
interface modLockElement {
	fileId: number;
	url: string;
	filename: string;
}
type modLockMap = Map<string, modLockElement>;
interface Dependency {
	readonly addonId: number;
	readonly type: number;
}
let mods_lock: modLockMap;
let downloadStarted: boolean = false;
let globCallback;
let config;
let dep: modLockMap = new Map();
function main() {
	mods_lock = new Map(Object.entries(mods_lock));
	if(config.mods.curse.length === 0) globCallback("curse", {});
	config.mods.curse.forEach((mod: string) => {
		getData(`search?categoryId=0&gameId=432&gameVersion=${encodeURI(config.gameVersion)}&index=0&pageSize=15&searchFilter=${encodeURI(mod)}&sectionId=6&sort=0`, (result: Array<any>) => { // resolve projectID
			let i = 0;
			while(result[i].name !== mod) {
				++i;
				if(i === result.length) {
					console.log(`cursemod ${mod} not found`);
					return;
				}
			}
			resolveDep(result[i].id, downloadMods);
		});
	});
}

var resolveDepRecursionCount = 0;
function resolveDep(modId: number, callback: Function) {
	++resolveDepRecursionCount;
	getData(`${modId}/files`, (files: Array<any>) => {
		let rightVersion: any;
		for(let i = files.length - 1; i >= 0; --i) {
			let versionArray = files[i].gameVersion;
			if(versionMatch(versionArray, config.gameVersion) && (versionMatch(versionArray, config.modloader) || modloaderMatch(versionArray, config.modloader))) {
				rightVersion = files[i];
			}
		}
		if(rightVersion === undefined) {
			getData(String(modId), (mod: any) => {
				console.log(`cursemod ${mod.name}: no version for the correct minecraft version and modloader found`);
			});
			return;
		}
		dep.set(String(modId), {fileId: rightVersion.id, url: rightVersion.downloadUrl, filename: rightVersion.fileName});
		rightVersion.dependencies.forEach((mod: Dependency) => {
			if(mod.type !== 3) return;
			resolveDep(mod.addonId, callback);
		});
		--resolveDepRecursionCount;
		if(resolveDepRecursionCount == 0) callback();
	});
}

function getData(url: string, callback: Function) {
	https.get(`https://addons-ecs.forgesvc.net/api/v2/addon/${url}`, (resp) => {
		let data: string = '';
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
		globCallback("curse", Object.fromEntries(dep));
		dep.forEach((mod: modLockElement, modId: string) => {
			let path = modPath(mod)
			if(mods_lock.has(modId)) {
				if(mods_lock.get(modId)!.fileId === mod.fileId) return;
				fs.unlink(path, () => {});
			}
			downloadFile(mod.url, path);
		});
		mods_lock.forEach((mod: modLockElement, modId: string) => {
			if(!dep.has(modId)) fs.unlink(modPath(mod), () => {})
		});
	}
}

function downloadFile(url: string, dest: string) {
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
	request.on('error', (err: Error) => {
		fs.unlink(dest, () => {});
		throw err;
	});

	file.on('error', (err: Error) => { // Handle errors
		fs.unlink(dest, () => {});
		throw err;
	});
}

module.exports = function(mods_lock_p, _config, callback) {
	mods_lock = mods_lock_p;
	globCallback = callback;
	config = _config;
	main();
};
