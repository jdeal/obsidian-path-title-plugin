import {
	App,
	Plugin,
	PluginSettingTab,
	Setting,
	FileView,
	Vault,
	TFolder,
	debounce,
	WorkspaceLeaf,
} from "obsidian";

import { PathTitlePluginSettings, PathSettings } from "./types";
import { defaultSettings } from "./constants";
import {
	applyPathSettings,
	getAllFolderNames,
	arrayToChoices,
	escapeQuotes,
	escapeSlashes,
} from "./utils";

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

export class PathTitlePlugin extends Plugin {
	settings: PathTitlePluginSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new PathTitleSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-open", () => {
				this.setPaneTitles();
			})
		);

		// The rename event can sometimes be called many times consecutively
		// (when renaming a folder with lots of subfolders)
		const onRename = debounce(() => {
			this.setPaneTitles();
		}, 100);

		this.registerEvent(this.app.vault.on("rename", onRename));

		this.app.workspace.onLayoutReady(() => {
			this.setPaneTitles();
		});
	}

	// Find all file panes and show paths
	setPaneTitles() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof FileView && leaf.view.file) {
				const fileView = leaf.view as FileView;
				const path = fileView.file.parent
					? fileView.file.parent.path
					: "";
				const replacedPath = applyPathSettings(
					this.settings.pathSettings,
					path
				);

				if (replacedPath) {
					leaf.view.containerEl.addClass(
						"path-title-plugin-has-path"
					);
					const headerTitleContainerEl = leaf.view.containerEl.find(
						".view-header-title-container"
					);
					const isVerticalTitle =
						getComputedStyle(headerTitleContainerEl).writingMode ===
						"vertical-lr";
					if (isVerticalTitle) {
						leaf.view.containerEl.addClass(
							"path-title-plugin-has-vertical-title"
						);
					}

					if (
						!leaf.view.containerEl.find(
							".path-title-plugin-path-title-container"
						)
					) {
						// Add the path container if it doesn't exist.
						const pathContainerEl =
							leaf.view.containerEl.createEl("div");
						pathContainerEl.addClass(
							"path-title-plugin-path-title-container"
						);

						const titleEl =
							headerTitleContainerEl.find(".view-header-title");

						// Copy the title styles over to our container.
						const titleStyle = window.getComputedStyle(titleEl);
						pathContainerEl.style.lineHeight =
							titleStyle.getPropertyValue("line-height");
						pathContainerEl.style.fontSize =
							titleStyle.getPropertyValue("font-size");
						pathContainerEl.style.fontWeight =
							titleStyle.getPropertyValue("font-weight");

						headerTitleContainerEl.prepend(pathContainerEl);

						// Add the block element to hold the path.
						const pathEl = pathContainerEl.createEl("div");
						pathEl.addClass("path-title-plugin-path-title");
						pathContainerEl.append(pathEl);
						// Add the inline element to hold the path text.
						const pathTextEl = pathContainerEl.createEl("span");
						pathTextEl.addClass(
							"path-title-plugin-path-title-text"
						);
						pathEl.append(pathTextEl);
					}
					leaf.view.containerEl.find(
						".path-title-plugin-path-title-container"
					).style.display = "";
					const pathTextEl = leaf.view.containerEl.find(
						".path-title-plugin-path-title-text"
					);
					pathTextEl.setText(replacedPath);

					leaf.view.containerEl.style.setProperty(
						"--path-title-plugin-font-size",
						this.settings.fontSize || defaultSettings.fontSize
					);
				} else {
					this.cleanupLeaf(leaf);
				}
			}
		});
	}

	cleanupLeaf(leaf: WorkspaceLeaf) {
		const pathContainerEl = leaf.view.containerEl.find(
			".path-title-plugin-path-title-container"
		);
		if (pathContainerEl) {
			pathContainerEl.detach();
		}

		leaf.view.containerEl.removeClass("path-title-plugin-has-path");
		leaf.view.containerEl.removeClass(
			"path-title-plugin-has-vertical-title"
		);
		leaf.view.containerEl.style.removeProperty(
			"--path-title-plugin-font-size"
		);
	}

	onunload() {
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view instanceof FileView && leaf.view.file) {
				this.cleanupLeaf(leaf);
			}
		});
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			defaultSettings,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.setPaneTitles();
	}
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
		heading: (match) => `Path exactly matches "${escapeQuotes(match)}"`,
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
			`Path matches regular expression /${escapeSlashes(match)}/`,
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
	// Save the last deleted replacement so we can undo it
	undoReplacementEntry: [number, PathSettings];

	constructor(app: App, plugin: PathTitlePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.undoReplacementEntry = null;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {}, (el) => {
			el.setText("General Settings");
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
							defaultSettings.fontSize
					)
					.onChange(async (value) => {
						this.plugin.settings.fontSize = value;
						await this.plugin.saveSettings();
					});
			});

		// Current value of dropdown to select a path to add
		let currentSelectedMappingPath = "";
		// Current value of dropdown to select a folder to add
		let currentSelectedMappingFolder = "";

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
						this.undoReplacementEntry = null;
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
						this.undoReplacementEntry = null;
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
					this.undoReplacementEntry = null;
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
					this.undoReplacementEntry = null;
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
					this.undoReplacementEntry = null;
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
					this.undoReplacementEntry = null;
					await this.plugin.saveSettings();
					this.display();
				});
			});

		const entries = Array.from(this.plugin.settings.pathSettings.entries());
		if (this.undoReplacementEntry) {
			entries.splice(
				this.undoReplacementEntry[0],
				0,
				this.undoReplacementEntry
			);
		}

		for (const [index, pathSettings] of entries) {
			if (
				this.undoReplacementEntry &&
				pathSettings === this.undoReplacementEntry[1]
			) {
				containerEl.createDiv(
					{ cls: "path-title-plugin-undo-container" },
					(el) => {
						const heading = replacementTypeToUi[
							pathSettings.type
						].heading(pathSettings.match);
						new Setting(el)
							.setDesc(`Replacement where ${heading} removed`)
							.addButton((button) => {
								button.setButtonText("Undo");
								button.onClick(async () => {
									this.plugin.settings.pathSettings.splice(
										index,
										0,
										pathSettings
									);
									await this.plugin.saveSettings();
									this.undoReplacementEntry = null;
									this.display();
								});
							})
							.addExtraButton((button) => {
								button.setIcon("cross");
								button.onClick(() => {
									this.undoReplacementEntry = null;
									this.display();
								});
							});
					}
				);
				continue;
			}

			// These get mutated when you change the type of the path settings
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
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Remove replacement")
						.onClick(async () => {
							this.plugin.settings.pathSettings.splice(index, 1);
							await this.plugin.saveSettings();
							this.undoReplacementEntry = [index, pathSettings];
							this.display();
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
