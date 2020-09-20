const { http, https } = require('follow-redirects');
const jsonMinify = require("node-json-minify");
const fs = require("fs");
let dep = new Map();
let config;
let downloadStarted = false;
switch(process.argv.length) {
	case 3:
		process.chdir(process.argv[2]);
	case 2:
		config = JSON.parse(jsonMinify(fs.readFileSync("mods.json", "utf-8")));
		break;
	default:
		throw "unexpected argument";
}
config.mods.curse.forEach(mod => {
	getData(`search?categoryId=0&gameId=432&gameVersion=${encodeURI(config.gameVersion)}&index=0&pageSize=15&searchFilter=${encodeURI(mod)}&sectionId=6&sort=2`, (result) => { // resolve projectID
		resolveDep(result[0].id, function(){
			for(const modFile of dep) {
				if(mods_lock !== undefined) downloadMods();
				let waitModsLock = setInterval(function() {
					if(mods_lock !== undefined) {
						clearInterval(waitModsLock);
						downloadMods();
					}
				}, 1);
			}
		});
	});
});
let mods_lock;
fs.readFile("mods-lock.json", "utf-8", (err, data) => {
	if(err) {
		if(err.errno == -2) mods_lock = new Map();
		else throw err;
	}
	else mods_lock = new Map(Objects.entries(JSON.parse(data)));
});

var resolveDepRecursionCount = [];
function resolveDep(modId, callback, index) {
	if(index === undefined) index = resolveDepRecursionCount.push(0) - 1;
	++resolveDepRecursionCount[index];
	getData(`${modId}/files`, (files) => {
		let rightVersion;
		for(let i = files.length - 1; i >= 0; --i) {
			let versionArray = files[i].gameVersion;
			if(versionMatch(versionArray, config.gameVersion) && (versionMatch(versionArray, config.modloader) || modloaderMatch(versionArray, config.modloader))) {
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
		dep.forEach((mod, modId) => {
			if(mods_lock.has(modId)) {
				console.log(3)
				if(mods_lock.get(mod.fileId) === mod.fileId) return;
				fs.unlink(modId + " " + mods_lock.get(mod.fileId + ".jar"));
			}
			downloadFile(mod.url, "mods/" + modId + " " + mod.fileId + ".jar");
		});
	}
}

function downloadFile(url, dest) {
	let file = fs.createWriteStream(dest);
	console.log(url);
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
