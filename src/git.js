const git = require("gift");
const childProcess = require("child_process");
const fs = require("fs");
const g2js = require('gradle-to-js/lib/parser');
let modsLock;
let globCallback;
let loopCounter = 0;
function main () {
	modsLock = new Map(Object.entries(modsLock));
	let deleteMods = new Map(modsLock);
	let cacheDir = process.env.XDG_CACHE_HOME;
	if(cacheDir == null) cacheDir = `${process.env.HOME}/.cache`;
	let repoPathRoot = `${cacheDir}/minecraft-mod-packager`;
	global.config.mods.git.forEach((gitRepo) => {
		++loopCounter;
		deleteMods.delete(gitRepo.url);
		let repoPath = `${repoPathRoot}/${gitRepo.url.replace("://", "+")}/${gitRepo.branch}`;
		fs.access(repoPath, (err) => {
			if(err) {
				if(err.code !== "ENOENT") throw err;
				git.clone(gitRepo.url, repoPath, undefined, gitRepo.branch, (err, repo) => {
					if(err) throw err;
					build(repo, repoPath, gitRepo);
				});
			}
			else {
				let repo = git(repoPath);
				repo.pull(["origin"], gitRepo.branch, (err) => {
					if(err) throw err;
					build(repo, repoPath, gitRepo);
				});
			}
		});
	});
	deleteMods.forEach((mod, url) => {
		modsLock.delete(url);
		fs.unlink(modPath(mod.filename), (err) => {
			if(err) throw err;
		});
	});
	mayCb();
}

function build(repo, repoPath, gitRepo) {
	if(modsLock.has(gitRepo.url)) newLock = modsLock.get(gitRepo.url);
	else {
		newLock = {};
		modsLock.set(gitRepo.url, newLock);
	}
	repo.current_commit((err, commit) => {
		if(err) throw err;
		if(commit.id === newLock.commitId) cbDecrease();
		else {
			newLock.commitId = commit.id;
			childProcess.execFile("gradle", ["build"], {cwd: repoPath}, (err) => {
				if(err) throw err;
				let buildPath = `${repoPath}/build/libs`;
				fs.readFile(`${repoPath}/gradle.properties`, "utf-8", (err, data) => {
					if(err) throw err;
					g2js.parseText(data).then((gradleProp) => {
						let modFile = `${gradleProp.archives_base_name}-${gradleProp.mod_version}.jar`;
						if(newLock.filename != null) fs.unlink(`mods/${newLock.filename}`, (err) => {
							if(err) throw err;
						});
						fs.copyFile(`${buildPath}/${modFile}`, `mods/${modFile}`, (err) => {
							if(err) throw err;
						});
						newLock.filename = modFile;
						cbDecrease();
					});
				});
			});
		}
	});
}

function cbDecrease() {
	--loopCounter;
	mayCb();
}

function mayCb() {
	if(loopCounter <= 0) globCallback("git", Object.fromEntries(modsLock));
}

function modPath(filename) {
	return `mods/${filename}`;
}

module.exports = (mods_lock_p, cb) => {
	globCallback = cb;
	modsLock = mods_lock_p;
	main()
}
