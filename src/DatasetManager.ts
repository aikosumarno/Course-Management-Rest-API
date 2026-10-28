import * as fs from "fs/promises";
import * as path from "path";
import JSZip from "jszip";
import { CourseRepository } from "./repositories/courseRepository";
import { SectionRepository } from "./repositories/sectionRepository";
import { FacilitiesDataModel } from "./FacilitiesDataModel";
import { validateBuilding, validateRoom } from "./Validation";

// BEGIN AI-GENERATED CODE:  AI was used to help draft and debug the asynchronous dataset parsing and file handling logic

/**
 * Status of a dataset upload job
 */
export type DatasetStatus = "processing" | "completed" | "failed";

/**
 * Statistics for course offerings upload
 */
export interface CourseOfferingsUploadStats {
	files_total: number;
	files_processed: number;
	files_skipped: number;
	courses_seen: number;
	courses_added: number;
	courses_modified: number;
	sections_seen: number;
	sections_added: number;
	sections_modified: number;
}

// statistics for facilities upload
export interface FacilitiesUploadStats {
	buildings_added: number;
	buildings_modified: number;
	rooms_added: number;
	rooms_modified: number;
}

/**
 * Metadata about a dataset upload job
 */
export interface DatasetJob {
	id: string;
	status: DatasetStatus;
	kind: "course_offerings" | "facilities";
	stats: CourseOfferingsUploadStats | FacilitiesUploadStats;
	message: string;
}

/**
 * Course offering record from the zip file
 */
interface CourseOffering {
	id: string | number;
	// id: string;
	Course: string;
	Title: string;
	Professor: string;
	Subject: string;
	Section: string;
	Year: string;
	Avg: number;
	Pass: number;
	Fail: number;
	Audit: number;
}

/**
 * Manages dataset upload jobs and processing
 */
export class DatasetManager {
	private datadir: string;
	private courseRepo: CourseRepository;
	private sectionRepo: SectionRepository;
	private facilitiesDataModel: FacilitiesDataModel;
	private jobs: Map<string, DatasetJob>;

	constructor(
		datadir: string,
		courseRepo: CourseRepository,
		sectionRepo: SectionRepository,
		facilitiesDataModel: FacilitiesDataModel
	) {
		this.datadir = datadir;
		this.courseRepo = courseRepo;
		this.sectionRepo = sectionRepo;
		this.facilitiesDataModel = facilitiesDataModel;
		this.jobs = new Map();
	}

	/**
	 * Get the file path for storing job metadata
	 */
	private getJobsPath(): string {
		return path.join(this.datadir, "dataset-jobs.json");
	}

	/**
	 * Load jobs from disk
	 */
	async loadJobs(): Promise<void> {
		try {
			const data = await fs.readFile(this.getJobsPath(), "utf-8");
			const jobsArray = JSON.parse(data) as DatasetJob[];
			this.jobs = new Map(jobsArray.map((job) => [job.id, job]));
		} catch {
			// File doesn't exist or is invalid
			this.jobs = new Map();
		}
	}

	/**
	 * Save jobs to disk
	 */
	private async saveJobs(): Promise<void> {
		// Ensure datadir exists before writing
		await fs.mkdir(this.datadir, { recursive: true });

		const jobsArray = Array.from(this.jobs.values());
		await fs.writeFile(this.getJobsPath(), JSON.stringify(jobsArray, null, 2), "utf-8");
	}

	/**
	 * Generate a unique ID for a dataset upload job
	 */
	private generateJobId(): string {
		return `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;
	}

	/**
	 * Create a new upload job and start processing asynchronously
	 */
	async createUploadJob(zipBuffer: Buffer, kind: "course_offerings" | "facilities"): Promise<string> {
		const jobId = this.generateJobId();

		// Create job with processing status and zero stats
		const stats: CourseOfferingsUploadStats | FacilitiesUploadStats =
			kind === "course_offerings"
				? {
						files_total: 0,
						files_processed: 0,
						files_skipped: 0,
						courses_seen: 0,
						courses_added: 0,
						courses_modified: 0,
						sections_seen: 0,
						sections_added: 0,
						sections_modified: 0,
					}
				: {
						buildings_added: 0,
						buildings_modified: 0,
						rooms_added: 0,
						rooms_modified: 0,
					};

		const job: DatasetJob = {
			id: jobId,
			status: "processing",
			kind,
			stats,
			message: "Processing in progress",
		};

		this.jobs.set(jobId, job);
		await this.saveJobs();

		// Start processing asynchronously
		this.processDataset(jobId, zipBuffer).catch((error) => {
			console.error(`Error processing job ${jobId}:`, error);
		});

		return jobId;
	}

	/**
	 * Get the status of a dataset upload job.
	 * Jobs are loaded at application startup; lookups use in-memory state
	 * so active async processing cannot be overwritten by stale disk reads.
	 */
	async getJob(jobId: string): Promise<DatasetJob | undefined> {
		return this.jobs.get(jobId);
	}

	/**
	 * Process the uploaded dataset asynchronously
	 */
	private async processDataset(jobId: string, zipBuffer: Buffer): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		if (job.kind === "course_offerings") {
			await this.processCourseOfferings(jobId, zipBuffer);
		} else if (job.kind === "facilities") {
			await this.processFacilities(jobId, zipBuffer);
		}
	}

	private async processCourseOfferings(jobId: string, zipBuffer: Buffer): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) {
			return;
		}

		const stats = job.stats as CourseOfferingsUploadStats;

		try {
			stats.files_total = 0;
			stats.files_processed = 0;
			stats.files_skipped = 0;
			stats.courses_seen = 0;
			stats.courses_added = 0;
			stats.courses_modified = 0;
			stats.sections_seen = 0;
			stats.sections_added = 0;
			stats.sections_modified = 0;

			// Step 1: Validate zip format
			let zip: JSZip;
			try {
				zip = await JSZip.loadAsync(zipBuffer);
			} catch {
				job.status = "failed";
				job.message = "Data is not in a valid zip format";
				await this.saveJobs();
				return;
			}

			// Step 2: Check for root courses/ directory (case-sensitive)
			const hasCoursesRootDirectory =
				(zip.files["courses/"]?.dir ?? false) ||
				Object.keys(zip.files).some((filename) => filename.startsWith("courses/"));

			if (!hasCoursesRootDirectory) {
				job.status = "failed";
				job.message = "Missing root courses directory";
				await this.saveJobs();
				return;
			}

			// Step 3: Process files in courses/ directory
			const offerings: CourseOffering[] = [];

			// Get all files in the courses/ directory
			const files = Object.keys(zip.files).filter((filename) => {
				if (filename.endsWith("/")) return false;
				return filename.startsWith("courses/");
			});

			stats.files_total = files.length;
			await this.saveJobs();

			for (let i = 0; i < files.length; i++) {
				const filename = files[i];
				const file = zip.files[filename];
				try {
					// Read file content
					const content = await file.async("string");

					// Parse JSON — if it throws, the file is skipped
					const jsonData = JSON.parse(content);

					// Check for result property
					if (!jsonData.result || !Array.isArray(jsonData.result)) {
						stats.files_skipped++;
						continue;
					}

					// File-level semantics: valid JSON + result array means processed.
					// Invalid individual records are skipped silently and do not affect file counters.
					stats.files_processed++;

					// Add valid offerings
					for (const offering of jsonData.result) {
						if (this.isValidOffering(offering)) {
							offerings.push(offering);
						}
						// Invalid offerings are skipped silently
					}

					// Save progress every 500 files
					if ((i + 1) % 500 === 0) {
						await this.saveJobs();
					}
				} catch {
					// Skip files that can't be parsed as JSON
					stats.files_skipped++;
					continue;
				}
			}

			// Step 4: Process offerings and create/update courses and sections
			await this.loadOfferingsIntoDataModel(offerings, stats);
			await this.saveJobs();

			// Mark job as completed
			job.status = "completed";
			job.message = "Dataset processing complete";
			await this.saveJobs();
		} catch {
			job.status = "failed";
			job.message = "Data is not in a valid zip format";
			await this.saveJobs();
		}
	}

	private async processFacilities(jobId: string, zipBuffer: Buffer): Promise<void> {
		const job = this.jobs.get(jobId);
		if (!job) return;

		const stats = job.stats as FacilitiesUploadStats;

		try {
			// Step 1: Validate zip
			let zip: JSZip;
			try {
				zip = await JSZip.loadAsync(zipBuffer);
			} catch {
				job.status = "failed";
				job.message = "Data is not in a valid zip format";
				await this.saveJobs();
				return;
			}

			// Step 2: Check for index.htm at zip root (exact match only)
			const indexFile = zip.files["index.htm"];
			if (!indexFile) {
				job.status = "failed";
				job.message = "Missing index.htm file";
				await this.saveJobs();
				return;
			}

			// Step 3: Parse index.htm as HTML
			let indexContent: string;
			try {
				indexContent = await indexFile.async("string");
			} catch {
				job.status = "failed";
				job.message = "index.htm could not be parsed";
				await this.saveJobs();
				return;
			}

			let document: any;
			try {
				const parse5 = await import("parse5");
				document = parse5.parse(indexContent);
			} catch {
				job.status = "failed";
				job.message = "index.htm could not be parsed";
				await this.saveJobs();
				return;
			}

			// Step 4: Find building table (class contains "views-table")
			const buildingTable = this.findViewsTable(document);
			if (!buildingTable) {
				job.status = "failed";
				job.message = "No building table found in index.htm";
				await this.saveJobs();
				return;
			}

			// Step 5: Extract buildings from table rows
			const buildings = this.extractBuildingRows(buildingTable);

			// Step 6: For each building, extract rooms + geolocation, then load
			for (const building of buildings) {
				// Extract rooms from linked file
				const rooms = await this.extractRooms(zip, building.link);

				// Get geolocation — skip building if it fails
				const geo = await this.fetchGeolocation(building.address);
				if (!geo) continue;

				// Validate building data before loading
				const buildingValidation = validateBuilding({
					name: building.fullname,
					address: building.address,
					lat: geo.lat,
					lon: geo.lon,
				});

				// Skip building if validation fails
				if (!buildingValidation.valid) continue;

				// Load building into data model
				const existingBuilding = await this.facilitiesDataModel.getBuilding(building.shortname);
				if (!existingBuilding) {
					await this.facilitiesDataModel.putBuilding(
						building.shortname,
						building.fullname,
						building.address,
						geo.lat,
						geo.lon
					);
					stats.buildings_added++;
				} else {
					const needsUpdate =
						existingBuilding.name !== building.fullname ||
						existingBuilding.address !== building.address ||
						existingBuilding.lat !== geo.lat ||
						existingBuilding.lon !== geo.lon;
					if (needsUpdate) {
						await this.facilitiesDataModel.putBuilding(
							building.shortname,
							building.fullname,
							building.address,
							geo.lat,
							geo.lon
						);
						stats.buildings_modified++;
					}
				}

				// Load rooms into data model
				for (const room of rooms) {
					const roomId = `${building.shortname}_${room.number}`;

					// Validate room data before loading
					const roomValidation = validateRoom({
						building: building.shortname,
						number: room.number,
						type: room.type,
						furniture: room.furniture,
						href: room.href,
						seats: room.seats,
					});

					// Skip room if validation fails
					if (!roomValidation.valid) continue;

					const existingRoom = await this.facilitiesDataModel.getRoom(building.shortname, roomId);

					if (existingRoom === undefined) continue; // building doesn't exist (shouldn't happen)

					if (existingRoom === null) {
						await this.facilitiesDataModel.putRoom(
							building.shortname,
							roomId,
							building.shortname,
							room.number,
							room.type,
							room.furniture,
							room.href,
							room.seats
						);
						stats.rooms_added++;
					} else {
						const needsUpdate =
							existingRoom.number !== room.number ||
							existingRoom.type !== room.type ||
							existingRoom.furniture !== room.furniture ||
							existingRoom.href !== room.href ||
							existingRoom.seats !== room.seats;
						if (needsUpdate) {
							await this.facilitiesDataModel.putRoom(
								building.shortname,
								roomId,
								building.shortname,
								room.number,
								room.type,
								room.furniture,
								room.href,
								room.seats
							);
							stats.rooms_modified++;
						}
					}
				}
			}

			job.status = "completed";
			job.message = "Dataset processing complete";
			await this.saveJobs();
		} catch {
			job.status = "failed";
			job.message = "Data is not in a valid zip format";
			await this.saveJobs();
		}
	}

	// Recursively find the first <table> with class "views-table" in the document
	private findViewsTable(node: any): any {
		if (node.nodeName === "table") {
			const classAttr = node.attrs?.find((a: any) => a.name === "class");
			if (classAttr?.value?.split(" ").includes("views-table")) {
				return node;
			}
		}
		for (const child of node.childNodes ?? []) {
			const found = this.findViewsTable(child);
			if (found) return found;
		}
		return null;
	}

	// Get text content of a node recursively (no trimming — trim at call sites)
	private getTextContent(node: any): string {
		if (node.nodeName === "#text") return node.value ?? "";
		return (node.childNodes ?? []).map((c: any) => this.getTextContent(c)).join("");
	}

	// Find first child node with a given tag name
	private findByTag(node: any, tag: string): any {
		if (node.nodeName === tag) return node;
		for (const child of node.childNodes ?? []) {
			const found = this.findByTag(child, tag);
			if (found) return found;
		}
		return null;
	}

	// Find first <td> whose class attribute includes the given CSS class
	private findCellByClass(row: any, cssClass: string): any {
		for (const child of row.childNodes ?? []) {
			if (child.nodeName === "td") {
				const classAttr = child.attrs?.find((a: any) => a.name === "class");
				if (classAttr?.value?.split(" ").includes(cssClass)) return child;
			}
			// recurse into non-td children (e.g. tbody whitespace nodes)
			const found = this.findCellByClass(child, cssClass);
			if (found) return found;
		}
		return null;
	}

	// Extract building rows from the views-table
	private extractBuildingRows(table: any): Array<{
		fullname: string;
		shortname: string;
		address: string;
		link: string;
	}> {
		const results: Array<{ fullname: string; shortname: string; address: string; link: string }> = [];

		const tbody = this.findByTag(table, "tbody");
		const rows = (tbody ?? table).childNodes?.filter((n: any) => n.nodeName === "tr") ?? [];

		for (const row of rows) {
			const titleCell = this.findCellByClass(row, "views-field-title");
			const codeCell = this.findCellByClass(row, "views-field-field-building-code");
			const addressCell = this.findCellByClass(row, "views-field-field-building-address");

			if (!titleCell || !codeCell || !addressCell) continue;

			const anchor = this.findByTag(titleCell, "a");
			if (!anchor) continue;

			const fullname = this.getTextContent(anchor).trim();
			const shortname = this.getTextContent(codeCell).trim();
			const address = this.getTextContent(addressCell).trim();
			const hrefAttr = anchor.attrs?.find((a: any) => a.name === "href");
			const link = hrefAttr?.value ?? "";

			if (!fullname || !shortname || !address || !link) continue;

			results.push({ fullname, shortname, address, link });
		}

		return results;
	}

	// Extract rooms from a linked building file
	private async extractRooms(
		zip: JSZip,
		link: string
	): Promise<
		Array<{
			number: string;
			seats: number;
			furniture: string;
			type: string;
			href: string;
		}>
	> {
		try {
			// Normalize path: try stripping leading ./ or / to match zip entry keys
			const candidates = [
				link.replace(/^\.\//, ""), // strip ./  → works for campus.zip
				link, // exact as-is
				link.replace(/^\//, ""), // strip leading /
			];

			let file: JSZip.JSZipObject | undefined;
			for (const candidate of candidates) {
				if (candidate && zip.files[candidate]) {
					file = zip.files[candidate];
					break;
				}
			}

			if (!file) return [];

			const content = await file.async("string");
			const parse5 = await import("parse5");
			const document = parse5.parse(content);

			const table = this.findViewsTable(document);
			if (!table) return [];

			const tbody = this.findByTag(table, "tbody");
			const rows = (tbody ?? table).childNodes?.filter((n: any) => n.nodeName === "tr") ?? [];
			const results: Array<{ number: string; seats: number; furniture: string; type: string; href: string }> = [];

			for (const row of rows) {
				const numberCell = this.findCellByClass(row, "views-field-field-room-number");
				const capacityCell = this.findCellByClass(row, "views-field-field-room-capacity");
				const furnitureCell = this.findCellByClass(row, "views-field-field-room-furniture");
				const typeCell = this.findCellByClass(row, "views-field-field-room-type");
				const hrefCell = this.findCellByClass(row, "views-field-nothing");

				if (!numberCell || !capacityCell || !furnitureCell || !typeCell || !hrefCell) continue;

				const anchor = this.findByTag(numberCell, "a");
				const hrefAnchor = this.findByTag(hrefCell, "a");
				if (!anchor || !hrefAnchor) continue;

				const number = this.getTextContent(anchor).trim();
				const seatsStr = this.getTextContent(capacityCell).trim();
				const furniture = this.getTextContent(furnitureCell).trim();
				const type = this.getTextContent(typeCell).trim();
				const hrefAttr = hrefAnchor.attrs?.find((a: any) => a.name === "href");
				const href = hrefAttr?.value ?? "";

				const seats = parseInt(seatsStr, 10);

				// Skip row only if number/href are empty or seats is invalid
				// Empty strings for furniture and type ARE allowed
				if (!number || !href || isNaN(seats) || seats < 0) continue;

				results.push({ number, seats, furniture, type, href });
			}

			return results;
		} catch {
			return []; // missing file or parse error — building is still valid
		}
	}

	// Call the geolocation service with retries and timeout
	private async fetchGeolocation(address: string): Promise<{ lat: number; lon: number } | null> {
		const team = process.env.GEO_TEAM_NUMBER ?? "132";
		const encoded = encodeURIComponent(address);
		const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team${team}/${encoded}`;

		for (let attempt = 1; attempt <= 3; attempt++) {
			try {
				const http = await import("http");

				const result = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
					const req = http.get(url, (res) => {
						let data = "";
						res.on("data", (chunk) => (data += chunk));
						res.on("end", () => {
							try {
								const json = JSON.parse(data);
								if (json.error || json.lat === undefined || json.lon === undefined) {
									resolve(null);
								} else {
									resolve({ lat: json.lat, lon: json.lon });
								}
							} catch {
								resolve(null);
							}
						});
					});

					req.setTimeout(5000, () => {
						req.destroy();
						resolve(null);
					});

					req.on("error", () => resolve(null));
				});

				if (result) {
					return result;
				}
			} catch {
				// ignore and retry
			}

			if (attempt < 3) {
				await new Promise((r) => setTimeout(r, 200));
			}
		}

		return null;
	}

	/**
	 * Validate that an offering has all required fields with correct types.
	 * Per spec: id is listed as string but real data uses numbers — accept both.
	 * Year is a string. Numeric conversions happen at load time.
	 */
	private isValidOffering(offering: any): offering is CourseOffering {
		if (typeof offering.id !== "number" && typeof offering.id !== "string") return false;
		// if (typeof offering.id !== "string") return false;
		if (typeof offering.Course !== "string") return false;
		if (typeof offering.Title !== "string") return false;
		if (typeof offering.Professor !== "string") return false;
		if (typeof offering.Subject !== "string") return false;
		if (typeof offering.Section !== "string") return false;
		if (typeof offering.Year !== "string") return false;
		if (typeof offering.Avg !== "number" || !Number.isFinite(offering.Avg)) return false;
		if (typeof offering.Pass !== "number" || !Number.isFinite(offering.Pass)) return false;
		if (typeof offering.Fail !== "number" || !Number.isFinite(offering.Fail)) return false;
		if (typeof offering.Audit !== "number" || !Number.isFinite(offering.Audit)) return false;
		return true;
	}

	/**
	 * Load course offerings into the data model and track statistics.
	 * Courses are processed before sections per the spec.
	 */
	private async loadOfferingsIntoDataModel(
		offerings: CourseOffering[],
		stats: CourseOfferingsUploadStats
	): Promise<void> {
		// Group offerings by course ID (Subject + Course concatenation per spec)
		const courseMap = new Map<string, CourseOffering[]>();

		for (const offering of offerings) {
			const courseId = offering.Subject + offering.Course;
			if (!courseMap.has(courseId)) {
				courseMap.set(courseId, []);
			}
			courseMap.get(courseId)!.push(offering);
		}

		stats.courses_seen = courseMap.size;

		// Process each course — courses before sections per spec
		for (const [courseId, courseOfferings] of courseMap.entries()) {
			// Use the most recent non-overall offering for course metadata.
			// Fall back to overall offerings if no non-overall offerings exist.
			const nonOverall = courseOfferings.filter((o) => o.Section !== "overall");
			const sortedOfferings = (nonOverall.length > 0 ? nonOverall : courseOfferings).sort((a, b) => {
				const yearA = parseInt(a.Year) || 1900;
				const yearB = parseInt(b.Year) || 1900;
				return yearB - yearA; // Most recent first
			});

			const mostRecent = sortedOfferings[0];
			const existingCourse = await this.courseRepo.getCourse(courseId);

			if (!existingCourse) {
				await this.courseRepo.putCourse(courseId, mostRecent.Title, mostRecent.Subject, mostRecent.Course);
				stats.courses_added++;
			} else {
				const needsUpdate =
					existingCourse.code !== mostRecent.Course ||
					existingCourse.title !== mostRecent.Title ||
					existingCourse.dept !== mostRecent.Subject;

				if (needsUpdate) {
					await this.courseRepo.putCourse(courseId, mostRecent.Title, mostRecent.Subject, mostRecent.Course);
					stats.courses_modified++;
				}
			}

			// Process sections for this course
			stats.sections_seen += courseOfferings.length;

			for (const offering of courseOfferings) {
				// Convert id to string for storage per spec
				const sectionId = offering.id.toString();

				// Convert year: use 1900 when Section === "overall", otherwise parse Year as number
				const year = offering.Section === "overall" ? 1900 : Number.parseInt(offering.Year, 10);

				const existingSection = await this.sectionRepo.getSection(courseId, sectionId);

				if (existingSection === undefined) {
					// Course not found — shouldn't happen since we process courses first
					continue;
				}

				if (existingSection === null) {
					await this.sectionRepo.putSection(
						courseId,
						sectionId,
						offering.Professor,
						year,
						offering.Avg,
						offering.Pass,
						offering.Fail,
						offering.Audit
					);
					stats.sections_added++;
				} else {
					const needsUpdate =
						existingSection.instructor !== offering.Professor ||
						existingSection.year !== year ||
						existingSection.avg !== offering.Avg ||
						existingSection.pass !== offering.Pass ||
						existingSection.fail !== offering.Fail ||
						existingSection.audit !== offering.Audit;

					if (needsUpdate) {
						await this.sectionRepo.putSection(
							courseId,
							sectionId,
							offering.Professor,
							year,
							offering.Avg,
							offering.Pass,
							offering.Fail,
							offering.Audit
						);
						stats.sections_modified++;
					}
				}
			}
		}
	}
}
// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
