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
let save_mods_lock = {};
const modLockPath = "mods-lock.json";
let modsLock;
try {
	modsLock = JSON.parse(fs.readFileSync(modLockPath, "utf-8"));
}
catch(err) {
	if(err.errno !== -2) throw err;
	modsLock = {curse: new Map()};
}
const numberCallback = 1;
let callbackCounter = 0;
require("./curse.js")(modsLock.curse, finnish);

function finnish(curse) {
	save_mods_lock.curse = curse;
	if(++callbackCounter == numberCallback) {
		fs.writeFile(modLockPath, JSON.stringify(save_mods_lock), (err) => {
			if(err) throw err;
		});
	}
}
