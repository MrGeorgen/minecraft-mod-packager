import git from "gift";
import childProcess from "child_process";
import fs from "fs";
import g2js from "gradle-to-js/lib/parser";
import {modBase, config} from "./modBase";
interface modLockElement {
	commitId: string;
	url: string;
	filename: string;
}
type modLockMap = Map<string, modLockElement>;
interface commit {
	id: string;
}
class gitMods extends modBase {
	private loopCounter: number = 0;
	constructor(private modsLock: modLockMap, config: config, callback: Function) {
		super(config, callback);
		let deleteMods: modLockMap = new Map(this.modsLock);
		let cacheDir = process.env.XDG_CACHE_HOME;
		if(cacheDir == null) cacheDir = `${process.env.HOME}/.cache`;
		let repoPathRoot = `${cacheDir}/minecraft-mod-packager`;
		config.mods.git.forEach((gitRepo) => {
			++this.loopCounter;
			deleteMods.delete(gitRepo.url);
			let repoPath = `${repoPathRoot}/${gitRepo.url.replace("://", "+")}/${gitRepo.branch}`;
			fs.access(repoPath, (err) => {
				if(err) {
					if(err.code !== "ENOENT") throw err;
					console.log(`cloning git repo ${gitRepo.url}`);
					git.clone(gitRepo.url, repoPath, undefined, gitRepo.branch, (err: Error, repo) => {
						if(err) throw err;
						this.build(repo, repoPath, gitRepo);
					});
				}
				else {
					let repo = git(repoPath);
					console.log(`pulling git repo ${gitRepo.url}`);
					repo.pull(["origin"], gitRepo.branch, (err: Error) => {
						if(err) throw err;
						this.build(repo, repoPath, gitRepo);
					});
				}
			});
		});
		deleteMods.forEach((mod, url) => {
			this.modsLock.delete(url);
			fs.unlink(this.modPath(mod), (err) => {
				if(err) throw err;
			});
		});
		this.mayCb();
	}

	private build(repo, repoPath, gitRepo):void {
		let newLock: modLockElement;
		newLock = this.modsLock.get(gitRepo.url) ?? {} as modLockElement;
		this.modsLock.set(gitRepo.url, newLock);
		repo.current_commit((err: Error, commit: commit) => {
			if(err) throw err;
			if(commit.id === newLock.commitId) this.cbDecrease();
			else {
				newLock.commitId = commit.id;
				console.log(`buidling ${gitRepo.url}`);
				childProcess.execFile("gradle", ["build"], {cwd: repoPath}, (err) => {
					if(err) throw err;
					let buildPath = `${repoPath}/build/libs`;
					fs.readFile(`${repoPath}/gradle.properties`, "utf-8", (err, data) => {
						if(err) throw err;
						g2js.parseText(data).then((gradleProp) => {
							if(newLock.filename != null) fs.unlink(this.modPath(newLock), (err) => {
								if(err) throw err;
							});
							newLock.filename = `${gradleProp.archives_base_name}-${gradleProp.mod_version}.jar`;
							fs.copyFile(`${buildPath}/${newLock.filename}`, this.modPath(newLock), (err) => {
								if(err) throw err;
							});
							this.cbDecrease();
						});
					});
				});
			}
		});
	}

	private cbDecrease():void {
		--this.loopCounter;
		this.mayCb();
	}

	private mayCb():void {
		if(this.loopCounter <= 0) this.callback("git", Object.fromEntries(this.modsLock));
	}
}
export = gitMods;
