const jsonMinify = require("node-json-minify");
const fs = require("fs");
let config;
switch(process.argv.length) {
	case 3:
		process.chdir(process.argv[2]);
	case 2:
		config = JSON.parse(jsonMinify(fs.readFileSync("mods.json", "utf-8")));
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
	modsLock = {curse: {}, git: {}};
}
const numberCallback = 2;
let callbackCounter = 0;
require("./curse")(modsLock.curse, config, finnish);
require("./git.js")(modsLock.git, config, finnish);

function finnish(name, data) {
	save_mods_lock[name] = data;
	if(++callbackCounter == numberCallback) {
		fs.writeFile(modLockPath, JSON.stringify(save_mods_lock), (err) => {
			if(err) throw err;
		});
	}
}
