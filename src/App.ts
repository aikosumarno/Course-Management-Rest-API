//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with implementing REST endpoints, request validation,
// error handling patterns, and integrating data models

import * as fs from "fs/promises";
import type { Request, Response } from "express";
import express = require("express");
import cors = require("cors");
import multer = require("multer");
import JSZip from "jszip";
import { handleErrors } from "./middleware/handleErrors";
import { parsePagination } from "./middleware/parsePagination";
import { createSearchRouter } from "./searchRoutes";
import { CourseOfferingsRecord, FacilitiesRecord } from "./Search";
import { FileStore } from "./storage/fileStore";
import { CourseRepository } from "./repositories/courseRepository";
import { SectionRepository } from "./repositories/sectionRepository";
import { CourseService } from "./services/courseService";
import { SectionService } from "./services/sectionService";
import { createCourseController } from "./controllers/courseController";
import { createSectionController } from "./controllers/sectionController";
import { FacilitiesDataModel } from "./FacilitiesDataModel";
import { DatasetManager } from "./DatasetManager";
import { validatePagination, validateBuilding, validateRoom } from "./Validation";

/**
 * Express application.
 */
export type Application = ReturnType<typeof express>;

/**
 * Configuration options for the application.
 */
export type AppConfig = {
	/**
	 * The directory where application data will be stored enabling the application to persist data between restarts.
	 *
	 * @internal
	 * During autograding, the directory will be deleted as a means to reset the application data between tests.
	 */
	readonly datadir: string;
	readonly getAllSearchRecords?: () => Promise<CourseOfferingsRecord[]>;
};

/**
 * Initializes the application.
 */
export async function createApp(config: AppConfig): Promise<Application> {
	const app = express();

	const { datadir, getAllSearchRecords } = config;

	// Ensure the data directory exists
	await fs.mkdir(datadir, { recursive: true });

	// Create storage and repository layers
	const fileStore = new FileStore(datadir);
	const courseRepo = new CourseRepository(fileStore);
	const sectionRepo = new SectionRepository(courseRepo);

	// Create service layer
	const courseService = new CourseService(courseRepo, sectionRepo);
	const sectionService = new SectionService(courseRepo, sectionRepo);

	const courseController = createCourseController(courseService);
	const sectionController = createSectionController(sectionService);

	const facilitiesDataModel = new FacilitiesDataModel(datadir);
	const datasetManager = new DatasetManager(datadir, courseRepo, sectionRepo, facilitiesDataModel);
	await datasetManager.loadJobs();

	// Configure multer to store file contents in memory
	const upload = multer({ storage: multer.memoryStorage() });

	// Make files in ../frontend/public accessible at http://localhost:<port>/
	app.use(express.static("frontend/public"));

	// Register middleware to parse request before passing them to request handlers
	// Note: JSON parser must be place before raw parser because of wildcard matching done by raw parser below
	app.use(express.json());
	app.use(express.raw({ type: "application/*", limit: "10mb" }));
	app.use(cors());

	// Basic message to verify REST API is available
	// You can see the message by going to http://localhost:<port>/api
	app.get("/api", (_req: Request, res: Response) => {
		res.send("App is running!");
	});

	//  minimal adapter for search API (CAN BE REMOVED LATER after having formal service class)
	const defaultGetAllCourseOfferingsRecords = async (): Promise<CourseOfferingsRecord[]> => {
		const courses = await courseRepo.listCourseData();
		const records: CourseOfferingsRecord[] = [];

		for (const course of courses) {
			for (const section of course.sections) {
				records.push({
					dept: course.dept,
					code: course.code,
					title: course.title,
					instructor: section.instructor,
					year: section.year,
					avg: section.avg,
					pass: section.pass,
					fail: section.fail,
					audit: section.audit,
				});
			}
		}

		return records;
	};

	const getAllFacilitiesRecords = async (): Promise<FacilitiesRecord[]> => {
		const buildings = await facilitiesDataModel.listBuildingData();
		const records: FacilitiesRecord[] = [];

		for (const building of buildings) {
			for (const room of building.rooms) {
				records.push({
					name: building.name,
					building: building.id,
					address: building.address,
					number: room.number,
					type: room.type,
					furniture: room.furniture,
					href: room.href,
					lat: building.lat,
					lon: building.lon,
					seats: room.seats,
				});
			}
		}

		return records;
	};

	// Middleware to wrap multer and convert errors to 422
	const multerMiddleware = (req: Request, res: Response, next: any) => {
		upload.single("archive")(req as any, res as any, (err: any) => {
			if (err) {
				res.status(422).json({
					error: "Validation failed",
					fields: {
						archive: "required but missing",
					},
				});
				return;
			}
			next();
		});
	};

	// Dataset upload API
	// POST /api/v1/datasets
	// Upload a dataset for processing
	app.post("/api/v1/datasets", multerMiddleware, async (req: Request, res: Response) => {
		const fields: Record<string, string> = {};
		const kindValue = req.body?.kind;

		if (kindValue === undefined || kindValue === null || kindValue === "") {
			fields.kind = "required but missing";
		} else if (kindValue !== "course_offerings") {
			fields.kind = "expected to be course_offerings";
		}

		if (!req.file || !req.file.buffer) {
			fields.archive = "required but missing";
		} else if (req.file.buffer.length === 0) {
			fields.archive = "expected non-empty file";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).json({
				error: "Validation failed",
				fields,
			});
			return;
		}

		// Accept the file for processing - validation happens in background job
		// Create upload job and start processing
		const jobId = await datasetManager.createUploadJob(req.file!.buffer, "course_offerings");

		// Return 202 Accepted with job information
		res.status(202).json({
			id: jobId,
			status: "processing",
			kind: "course_offerings",
			message: "Dataset accepted for processing",
		});
	});

	// GET /api/v1/datasets/{id}
	// Check the status of a dataset upload job
	app.get("/api/v1/datasets/:id", async (req: Request, res: Response) => {
		const job = await datasetManager.getJob(req.params.id);

		if (!job) {
			res.status(404).json({
				error: "Not found",
				message: `no dataset with id '${req.params.id}'`,
			});
			return;
		}

		res.status(200).json(job);
	});

	// Version 2
	// Bulk dataset upload API
	// POST /api/v2/datasets
	app.post("/api/v2/datasets", multerMiddleware, async (req: Request, res: Response) => {
		const fields: Record<string, string> = {};
		const kindValue = req.body?.kind;

		if (kindValue === undefined || kindValue === null || kindValue === "") {
			fields.kind = "required but missing";
		} else if (!["course_offerings", "facilities"].includes(kindValue)) {
			fields.kind = "expected to be course_offerings or facilities";
		}

		if (!req.file || !req.file.buffer) {
			fields.archive = "required but missing";
		} else if (req.file.buffer.length === 0) {
			fields.archive = "expected non-empty file";
		}

		if (Object.keys(fields).length > 0) {
			res.status(422).json({ error: "Validation failed", fields });
			return;
		}

		const kind = kindValue as "course_offerings" | "facilities";
		const jobId = await datasetManager.createUploadJob(req.file!.buffer, kind);

		res.status(202).json({
			id: jobId,
			status: "processing",
			kind,
			message: "Dataset accepted for processing",
		});
	});

	// GET /api/v2/datasets/:id
	app.get("/api/v2/datasets/:id", async (req: Request, res: Response) => {
		const job = await datasetManager.getJob(req.params.id);

		if (!job) {
			res.status(404).json({
				error: "Not found",
				message: `no dataset with id '${req.params.id}'`,
			});
			return;
		}

		res.status(200).json(job);
	});

	// SEARCH API
	app.use(createSearchRouter(getAllSearchRecords ?? defaultGetAllCourseOfferingsRecords, getAllFacilitiesRecords));

	// GET /api/v1/courses
	// Retrieve a paginated list of courses
	app.get("/api/v1/courses", parsePagination, courseController.listCourses);

	// GET /api/v1/courses/{course}
	// Retrieve a course
	app.get("/api/v1/courses/:course", courseController.getCourse);

	// PUT /api/v1/courses/{course}
	// Create or replace a course
	app.put("/api/v1/courses/:course", courseController.putCourse);

	// DELETE /api/v1/courses/{course}
	// Remove a course and its sections
	app.delete("/api/v1/courses/:course", courseController.deleteCourse);

	// GET /api/v1/courses/{course}/sections
	// Retrieve a paginated list of sections for a course
	app.get("/api/v1/courses/:course/sections", parsePagination, sectionController.listSections);

	// GET /api/v1/courses/{course}/sections/{section}
	// Retrieve section details
	app.get("/api/v1/courses/:course/sections/:section", sectionController.getSection);

	// PUT /api/v1/courses/{course}/sections/{section}
	// Create or update section information
	app.put("/api/v1/courses/:course/sections/:section", sectionController.putSection);

	// DELETE /api/v1/courses/{course}/sections/{section}
	// Remove a section
	app.delete("/api/v1/courses/:course/sections/:section", sectionController.deleteSection);

	// GET /api/v2/buildings
	// List all buildings
	app.get("/api/v2/buildings", async (req: Request, res: Response) => {
		const paginationValidation = validatePagination(req.query as Record<string, unknown>);
		if ("params" in paginationValidation) {
			res.status(400).json({
				error: "Invalid request parameters",
				params: paginationValidation.params,
			});
			return;
		}

		const buildings = await facilitiesDataModel.listBuildings();
		const { limit, offset } = paginationValidation.value;
		const items = buildings.slice(offset, offset + limit);
		res.status(200).json({
			total: buildings.length,
			limit,
			offset,
			items,
		});
	});

	// GET /api/v2/buildings/{building}
	// Get a building by id
	app.get("/api/v2/buildings/:building", async (req: Request, res: Response) => {
		const building = await facilitiesDataModel.getBuilding(req.params.building);
		if (building === undefined) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}
		res.status(200).json(building);
	});

	// PUT /api/v2/buildings/{building}
	// Create or replace a building
	app.put("/api/v2/buildings/:building", async (req: Request, res: Response) => {
		const validation = validateBuilding(req.body);
		if (!validation.valid) {
			res.status(422).json({
				error: "Validation failed",
				fields: validation.fields,
			});
			return;
		}

		const isNew = await facilitiesDataModel.putBuilding(
			req.params.building,
			req.body.name,
			req.body.address,
			req.body.lat,
			req.body.lon
		);

		if (isNew) {
			const building = await facilitiesDataModel.getBuilding(req.params.building);
			res.status(201).json(building);
		} else {
			res.status(204).send();
		}
	});

	// DELETE /api/v2/buildings/{building}
	// Remove a building and its rooms
	app.delete("/api/v2/buildings/:building", async (req: Request, res: Response) => {
		const removedBuilding = await facilitiesDataModel.removeBuilding(req.params.building);
		if (removedBuilding === undefined) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}

		res.status(200).json(removedBuilding);
	});

	// GET /api/v2/buildings/{building}/rooms
	// Retrieve a paginated list of rooms for a building
	app.get("/api/v2/buildings/:building/rooms", async (req: Request, res: Response) => {
		const paginationValidation = validatePagination(req.query as Record<string, unknown>);
		if ("params" in paginationValidation) {
			const invalidParams = paginationValidation.params;
			res.status(400).json({
				error: "Invalid request parameters",
				params: invalidParams,
			});
			return;
		}

		const rooms = await facilitiesDataModel.listRooms(req.params.building);
		if (rooms === undefined) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}

		const { limit, offset } = paginationValidation.value;
		const items = rooms.slice(offset, offset + limit);
		res.status(200).json({
			items,
			total: rooms.length,
			limit,
			offset,
		});
	});

	// GET /api/v2/buildings/{building}/rooms/{room}
	// Retrieve room details
	app.get("/api/v2/buildings/:building/rooms/:room", async (req: Request, res: Response) => {
		const room = await facilitiesDataModel.getRoom(req.params.building, req.params.room);
		if (room === undefined) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}

		if (room === null) {
			res.status(404).json({
				error: "Not found",
				message: `no room with id '${req.params.room}'`,
			});
			return;
		}

		res.status(200).json(room);
	});

	// PUT /api/v2/buildings/{building}/rooms/{room}
	// Create or update room information
	app.put("/api/v2/buildings/:building/rooms/:room", async (req: Request, res: Response) => {
		const validation = validateRoom(req.body, req.params.building);
		if (!validation.valid) {
			res.status(422).json({
				error: "Validation failed",
				fields: validation.fields,
			});
			return;
		}

		const result = await facilitiesDataModel.putRoom(
			req.params.building,
			req.params.room,
			req.body.building,
			req.body.number,
			req.body.type,
			req.body.furniture,
			req.body.href,
			req.body.seats
		);

		if (result === null) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}

		if (result) {
			const room = await facilitiesDataModel.getRoom(req.params.building, req.params.room);
			res.status(201).json(room);
		} else {
			res.status(204).send();
		}
	});

	// DELETE /api/v2/buildings/{building}/rooms/{room}
	// Remove a room from a building
	app.delete("/api/v2/buildings/:building/rooms/:room", async (req: Request, res: Response) => {
		const room = await facilitiesDataModel.removeRoom(req.params.building, req.params.room);
		if (room === undefined) {
			res.status(404).json({
				error: "Not found",
				message: `no building with id '${req.params.building}'`,
			});
			return;
		}

		if (room === null) {
			res.status(404).json({
				error: "Not found",
				message: `no room with id '${req.params.room}'`,
			});
			return;
		}

		res.status(200).json(room);
	});

	app.use(handleErrors);

	return app;
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
