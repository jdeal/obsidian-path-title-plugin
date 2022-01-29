import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	FileView,
	Vault,
	TFolder,
} from "obsidian";

interface PathSettings {
	type: string;
	match: string;
	replace: string;
}

interface PathTitlePluginSettings {
	position: string;
	fontSize: string;
	borderSize: string;
	regexMatch: string;
	regexReplace: string;
	// maxSize: number;
	// showEllipsis: boolean;
	pathMappings: Array<Array<string>>;
	pathSettings: Array<PathSettings>;
}

const DEFAULT_SETTINGS: PathTitlePluginSettings = {
	position: "before",
	fontSize: "medium",
	borderSize: "1px",
	regexMatch: "",
	regexReplace: "",
	// maxSize: Infinity,
	// showEllipsis: true,
	pathMappings: [],
	pathSettings: [],
};

function getFolderPaths(app: App) {
	const folders: Array<string> = [];

	Vault.recurseChildren(app.vault.getRoot(), (f) => {
		if (f instanceof TFolder) {
			folders.push(f.path);
		}
	});

	folders.sort();

	return folders;
}

function getAllFolderNames(folderPaths: string[]) {
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

function arrayToChoices(array: Array<string>) {
	return array.reduce((result, item) => {
		result[item] = item;
		return result;
	}, {} as Record<string, string>);
}

function getMatch(s: string, re: RegExp) {
	const match = s.match(re);
	if (match) {
		return match[0];
	}
	return "";
}

function escapeForRegExp(text: string) {
	return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

function applyPathSettings(allPathSettings: Array<PathSettings>, path: string) {
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

export default class PathTitlePlugin extends Plugin {
	settings: PathTitlePluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new PathTitleSettingTab(this.app, this));

		this.app.workspace.on("file-open", () => {
			this.setPaneTitles();
		});

		this.setPaneTitles();

		this.app.vault.on("rename", () => {
			this.setPaneTitles();
		});
	}

	setPaneTitles() {
		const pathMappings = this.settings.pathMappings.reduce(
			(result, mapping) => {
				result[mapping[0]] = mapping[1];
				return result;
			},
			{} as Record<string, string>
		);

		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof FileView) {
				const fileView = leaf.view as FileView;
				const path = fileView.file.parent
					? fileView.file.parent.path
					: "";
				const replacedPath = applyPathSettings(
					this.settings.pathSettings,
					path
				);

				if (replacedPath) {
					leaf.view.containerEl.style.setProperty(
						"--path-title-plugin-border-size",
						this.settings.borderSize || DEFAULT_SETTINGS.borderSize
					);
					if (this.settings.borderSize === "0px") {
						leaf.view.containerEl.style.setProperty(
							"--path-title-plugin-padding-size",
							"0px"
						);
					} else {
						leaf.view.containerEl.style.setProperty(
							"--path-title-plugin-padding-size",
							"2px"
						);
					}
					leaf.view.containerEl.style.setProperty(
						"--path-title-plugin-font-size",
						this.settings.fontSize || DEFAULT_SETTINGS.fontSize
					);
					leaf.view.containerEl.addClass(
						"path-title-plugin-has-path"
					);
					if (this.settings.position === "after") {
						leaf.view.containerEl.style.setProperty(
							"--path-title-plugin-title-after",
							`'${replacedPath}'`
						);
						leaf.view.containerEl.style.removeProperty(
							"--path-title-plugin-title-before"
						);
					} else {
						leaf.view.containerEl.style.setProperty(
							"--path-title-plugin-title-before",
							`'${replacedPath}'`
						);
						leaf.view.containerEl.style.removeProperty(
							"--path-title-plugin-title-after"
						);
					}
				} else {
					leaf.view.containerEl.style.removeProperty(
						"--path-title-plugin-title-before"
					);
					leaf.view.containerEl.style.removeProperty(
						"--path-title-plugin-title-after"
					);
					leaf.view.containerEl.style.removeProperty(
						"--path-title-plugin-border-size"
					);
					leaf.view.containerEl.style.removeProperty(
						"--path-title-plugin-padding-size"
					);
					leaf.view.containerEl.style.removeProperty(
						"--path-title-plugin-font-size"
					);
				}
			}
		});
	}

	onunload() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof FileView) {
				leaf.view.containerEl.style.removeProperty(
					"--path-title-plugin-title-before"
				);
				leaf.view.containerEl.style.removeProperty(
					"--path-title-plugin-title-after"
				);
				leaf.view.containerEl.removeClass("path-title-plugin-has-path");
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
		// if (!this.settings.maxSize) {
		// 	this.settings.maxSize = Infinity;
		// }
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.setPaneTitles();
	}
}

function escapeQuotes(s: string) {
	return s.replace('"', '\\"');
}

function escapeSlashes(s: string) {
	return s.replace("/", "\\/");
}

const replacementTypeToUi: {
	[key: string]: {
		heading: (match: string) => string;
		matchName: string;
		matchDesc: string;
		replaceName: string;
		replaceDesc: string;
	};
} = {
	exact: {
		heading: (match) =>
			`Path exactly matches "${escapeSlashes(escapeQuotes(match))}"`,
		matchName: "Matching Path",
		matchDesc: "Exact path that will be replaced",
		replaceName: "Replacement Path",
		replaceDesc: "Path that will replace matching path",
	},
	folder: {
		heading: (match) =>
			`Folder in path exactly matches "${escapeQuotes(match)}"`,
		matchName: "Matching Folder",
		matchDesc: "Exact folder in path that will be replaced",
		replaceName: "Replacement Folder",
		replaceDesc: "Folder that will replace matching folder",
	},
	text: {
		heading: (match) =>
			`Text anywhere in path matches "${escapeQuotes(match)}"`,
		matchName: "Matching Text",
		matchDesc: "Text anywhere in path that will be replaced",
		replaceName: "Replacement Text",
		replaceDesc: "Text that will replace matching text",
	},
	regexp: {
		heading: (match) =>
			`Path matches regular expression /${escapeForRegExp(match).replace(
				"/",
				"\\/"
			)}/`,
		matchName: "Matching Regular Expression",
		matchDesc:
			"Regular expression to match part of path (or full path) that will be replaced",
		replaceName: "Replacement Text",
		replaceDesc:
			"Text that will replace the text that matches the regular expression, can use $1, $2, etc. for groups found in match",
	},
};

class PathTitleSettingTab extends PluginSettingTab {
	plugin: PathTitlePlugin;

	constructor(app: App, plugin: PathTitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {}, (el) => {
			el.setText("General Settings");
		});

		new Setting(containerEl)
			.setName("Path Position")
			.setDesc(
				"Where the path is displayed: before or after the filename"
			)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						before: "Before",
						after: "After",
					})
					.setValue(this.plugin.settings.position)
					.onChange(async (value) => {
						this.plugin.settings.position = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Path Font Size")
			.setDesc(`Font size of the path`)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						"100%": "Large",
						"75%": "Medium",
						"63%": "Small",
					})
					.setValue(
						this.plugin.settings.fontSize ||
							DEFAULT_SETTINGS.fontSize
					)
					.onChange(async (value) => {
						this.plugin.settings.fontSize = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Path Border")
			.setDesc(`Whether or not the path has a border`)
			.addDropdown((dropdown) => {
				dropdown
					.addOptions({
						"1px": "Border",
						"0px": "No Border",
					})
					.setValue(this.plugin.settings.borderSize)
					.onChange(async (value) => {
						this.plugin.settings.borderSize = value;
						await this.plugin.saveSettings();
					});
			});

		let currentSelectedMappingPath = "";
		let currentSelectedMappingFolder = "";
		const regexOption = ":/regex/:";

		containerEl.createEl("h2", {}, (el) => {
			el.setText("Path Replacement Settings");
		});

		new Setting(containerEl)
			.setName("Exact Path Replacement")
			.setDesc(
				`Select one of your folders, and click the "+" button to add an exact path replacement for that path below`
			)
			.addDropdown((dropdown) => {
				dropdown.addOptions(
					arrayToChoices(getFolderPaths(this.plugin.app))
				);
				currentSelectedMappingPath = dropdown.getValue();
				dropdown.onChange((value) => {
					currentSelectedMappingPath = value;
				});
			})
			.addExtraButton((button) => {
				button
					.setIcon("plus-with-circle")
					.setTooltip("Add Replacement")
					.onClick(async () => {
						this.plugin.settings.pathSettings.push({
							type: "exact",
							match: currentSelectedMappingPath,
							replace: currentSelectedMappingPath,
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Exact Folder Replacement")
			.setDesc(
				`Select one of your folder names, and click the "+" button to add an exact folder replacement for that folder in any path`
			)
			.addDropdown((dropdown) => {
				dropdown.addOptions(
					arrayToChoices(
						getAllFolderNames(
							getFolderPaths(this.plugin.app)
						).sort()
					)
				);
				currentSelectedMappingFolder = dropdown.getValue();
				dropdown.onChange((value) => {
					currentSelectedMappingFolder = value;
				});
			})
			.addExtraButton((button) => {
				button
					.setIcon("plus-with-circle")
					.setTooltip("Add Replacement")
					.onClick(async () => {
						this.plugin.settings.pathSettings.push({
							type: "folder",
							match: currentSelectedMappingFolder,
							replace: currentSelectedMappingFolder,
						});
						await this.plugin.saveSettings();
						this.display();
					});
			});

		new Setting(containerEl)
			.setName("Other Path or Folder Replacement")
			.setDesc(
				"Add a replacement for a different exact path or folder than one listed above"
			)
			.addButton((button) => {
				button.setButtonText("Add Other Path");
				button.onClick(async () => {
					this.plugin.settings.pathSettings.push({
						type: "exact",
						match: "",
						replace: "",
					});
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addButton((button) => {
				button.setButtonText("Add Other Folder");
				button.onClick(async () => {
					this.plugin.settings.pathSettings.push({
						type: "folder",
						match: "",
						replace: "",
					});
					await this.plugin.saveSettings();
					this.display();
				});
			});

		new Setting(containerEl)
			.setName("Text or Regular Expression Replacement")
			.setDesc(
				"Add a text or regular expression replacement to match and replace partial text or a regular expression"
			)
			.addButton((button) => {
				button.setButtonText("Add Text");
				button.onClick(async () => {
					this.plugin.settings.pathSettings.push({
						type: "text",
						match: "",
						replace: "",
					});
					await this.plugin.saveSettings();
					this.display();
				});
			})
			.addButton((button) => {
				button.setButtonText("Add Regular Expression");
				button.onClick(async () => {
					this.plugin.settings.pathSettings.push({
						type: "regexp",
						match: "",
						replace: "",
					});
					await this.plugin.saveSettings();
					this.display();
				});
			});

		for (const [
			index,
			pathSettings,
		] of this.plugin.settings.pathSettings.entries()) {
			let headingEl: HTMLHeadingElement = null;
			let matchSetting: Setting = null;
			let replacementSetting: Setting = null;
			function setSettingUi(settings: PathSettings) {
				const emptyMessage = !settings.match
					? " (will not match any path)"
					: "";
				headingEl.setText(
					`${index + 1}. ${replacementTypeToUi[settings.type].heading(
						settings.match
					)}${emptyMessage}`
				);
				if (matchSetting && replacementSetting) {
					matchSetting.setName(
						replacementTypeToUi[settings.type].matchName
					);
					matchSetting.setDesc(
						replacementTypeToUi[settings.type].matchDesc
					);
					replacementSetting.setName(
						replacementTypeToUi[settings.type].replaceName
					);
					replacementSetting.setDesc(
						replacementTypeToUi[settings.type].replaceDesc
					);
				}
			}
			containerEl.createEl("h3", {}, (el) => {
				headingEl = el;
				setSettingUi(this.plugin.settings.pathSettings[index]);
			});

			new Setting(containerEl)
				.setName("Replacement Type")
				.addDropdown((dropdown) => {
					dropdown
						.addOptions({
							exact: "Exact Path",
							folder: "Exact Folder in Path",
							text: "Exact Text in Path",
							regexp: "Regular Expression in Path",
						})
						.setValue(
							this.plugin.settings.pathSettings[index].type ===
								"fuzzy"
								? "regexp"
								: this.plugin.settings.pathSettings[index].type
						)
						.onChange((value) => {
							this.plugin.settings.pathSettings[index].type =
								value;
							setSettingUi(
								this.plugin.settings.pathSettings[index]
							);
							this.plugin.saveSettings();
						});
				});

			matchSetting = new Setting(containerEl).addText((text) => {
				text.setValue(pathSettings.match || "").onChange(
					async (value) => {
						this.plugin.settings.pathSettings[index].match = value;
						await this.plugin.saveSettings();
						setSettingUi(this.plugin.settings.pathSettings[index]);
					}
				);
			});

			replacementSetting = new Setting(containerEl).addText((text) => {
				text.setValue(pathSettings.replace || "").onChange(
					async (value) => {
						this.plugin.settings.pathSettings[index].replace =
							value;
						await this.plugin.saveSettings();
					}
				);
			});

			setSettingUi(this.plugin.settings.pathSettings[index]);

			new Setting(containerEl)
				//.setName("Remove Path Settings")
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Remove replacement")
						.onClick(async () => {
							if (confirm(`Remove replacement ${index + 1}?`)) {
								this.plugin.settings.pathSettings.splice(
									index,
									1
								);
								await this.plugin.saveSettings();
								this.display();
							}
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("down-arrow-with-tail")
						.setTooltip(
							index >=
								this.plugin.settings.pathSettings.length - 1
								? "Already last"
								: "Move replacement down"
						)
						.setDisabled(
							index >=
								this.plugin.settings.pathSettings.length - 1
						)
						.onClick(async () => {
							const pathSettings =
								this.plugin.settings.pathSettings[index];
							this.plugin.settings.pathSettings.splice(index, 1);
							this.plugin.settings.pathSettings.splice(
								index + 1,
								0,
								pathSettings
							);
							await this.plugin.saveSettings();
							this.display();
						});
				})
				.addExtraButton((button) => {
					button
						.setIcon("up-arrow-with-tail")
						.setTooltip(
							index === 0
								? "Already first"
								: "Move replacement up"
						)
						.setDisabled(index === 0)
						.onClick(async () => {
							const pathSettings =
								this.plugin.settings.pathSettings[index];
							this.plugin.settings.pathSettings.splice(index, 1);
							this.plugin.settings.pathSettings.splice(
								index - 1,
								0,
								pathSettings
							);
							await this.plugin.saveSettings();
							this.display();
						});
				});
		}
	}
}
