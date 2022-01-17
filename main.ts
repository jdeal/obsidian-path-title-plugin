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

// Remember to rename these classes and interfaces!

interface PathTitlePluginSettings {
	position: string;
	fontSize: string;
	borderSize: string;
	// maxSize: number;
	// showEllipsis: boolean;
	pathMappings: Array<Array<string>>;
}

const DEFAULT_SETTINGS: PathTitlePluginSettings = {
	position: "before",
	fontSize: "medium",
	borderSize: "1px",
	// maxSize: Infinity,
	// showEllipsis: true,
	pathMappings: [],
};

function getFolders(app: App) {
	const folders: Array<string> = [];

	Vault.recurseChildren(app.vault.getRoot(), (f) => {
		if (f instanceof TFolder) {
			folders.push(f.path);
		}
	});

	folders.sort();

	return folders;
}

function arrayToChoices(array: Array<string>) {
	return array.reduce((result, item) => {
		result[item] = item;
		return result;
	}, {} as Record<string, string>);
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
				const folderPath = fileView.file.parent
					? fileView.file.parent.path
					: "";
				const pathTitle =
					folderPath in pathMappings
						? pathMappings[folderPath]
						: folderPath === "/"
						? ""
						: folderPath;
				// const truncatedPathTitle = this.settings.maxSize
				// 	? pathTitle.substring(0, this.settings.maxSize)
				// 	: pathTitle;
				// const ellipsis =
				// 	this.settings.showEllipsis &&
				// 	pathTitle != truncatedPathTitle
				// 		? "…"
				// 		: "";
				// const truncatedPathTitleAndEllipsis =
				// 	truncatedPathTitle + ellipsis;
				if (pathTitle) {
					leaf.view.containerEl.style.setProperty(
						"--path-title-plugin-border-size",
						this.settings.borderSize || DEFAULT_SETTINGS.borderSize
					);
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
							`'${pathTitle}'`
						);
						leaf.view.containerEl.style.removeProperty(
							"--path-title-plugin-title-before"
						);
					} else {
						leaf.view.containerEl.style.setProperty(
							"--path-title-plugin-title-before",
							`'${pathTitle}'`
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
		console.log(this.settings);
		await this.saveData(this.settings);
		this.setPaneTitles();
	}
}

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
			el.setText("Default Settings");
		});

		let currentSelectedMappingFolder = "";

		new Setting(containerEl)
			.setName("Style")
			.setDesc("How the path looks: position, size, border")
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
			})
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
			})
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

		// new Setting(containerEl)
		// 	.setName("Max Size")
		// 	.setDesc("Maximum number of characters before truncating")
		// 	.addText((text) => {
		// 		text.setValue(
		// 			this.plugin.settings.maxSize === Infinity ||
		// 				!this.plugin.settings.maxSize
		// 				? ""
		// 				: String(this.plugin.settings.maxSize)
		// 		).onChange(async (value) => {
		// 			try {
		// 				this.plugin.settings.maxSize = Number(value);
		// 			} catch (e) {
		// 				this.plugin.settings.maxSize = Infinity;
		// 			}
		// 			await this.plugin.saveSettings();
		// 		});
		// 	});

		// new Setting(containerEl)
		// 	.setName("Ellipsis When Truncated")
		// 	.setDesc(
		// 		"If Max Size is set, show an ellipsis if path is truncated"
		// 	)
		// 	.addToggle((toggle) => {
		// 		toggle
		// 			.setValue(this.plugin.settings.showEllipsis)
		// 			.onChange(async (value) => {
		// 				this.plugin.settings.showEllipsis = value;
		// 				await this.plugin.saveSettings();
		// 			});
		// 	});

		containerEl.createEl("h2", {}, (el) => {
			el.setText("Per Path Settings");
		});

		new Setting(containerEl)
			.setName("Add Settings for Path")
			.setDesc(
				"Select folder and click add button to add custom settings for a path."
			)
			.addDropdown((dropdown) => {
				dropdown.addOptions(
					arrayToChoices([""].concat(getFolders(this.plugin.app)))
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
						this.plugin.settings.pathMappings.push([
							currentSelectedMappingFolder,
							currentSelectedMappingFolder,
						]);
						this.plugin.settings.pathMappings.sort();
						await this.plugin.saveSettings();
						this.display();
					});
			});

		for (const [
			index,
			pathMapping,
		] of this.plugin.settings.pathMappings.entries()) {
			let headingEl: HTMLHeadingElement = null;
			const defaultHeading = "?";
			containerEl.createEl("h3", {}, (el) => {
				el.setText(pathMapping[0] || defaultHeading);
				headingEl = el;
			});

			new Setting(containerEl)
				.setName("Original Path")
				.addText((text) => {
					text.setValue(pathMapping[0] || "").onChange(
						async (value) => {
							this.plugin.settings.pathMappings[index][0] = value;
							await this.plugin.saveSettings();
							headingEl.setText(value || defaultHeading);
						}
					);
				});

			new Setting(containerEl)
				.setName("Replacement Path")
				.addText((text) => {
					text.setValue(pathMapping[1] || "").onChange(
						async (value) => {
							this.plugin.settings.pathMappings[index][1] = value;
							await this.plugin.saveSettings();
						}
					);
				});

			new Setting(containerEl)
				.setName("Remove Path Settings")
				.addExtraButton((button) => {
					button
						.setIcon("trash")
						.setTooltip("Remove Path Settings")
						.onClick(async () => {
							this.plugin.settings.pathMappings.splice(index, 1);
							this.plugin.settings.pathMappings.sort();
							await this.plugin.saveSettings();
							this.display();
						});
				});
		}
	}
}
