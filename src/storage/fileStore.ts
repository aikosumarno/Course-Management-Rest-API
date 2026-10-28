// BEGIN AI-GENERATED CODE: AI assisted with extracting storage layer for raw JSON file operations

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Storage layer for raw JSON file operations.
 * This is the only module that should directly interact with the file system.
 */
export class FileStore {
	private datadir: string;

	constructor(datadir: string) {
		this.datadir = datadir;
	}

	/**
	 * Get the full path to a data file
	 */
	private getFilePath(filename: string): string {
		return path.join(this.datadir, filename);
	}

	/**
	 * Read a JSON collection from disk
	 * Returns an empty object if the file doesn't exist or cannot be read
	 */
	async readCollection<T>(filename: string): Promise<Record<string, T>> {
		try {
			const filePath = this.getFilePath(filename);
			const raw = await fs.readFile(filePath, "utf-8");
			const parsed = JSON.parse(raw) as Record<string, T>;
			return parsed;
		} catch {
			// File doesn't exist or is invalid - return empty collection
			return {};
		}
	}

	/**
	 * Write a JSON collection to disk
	 * Creates the data directory if it doesn't exist
	 */
	async writeCollection<T>(filename: string, data: Record<string, T>): Promise<void> {
		// Ensure directory exists before writing
		await fs.mkdir(this.datadir, { recursive: true });
		const filePath = this.getFilePath(filename);
		await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
	}
}

// END AI-GENERATED CODE
