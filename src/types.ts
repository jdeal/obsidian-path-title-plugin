export interface PathSettings {
	type: string;
	match: string;
	replace: string;
}

export interface PathTitlePluginSettings {
	position: string;
	fontSize: string;
	borderSize: string;
	pathSettings: Array<PathSettings>;
}
