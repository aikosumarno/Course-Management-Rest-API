//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with creating validation functions for request bodies,
// implementing type checking logic, and ensuring correct error messages

// Check if a value is an integer
export function isInteger(value: any): boolean {
	return Number.isInteger(value);
}

export interface ValidationResult {
	valid: boolean;
	fields?: Record<string, string>;
}

export interface PaginationParams {
	limit: number;
	offset: number;
}

type PaginationErrorParams = {
	limit?: "expected an integer between 1 and 5000";
	offset?: "expected an integer >= 0";
};

export type PaginationValidationResult =
	| {
			valid: false;
			params: PaginationErrorParams;
	  }
	| {
			valid: true;
			value: PaginationParams;
	  };

function getSingleQueryValue(value: unknown): string | undefined {
	if (Array.isArray(value)) {
		const first = value[0];
		return typeof first === "string" ? first : undefined;
	}

	if (typeof value === "string") {
		return value;
	}

	return undefined;
}

function parseStrictInteger(value: string): number | undefined {
	if (!/^\d+$/.test(value)) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	if (!Number.isSafeInteger(parsed)) {
		return undefined;
	}

	return parsed;
}

export function validatePagination(query: Record<string, unknown>): PaginationValidationResult {
	const params: PaginationErrorParams = {};

	let limit = 100;
	let offset = 0;

	const rawLimit = getSingleQueryValue(query.limit);
	if (rawLimit !== undefined) {
		const parsed = parseStrictInteger(rawLimit);
		if (parsed === undefined || parsed < 1 || parsed > 5000) {
			params.limit = "expected an integer between 1 and 5000";
		} else {
			limit = parsed;
		}
	}

	const rawOffset = getSingleQueryValue(query.offset);
	if (rawOffset !== undefined) {
		const parsed = parseStrictInteger(rawOffset);
		if (parsed === undefined) {
			params.offset = "expected an integer >= 0";
		} else {
			offset = parsed;
		}
	}

	if (Object.keys(params).length > 0) {
		return { valid: false, params };
	}

	return {
		valid: true,
		value: { limit, offset },
	};
}

function parsePositiveInteger(value: unknown, fallback: number): number {
	if (Array.isArray(value)) {
		return parsePositiveInteger(value[0], fallback);
	}

	if (typeof value !== "string") {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) {
		return fallback;
	}

	return parsed;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
	const limit = parsePositiveInteger(query.limit, 100);
	const offset = parsePositiveInteger(query.offset, 0);

	return { limit, offset };
}

// Validate course body
export function validateCourse(body: any): ValidationResult {
	const fields: Record<string, string> = {};

	if (typeof body !== "object" || body === null) {
		return { valid: false, fields: { body: "expected an object" } };
	}
	if (body.title === undefined || body.title === null) {
		fields.title = "required but missing";
	} else if (typeof body.title !== "string") {
		fields.title = "expected a string";
	}

	if (body.dept === undefined || body.dept === null) {
		fields.dept = "required but missing";
	} else if (typeof body.dept !== "string") {
		fields.dept = "expected a string";
	}

	if (body.code === undefined || body.code === null) {
		fields.code = "required but missing";
	} else if (typeof body.code !== "string") {
		fields.code = "expected a string";
	}

	return {
		valid: Object.keys(fields).length === 0,
		fields: Object.keys(fields).length > 0 ? fields : undefined,
	};
}

// Validate section body
export function validateSection(body: any): ValidationResult {
	// store error messages for each field as an array
	const fields: Record<string, string> = {};

	if (typeof body !== "object" || body === null) {
		return { valid: false, fields: { body: "expected an object" } };
	}

	if (body.instructor === undefined || body.instructor === null) {
		fields.instructor = "required but missing";
	} else if (typeof body.instructor !== "string") {
		fields.instructor = "expected a string";
	} else if (body.instructor.trim() === "") {
		fields.instructor = "required but missing";
	}

	if (body.year === undefined || body.year === null) {
		fields.year = "required but missing";
	} else if (!isInteger(body.year)) {
		fields.year = "expected a number between 1900 and 2099";
	} else if (body.year < 1900 || body.year > 2099) {
		fields.year = "expected a number between 1900 and 2099";
	}

	if (body.avg === undefined || body.avg === null) {
		fields.avg = "required but missing";
	} else if (typeof body.avg !== "number") {
		fields.avg = "expected a number between 0 and 100";
	} else if (body.avg < 0 || body.avg > 100) {
		fields.avg = "expected a number between 0 and 100";
	}

	if (body.pass === undefined || body.pass === null) {
		fields.pass = "required but missing";
	} else if (!isInteger(body.pass)) {
		fields.pass = "expected a number >= 0";
	} else if (body.pass < 0) {
		fields.pass = "expected a number >= 0";
	}

	if (body.fail === undefined || body.fail === null) {
		fields.fail = "required but missing";
	} else if (!isInteger(body.fail)) {
		fields.fail = "expected a number >= 0";
	} else if (body.fail < 0) {
		fields.fail = "expected a number >= 0";
	}

	if (body.audit === undefined || body.audit === null) {
		fields.audit = "required but missing";
	} else if (!isInteger(body.audit)) {
		fields.audit = "expected a number >= 0";
	} else if (body.audit < 0) {
		fields.audit = "expected a number >= 0";
	}

	return {
		valid: Object.keys(fields).length === 0,
		fields: Object.keys(fields).length > 0 ? fields : undefined,
	};
}

export function validateBuilding(body: any): ValidationResult {
	const fields: Record<string, string> = {};

	if (typeof body !== "object" || body === null) {
		return { valid: false, fields: { body: "expected an object" } };
	}

	if (body.name === undefined || body.name === null) {
		fields.name = "required but missing";
	} else if (typeof body.name !== "string") {
		fields.name = "expected a string";
	} else if (body.name.trim() === "") {
		fields.name = "required but missing";
	}

	if (body.address === undefined || body.address === null) {
		fields.address = "required but missing";
	} else if (typeof body.address !== "string") {
		fields.address = "expected a string";
	} else if (body.address.trim() === "") {
		fields.address = "required but missing";
	}

	if (body.lat === undefined || body.lat === null) {
		fields.lat = "required but missing";
	} else if (typeof body.lat !== "number" || Number.isNaN(body.lat)) {
		fields.lat = "expected a number";
	}

	if (body.lon === undefined || body.lon === null) {
		fields.lon = "required but missing";
	} else if (typeof body.lon !== "number" || Number.isNaN(body.lon)) {
		fields.lon = "expected a number";
	}

	return {
		valid: Object.keys(fields).length === 0,
		fields: Object.keys(fields).length > 0 ? fields : undefined,
	};
}

export function validateRoom(body: any, pathBuilding?: string): ValidationResult {
	const fields: Record<string, string> = {};

	if (typeof body !== "object" || body === null) {
		return { valid: false, fields: { body: "expected an object" } };
	}

	if (body.building === undefined || body.building === null) {
		fields.building = "required but missing";
	} else if (typeof body.building !== "string") {
		fields.building = "expected a string";
	} else if (body.building.trim() === "") {
		fields.building = "required but missing";
	} else if (pathBuilding !== undefined && body.building !== pathBuilding) {
		fields.building = "must match parent building in path";
	}

	if (body.number === undefined || body.number === null) {
		fields.number = "required but missing";
	} else if (typeof body.number !== "string") {
		fields.number = "expected a string";
	} else if (body.number.trim() === "") {
		fields.number = "required but missing";
	}

	if (body.type === undefined || body.type === null) {
		fields.type = "required but missing";
	} else if (typeof body.type !== "string") {
		fields.type = "expected a string";
	}
	// Note: empty string is allowed (for bulk uploads)

	if (body.furniture === undefined || body.furniture === null) {
		fields.furniture = "required but missing";
	} else if (typeof body.furniture !== "string") {
		fields.furniture = "expected a string";
	}
	// Note: empty string is allowed (for bulk uploads)

	if (body.href === undefined || body.href === null) {
		fields.href = "required but missing";
	} else if (typeof body.href !== "string") {
		fields.href = "expected a string";
	} else if (body.href.trim() === "") {
		fields.href = "required but missing";
	}

	if (body.seats === undefined || body.seats === null) {
		fields.seats = "required but missing";
	} else if (!isInteger(body.seats)) {
		fields.seats = "expected a number >= 0";
	} else if (body.seats < 0) {
		fields.seats = "expected a number >= 0";
	}

	return {
		valid: Object.keys(fields).length === 0,
		fields: Object.keys(fields).length > 0 ? fields : undefined,
	};
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
