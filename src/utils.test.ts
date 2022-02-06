import { applyPathSettings, getAllFolderNames, arrayToChoices } from "./utils";

test("apply no path settings to path", () => {
	expect(applyPathSettings([], "trash/notes")).toBe("trash/notes");
});

test("apply matching path replacement setting to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "exact",
					match: "trash/notes",
					replace: "🗑/📝",
				},
			],
			"trash/notes"
		)
	).toBe("🗑/📝");
});

test("apply non-matching path replacement setting to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "exact",
					match: "trash/notes",
					replace: "🗑/📝",
				},
			],
			"notes"
		)
	).toBe("notes");
});

test("apply matching folder replacement settings to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "folder",
					match: "trash",
					replace: "🗑",
				},
				{
					type: "folder",
					match: "notes",
					replace: "📝",
				},
			],
			"trash/notes"
		)
	).toBe("🗑/📝");
});

test("apply partial matching folder replacement settings to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "folder",
					match: "trash",
					replace: "🗑",
				},
			],
			"trash/notes"
		)
	).toBe("🗑/notes");
});

test("apply text matching replacement settings to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "text",
					match: "001 ",
					replace: "1. ",
				},
			],
			"001 Index"
		)
	).toBe("1. Index");
});

test("apply regular expression replacement settings to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "regexp",
					match: "^(.).+$",
					replace: "$1",
				},
			],
			"📝 notes"
		)
	).toBe("📝");
});

test("apply multiple replacement settings to path", () => {
	expect(
		applyPathSettings(
			[
				{
					type: "folder",
					match: "daily",
					replace: "🗓",
				},
				{
					type: "regexp",
					match: "/([0-9]{4})([0-9]{2})([0-9]{2})$",
					replace: " $1-$2-$3",
				},
			],
			"daily/20220101"
		)
	).toBe("🗓 2022-01-01");
});

test("get folder names", () => {
	expect(getAllFolderNames(["archive/notes", "notes"])).toEqual([
		"archive",
		"notes",
	]);
});

test("convert array of values to choices", () => {
	expect(arrayToChoices(["archive", "notes"])).toEqual({
		archive: "archive",
		notes: "notes",
	});
});
