import { https } from "follow-redirects";
import fs from "fs";
import {modBase, config} from "./modBase";
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
class curse extends modBase {
	private dep: modLockMap = new Map();
	private downloadStarted: boolean = false;
	constructor(private modsLock: modLockMap, config: config, callback: Function) {
		super(config, callback);
		if(config.mods.curse.length === 0) callback("curse", {});
		config.mods.curse.forEach((mod: string) => {
			this.getData(`search?categoryId=0&gameId=432&gameVersion=${encodeURI(config.gameVersion)}&index=0&pageSize=15&searchFilter=${encodeURI(mod)}&sectionId=6&sort=0`, (result: Array<any>) => { // resolve projectID
				let i = 0;
				while(result[i].name !== mod) {
					++i;
					if(i === result.length) {
						console.log(`cursemod ${mod} not found`);
						return;
					}
				}
				this.resolveDep(result[i].id, () => {
					this.downloadMods();
				});
			});
		});
	}

	private resolveDepRecursionCount = 0;
	private resolveDep(modId: number, callback: Function):void {
		++this.resolveDepRecursionCount;
		this.getData(`${modId}/files`, (files: Array<any>) => {
			let rightVersion;
			for(let i = files.length - 1; i >= 0; --i) {
				let versionArray = files[i].gameVersion;
				if(this.versionMatch(versionArray, this.config.gameVersion) && (this.versionMatch(versionArray, this.config.modloader) || this.modloaderMatch(versionArray, this.config.modloader))) {
					rightVersion = files[i];
				}
			}
			if(rightVersion === undefined) {
				this.getData(String(modId), (mod: any) => {
					console.log(`cursemod ${mod.name}: no version for the correct minecraft version and modloader found`);
				});
				return;
			}
			this.dep.set(String(modId), {fileId: rightVersion.id, url: rightVersion.downloadUrl, filename: rightVersion.fileName});
			rightVersion.dependencies.forEach((mod: Dependency) => {
				if(mod.type !== 3) return;
				this.resolveDep(mod.addonId, callback);
			});
			--this.resolveDepRecursionCount;
			if(this.resolveDepRecursionCount == 0) callback();
		});
	}

	private getData(url: string, callback: Function):void {
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

	versionMatch(versionArray, gameVersion):boolean {
		let gameVersionMatch = false;
		versionArray.forEach(version => {
			gameVersionMatch = gameVersionMatch || version == gameVersion;
		});
		return gameVersionMatch;
	}

	private modloaderMatch(versionArray: Array<string>, modloaderVersion: string):boolean {
		for(let i = 0; i < versionArray.length; ++i) {
			if(/^[a-zA-Z]+$/.test(versionArray[i]) && versionArray[i] != modloaderVersion) return false;
		}
		return true;
	}

	private downloadMods():void {
		if(!this.downloadStarted) {
			this.downloadStarted = true;
			this.callback("curse", Object.fromEntries(this.dep));
			this.dep.forEach((mod: modLockElement, modId: string) => {
				let path = this.modPath(mod)
				if(this.modsLock.has(modId)) {
					if(this.modsLock.get(modId)!.fileId === mod.fileId) return;
					fs.unlink(path, () => {});
				}
				this.downloadFile(mod.url, path);
			});
			this.modsLock.forEach((mod: modLockElement, modId: string) => {
				if(!this.dep.has(modId)) fs.unlink(this.modPath(mod), () => {})
			});
		}
	}

	private downloadFile(url: string, dest: string):void {
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
}

export = curse;
