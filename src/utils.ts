import { PathSettings } from "./types";

// For a given path, loop through all path settings and apply replacements.
export function applyPathSettings(
	allPathSettings: Array<PathSettings>,
	path: string
) {
	return allPathSettings.reduce((currentPath, pathSettings) => {
		if (pathSettings.match) {
			if (
				pathSettings.type === "regexp" ||
				pathSettings.type === "fuzzy"
			) {
				const re = new RegExp(pathSettings.match, "gu");
				return currentPath.replace(re, pathSettings.replace);
			}
			if (pathSettings.type === "folder") {
				return currentPath
					.split("/")
					.map((folder) => {
						if (folder === pathSettings.match) {
							return pathSettings.replace;
						}
						return folder;
					})
					.join("/");
			}
			if (pathSettings.type === "exact") {
				if (currentPath === pathSettings.match) {
					return pathSettings.replace;
				}
			}
			if (pathSettings.type === "text") {
				return currentPath.replace(
					pathSettings.match,
					pathSettings.replace
				);
			}
		}
		return currentPath;
	}, path);
}

// Get unique folder names from a list of paths
// I.e. ['a', 'a/b'] would return ['a', 'b']
export function getAllFolderNames(folderPaths: string[]) {
	const folderNameSet = folderPaths.reduce((result, path) => {
		if (path !== "/") {
			for (const folderName of path.split("/")) {
				result.add(folderName);
			}
		}
		return result;
	}, new Set<string>());
	return Array.from(folderNameSet);
}

// Convert an array of values to a map used for dropdown choices
export function arrayToChoices(array: Array<string>) {
	return array.reduce((result, item) => {
		result[item] = item;
		return result;
	}, {} as Record<string, string>);
}

export function escapeQuotes(s: string) {
	return s.replace('"', '\\"');
}

export function escapeSlashes(s: string) {
	return s.replace("/", "\\/");
}
