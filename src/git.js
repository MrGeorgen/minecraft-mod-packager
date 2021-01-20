const git = require("gift");
const glob = require("glob");
const childProcess = require("child_process");
const fs = require("fs");
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
	deleteMods.forEach((mod) => {
		fs.unlink(mod.filename, (err) => {
			if(err) throw err;
		});
	});
}

function build(repo, repoPath, gitRepo) {
	if(modsLock.has(gitRepo.url)) newLock = modsLock.get(gitRepo.url);
	else {
		newLock = {};
		modsLock.set(gitRepo.url, newLock);
	}
	repo.current_commit((err, commit) => {
		if(err) throw err;
		if(commit.id === newLock.commitId) mayCb();
		else {
			newLock.commitId = commit.id;
			childProcess.execFile("gradle", ["build"], {cwd: repoPath}, (err) => {
				if(err) throw err;
				let buildPath = `${repoPath}/build/libs`;
				glob(gitRepo.fileMatch, {cwd: buildPath}, (err, files) => {
					if(err) throw err;
					if(files.length !== 1) throw `mod glob matched multiple or no files. mod:\n${JSON.stringify(gitRepo)}`;
					modFile = files[0];
					if(newLock.filename != null) fs.unlink(`mods/${newLock.filename}`, (err) => {
						if(err) throw err;
					});
					mayCb();
					fs.copyFile(`${buildPath}/${modFile}`, `mods/${modFile}`, (err) => {
						if(err) throw err;
					});
					newLock.filename = modFile;
				});
			});
		}
	});
}

function mayCb() {
	if(--loopCounter === 0) globCallback("git", Object.fromEntries(modsLock));
}

module.exports = (mods_lock_p, cb) => {
	globCallback = cb;
	modsLock = mods_lock_p;
	main()
}
