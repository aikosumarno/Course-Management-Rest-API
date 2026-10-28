//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI helped implement the search routing logic, request body validation,
// and error response formatting for both v1 and v2 search endpoints.

import { Router } from "express";
import {
	CourseOfferingsRecord,
	FacilitiesRecord,
	QuerySyntaxError,
	RequestValidationError,
	SearchService,
	TooManyResultsError,
} from "./Search";

const MAX_RESULTS = 5000;

type SearchRequestBody = {
	kind?: unknown;
	query?: unknown;
};

function validateSearchRequestBodyV1(body: unknown): asserts body is { kind: "course_offerings"; query: unknown } {
	const fields: {
		kind?: "required but missing" | "expected to be course_offerings or facilities";
		query?: "required but missing" | "expected an object";
	} = {};

	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		fields.kind = "required but missing";
		fields.query = "required but missing";
		throw new RequestValidationError(fields);
	}

	const searchBody = body as SearchRequestBody;

	if (searchBody.kind === undefined) {
		fields.kind = "required but missing";
	} else if (searchBody.kind !== "course_offerings") {
		fields.kind = "expected to be course_offerings or facilities";
	}

	if (searchBody.query === undefined) {
		fields.query = "required but missing";
	} else if (typeof searchBody.query !== "object" || searchBody.query === null || Array.isArray(searchBody.query)) {
		fields.query = "expected an object";
	}

	if (Object.keys(fields).length > 0) {
		throw new RequestValidationError(fields);
	}
}

function validateSearchRequestBodyV2(
	body: unknown
): asserts body is { kind: "course_offerings" | "facilities"; query: unknown } {
	const fields: {
		kind?: "required but missing" | "expected to be course_offerings or facilities";
		query?: "required but missing" | "expected an object";
	} = {};

	if (typeof body !== "object" || body === null || Array.isArray(body)) {
		fields.kind = "required but missing";
		fields.query = "required but missing";
		throw new RequestValidationError(fields);
	}

	const searchBody = body as SearchRequestBody;

	if (searchBody.kind === undefined) {
		fields.kind = "required but missing";
	} else if (searchBody.kind !== "course_offerings" && searchBody.kind !== "facilities") {
		fields.kind = "expected to be course_offerings or facilities";
	}

	if (searchBody.query === undefined) {
		fields.query = "required but missing";
	} else if (typeof searchBody.query !== "object" || searchBody.query === null || Array.isArray(searchBody.query)) {
		fields.query = "expected an object";
	}

	if (Object.keys(fields).length > 0) {
		throw new RequestValidationError(fields);
	}
}

export function createSearchRouter(
	getAllCourseOfferingsRecords: () => Promise<CourseOfferingsRecord[]>,
	getAllFacilitiesRecords?: () => Promise<FacilitiesRecord[]>
): Router {
	const router = Router();
	const searchService = new SearchService();

	// v1 endpoint - only supports course_offerings
	router.post("/api/v1/search", async (req, res) => {
		try {
			validateSearchRequestBodyV1(req.body);

			const records = await getAllCourseOfferingsRecords();
			const results = searchService.execute(req.body.query, records, "course_offerings");

			if (results.length > MAX_RESULTS) {
				throw new TooManyResultsError("Query produced too many results");
			}

			res.status(200).json(results);
		} catch (error) {
			if (error instanceof RequestValidationError) {
				res.status(422).json({ error: "Validation failed", fields: error.fields });
				return;
			}

			if (error instanceof QuerySyntaxError) {
				res.status(400).json({ error: "Invalid query", message: error.message });
				return;
			}

			if (error instanceof TooManyResultsError) {
				res.status(413).json({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: MAX_RESULTS,
				});
				return;
			}

			res.status(500).json({ error: "Internal server error" });
		}
	});

	// v2 endpoint - supports both course_offerings and facilities
	router.post("/api/v2/search", async (req, res) => {
		try {
			validateSearchRequestBodyV2(req.body);

			const kind = req.body.kind;
			let records: Array<CourseOfferingsRecord | FacilitiesRecord>;

			if (kind === "course_offerings") {
				records = await getAllCourseOfferingsRecords();
			} else {
				// facilities
				if (!getAllFacilitiesRecords) {
					res.status(500).json({ error: "Facilities data not available" });
					return;
				}
				records = await getAllFacilitiesRecords();
			}

			const results = searchService.execute(req.body.query, records, kind);

			if (results.length > MAX_RESULTS) {
				throw new TooManyResultsError("Query produced too many results");
			}

			res.status(200).json(results);
		} catch (error) {
			if (error instanceof RequestValidationError) {
				res.status(422).json({ error: "Validation failed", fields: error.fields });
				return;
			}

			if (error instanceof QuerySyntaxError) {
				res.status(400).json({ error: "Invalid query", message: error.message });
				return;
			}

			if (error instanceof TooManyResultsError) {
				res.status(413).json({
					error: "Too many results",
					message: "Query would return more than 5000 results",
					limit: MAX_RESULTS,
				});
				return;
			}

			res.status(500).json({ error: "Internal server error" });
		}
	});

	return router;
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
