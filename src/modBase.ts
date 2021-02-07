export interface config {
	gameVersion: string;
	modloader: string;
	mods: {
		curse: Array<string>;
		git: Array<{
			url: string;
			branch: string;
		}>
	}
}
export class modBase {
	constructor(protected config: config, protected callback: Function) {
	}
	protected modPath(mod: any) {
		return `mods/${mod.filename}`;
	}
}
