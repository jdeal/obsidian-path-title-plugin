export interface PathSettings {
	type: string;
	match: string;
	replace: string;
}

export interface PathTitlePluginSettings {
	fontSize: string;
	pathSettings: Array<PathSettings>;
}
