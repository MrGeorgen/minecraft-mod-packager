import jsonMinify from "node-json-minify";
import fs from "fs";
import {config} from "./modBase";
import curse from "./curse";
import git from "./git";
let config: config;
let modules = ["curse", "git"];
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
	modsLock = {};
}
const numberCallback = modules.length;
let callbackCounter = 0;
new git(new Map(Object.entries(modsLock.git ?? {})), config, finnish);
new curse(new Map(Object.entries(modsLock.curse ?? {})), config, finnish);

function finnish(name: string, data) {
	save_mods_lock[name] = data;
	if(++callbackCounter == numberCallback) {
		fs.writeFile(modLockPath, JSON.stringify(save_mods_lock), (err) => {
			if(err) throw err;
		});
	}
}
