import { PathSettings } from "./types";

export function escapeForRegExp(text: string) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

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
				const re = new RegExp(pathSettings.match, "g");
				return currentPath.replace(re, pathSettings.replace);
			}
			if (pathSettings.type === "folder") {
				const matchFolder = escapeForRegExp(pathSettings.match);
				const replacementFolder = pathSettings.replace.replace(
					"$",
					"$$"
				);
				return currentPath.replace(
					new RegExp(`(^|/)${matchFolder}($|/)`, "g"),
					`$1${replacementFolder}$2`
				);
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

export function arrayToChoices(array: Array<string>) {
	return array.reduce((result, item) => {
		result[item] = item;
		return result;
	}, {} as Record<string, string>);
}
