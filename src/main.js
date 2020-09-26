const jsonMinify = require("node-json-minify");
const fs = require("fs");
switch(process.argv.length) {
	case 3:
		process.chdir(process.argv[2]);
	case 2:
		global.config = JSON.parse(jsonMinify(fs.readFileSync("mods.json", "utf-8")));
		break;
	default:
		throw "unexpected argument";
}
const modLockPath = "mods-lock.json";
let save_mods_lock = {};
let modsLock = JSON.parse(fs.readFileSync(modLockPath, "utf-8"));
const numberCallback = 2;
let callbackCounter = 0;
require("./curse.js")(save_mods_lock.curse, modsLock.curse, finnish);

function finnish() {
	if(++callbackCounter == numberCallback) {
		fs.writeFile(modLockPath, JSON.stringify(save_mods_lock), (err) => {
			if(err) throw err;
		});
	}
}
