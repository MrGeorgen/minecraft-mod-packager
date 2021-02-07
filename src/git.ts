import git from "gift";
import childProcess from "child_process";
import fs from "fs";
import g2js from "gradle-to-js/lib/parser";
interface modLockElement {
	commitId: string;
	url: string;
	filename: string;
}
type modLockMap = Map<string, modLockElement>;
interface commit {
	id: string;
}
let modsLock: modLockMap;
let globCallback: Function;
let loopCounter: number = 0;
let config;
function main () {
	modsLock = new Map(Object.entries(modsLock));
	let deleteMods: modLockMap = new Map(modsLock);
	let cacheDir = process.env.XDG_CACHE_HOME;
	if(cacheDir == null) cacheDir = `${process.env.HOME}/.cache`;
	let repoPathRoot = `${cacheDir}/minecraft-mod-packager`;
	config.mods.git.forEach((gitRepo) => {
		++loopCounter;
		deleteMods.delete(gitRepo.url);
		let repoPath = `${repoPathRoot}/${gitRepo.url.replace("://", "+")}/${gitRepo.branch}`;
		fs.access(repoPath, (err) => {
			if(err) {
				if(err.code !== "ENOENT") throw err;
				console.log(`cloning git repo ${gitRepo.url}`);
				git.clone(gitRepo.url, repoPath, undefined, gitRepo.branch, (err: Error, repo) => {
					if(err) throw err;
					build(repo, repoPath, gitRepo);
				});
			}
			else {
				let repo = git(repoPath);
				console.log(`pulling git repo ${gitRepo.url}`);
				repo.pull(["origin"], gitRepo.branch, (err: Error) => {
					if(err) throw err;
					build(repo, repoPath, gitRepo);
				});
			}
		});
	});
	deleteMods.forEach((mod, url) => {
		modsLock.delete(url);
		fs.unlink(modPath(mod), (err) => {
			if(err) throw err;
		});
	});
	mayCb();
}

function build(repo, repoPath, gitRepo):void {
	let newLock: modLockElement;
	newLock = modsLock.get(gitRepo.url) ?? {} as modLockElement;
	modsLock.set(gitRepo.url, newLock);
	repo.current_commit((err: Error, commit: commit) => {
		if(err) throw err;
		if(commit.id === newLock.commitId) cbDecrease();
		else {
			newLock.commitId = commit.id;
			console.log(`buidling ${gitRepo.url}`);
			childProcess.execFile("gradle", ["build"], {cwd: repoPath}, (err) => {
				if(err) throw err;
				let buildPath = `${repoPath}/build/libs`;
				fs.readFile(`${repoPath}/gradle.properties`, "utf-8", (err, data) => {
					if(err) throw err;
					g2js.parseText(data).then((gradleProp) => {
						if(newLock.filename != null) fs.unlink(modPath(newLock), (err) => {
							if(err) throw err;
						});
						newLock.filename = `${gradleProp.archives_base_name}-${gradleProp.mod_version}.jar`;
						fs.copyFile(`${buildPath}/${newLock.filename}`, modPath(newLock), (err) => {
							if(err) throw err;
						});
						cbDecrease();
					});
				});
			});
		}
	});
}

function cbDecrease():void {
	--loopCounter;
	mayCb();
}

function mayCb():void {
	if(loopCounter <= 0) globCallback("git", Object.fromEntries(modsLock));
}

module.exports = (mods_lock_p, _config, cb) => {
	globCallback = cb;
	modsLock = mods_lock_p;
	config = _config;
	main()
}
