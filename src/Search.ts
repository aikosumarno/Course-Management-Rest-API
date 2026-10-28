//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI helped implement the query DSL parser, GROUP/APPLY aggregations,
// field validation, and ensuring all error messages match the specification

import Decimal from "decimal.js";

export interface CourseOfferingsRecord {
	dept: string;
	code: string;
	title: string;
	instructor: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface FacilitiesRecord {
	name: string;
	building: string;
	address: string;
	number: string;
	type: string;
	furniture: string;
	href: string;
	lat: number;
	lon: number;
	seats: number;
}

// For backwards compatibility
export type SearchRecord = CourseOfferingsRecord;

type CourseOfferingsNumericField = "avg" | "pass" | "fail" | "audit" | "year";
type CourseOfferingsStringField = "title" | "dept" | "code" | "instructor";
type CourseOfferingsField = CourseOfferingsNumericField | CourseOfferingsStringField;

type FacilitiesNumericField = "lat" | "lon" | "seats";
type FacilitiesStringField = "address" | "building" | "furniture" | "href" | "name" | "number" | "type";
type FacilitiesField = FacilitiesNumericField | FacilitiesStringField;

type NumericField = CourseOfferingsNumericField | FacilitiesNumericField;
type StringField = CourseOfferingsStringField | FacilitiesStringField;
type SearchField = CourseOfferingsField | FacilitiesField;

type QueryFilterNode =
	| { type: "ALL" }
	| { type: "AND"; children: QueryFilterNode[] }
	| { type: "OR"; children: QueryFilterNode[] }
	| { type: "NOT"; child: QueryFilterNode }
	| { type: "LT"; key: NumericField; value: number }
	| { type: "GT"; key: NumericField; value: number }
	| { type: "EQ"; key: NumericField; value: number }
	| { type: "IS"; key: StringField; value: string };

type ApplyToken = "MAX" | "MIN" | "AVG" | "COUNT" | "SUM";

interface ApplyRule {
	applyKey: string;
	applyToken: ApplyToken;
	key: SearchField;
}

interface Transformations {
	GROUP: SearchField[];
	APPLY: ApplyRule[];
}

interface QueryOrder {
	dir: "UP" | "DOWN";
	keys: string[];
}

interface QueryOptions {
	COLUMNS: string[];
	ORDER?: string | QueryOrder;
}

interface ValidatedQuery {
	WHERE: Record<string, unknown>;
	OPTIONS: QueryOptions;
	TRANSFORMATIONS?: Transformations;
}

export type SearchRequestValidationFields = {
	kind?: "required but missing" | "expected to be course_offerings or facilities";
	query?: "required but missing" | "expected an object";
};

export class RequestValidationError extends Error {
	public readonly fields: SearchRequestValidationFields;

	constructor(fields: SearchRequestValidationFields) {
		super("Validation failed");
		this.name = "RequestValidationError";
		this.fields = fields;
	}
}

export class QuerySyntaxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "QuerySyntaxError";
	}
}

export class TooManyResultsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TooManyResultsError";
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedWildcardPattern(input: string): boolean {
	const first = input.indexOf("*");
	if (first === -1) {
		return true;
	}

	for (let idx = 0; idx < input.length; idx++) {
		if (input[idx] === "*" && idx !== 0 && idx !== input.length - 1) {
			return false;
		}
	}

	if (input.length > 1 && input[0] === "*" && input[1] === "*") {
		return false;
	}

	if (input.length > 1 && input[input.length - 1] === "*" && input[input.length - 2] === "*") {
		return false;
	}

	return true;
}

const COURSE_OFFERINGS_NUMERIC_FIELDS: CourseOfferingsNumericField[] = ["avg", "pass", "fail", "audit", "year"];
const COURSE_OFFERINGS_STRING_FIELDS: CourseOfferingsStringField[] = ["title", "dept", "code", "instructor"];
const COURSE_OFFERINGS_FIELDS: CourseOfferingsField[] = [
	...COURSE_OFFERINGS_NUMERIC_FIELDS,
	...COURSE_OFFERINGS_STRING_FIELDS,
];

const FACILITIES_NUMERIC_FIELDS: FacilitiesNumericField[] = ["lat", "lon", "seats"];
const FACILITIES_STRING_FIELDS: FacilitiesStringField[] = [
	"address",
	"building",
	"furniture",
	"href",
	"name",
	"number",
	"type",
];
const FACILITIES_FIELDS: FacilitiesField[] = [...FACILITIES_NUMERIC_FIELDS, ...FACILITIES_STRING_FIELDS];

function checkForMixedFields(usedFields: string[], kind: "course_offerings" | "facilities"): void {
	const expectedFields = kind === "course_offerings" ? COURSE_OFFERINGS_FIELDS : FACILITIES_FIELDS;
	const oppositeFields = kind === "course_offerings" ? FACILITIES_FIELDS : COURSE_OFFERINGS_FIELDS;

	for (const field of usedFields) {
		if ((oppositeFields as readonly string[]).includes(field)) {
			throw new QuerySyntaxError("Cannot mix course_offerings and facilities fields in one query");
		}
	}
}

function assertFilter(filter: unknown, kind: "course_offerings" | "facilities"): void {
	if (!isPlainObject(filter)) {
		throw new QuerySyntaxError("WHERE must be an object with at most one FILTER");
	}

	const entries = Object.entries(filter);
	if (entries.length !== 1) {
		throw new QuerySyntaxError("WHERE must be an object with at most one FILTER");
	}

	const [op, value] = entries[0];

	const numericFields = kind === "course_offerings" ? COURSE_OFFERINGS_NUMERIC_FIELDS : FACILITIES_NUMERIC_FIELDS;
	const stringFields = kind === "course_offerings" ? COURSE_OFFERINGS_STRING_FIELDS : FACILITIES_STRING_FIELDS;

	if (op === "AND" || op === "OR") {
		if (!Array.isArray(value) || value.length === 0) {
			throw new QuerySyntaxError(`${op} must be a non-empty array of FILTER objects`);
		}

		for (const child of value) {
			if (!isPlainObject(child)) {
				throw new QuerySyntaxError(`${op} must be a non-empty array of FILTER objects`);
			}
		}

		for (const child of value) {
			assertFilter(child, kind);
		}
		return;
	}

	if (op === "NOT") {
		if (!isPlainObject(value)) {
			throw new QuerySyntaxError("NOT must be a FILTER object");
		}
		assertFilter(value, kind);
		return;
	}

	if (op === "LT" || op === "GT" || op === "EQ") {
		if (!isPlainObject(value)) {
			throw new QuerySyntaxError(`${op} must be an object with one mfield of type number`);
		}

		const comparisonEntries = Object.entries(value);
		if (comparisonEntries.length !== 1) {
			throw new QuerySyntaxError(`${op} must be an object with one mfield of type number`);
		}

		const [field, comparisonValue] = comparisonEntries[0];
		if (!(numericFields as readonly string[]).includes(field)) {
			throw new QuerySyntaxError(`${op} must be an object with one mfield of type number`);
		}

		if (typeof comparisonValue !== "number" || Number.isNaN(comparisonValue)) {
			throw new QuerySyntaxError(`${op} must be an object with one mfield of type number`);
		}
		return;
	}

	if (op === "IS") {
		if (!isPlainObject(value)) {
			throw new QuerySyntaxError("IS must be an object with one sfield of type string");
		}

		const comparisonEntries = Object.entries(value);
		if (comparisonEntries.length !== 1) {
			throw new QuerySyntaxError("IS must be an object with one sfield of type string");
		}

		const [field, comparisonValue] = comparisonEntries[0];
		if (!(stringFields as readonly string[]).includes(field)) {
			throw new QuerySyntaxError("IS must be an object with one sfield of type string");
		}

		if (typeof comparisonValue !== "string") {
			throw new QuerySyntaxError("IS must be an object with one sfield of type string");
		}

		if (!isAllowedWildcardPattern(comparisonValue)) {
			throw new QuerySyntaxError("IS asterisks can only be first or last character");
		}
		return;
	}

	throw new QuerySyntaxError("WHERE must be an object with at most one FILTER");
}

function assertTransformations(
	transformations: unknown,
	kind: "course_offerings" | "facilities"
): asserts transformations is Transformations {
	if (!isPlainObject(transformations)) {
		throw new QuerySyntaxError("TRANSFORMATIONS must be an object");
	}

	if (transformations.GROUP === undefined) {
		throw new QuerySyntaxError("Missing GROUP in TRANSFORMATIONS");
	}

	if (transformations.APPLY === undefined) {
		throw new QuerySyntaxError("Missing APPLY in TRANSFORMATIONS");
	}

	const allFields = kind === "course_offerings" ? COURSE_OFFERINGS_FIELDS : FACILITIES_FIELDS;
	const numericFields = kind === "course_offerings" ? COURSE_OFFERINGS_NUMERIC_FIELDS : FACILITIES_NUMERIC_FIELDS;

	// Validate GROUP
	if (!Array.isArray(transformations.GROUP) || transformations.GROUP.length === 0) {
		throw new QuerySyntaxError("GROUP must be a non-empty array");
	}

	for (const key of transformations.GROUP) {
		if (typeof key !== "string" || !(allFields as readonly string[]).includes(key)) {
			throw new QuerySyntaxError("GROUP keys must be valid fields");
		}
	}

	// Validate APPLY
	if (!Array.isArray(transformations.APPLY)) {
		throw new QuerySyntaxError("APPLY must be an array");
	}

	const seenApplyKeys = new Set<string>();

	for (const rule of transformations.APPLY) {
		if (!isPlainObject(rule)) {
			throw new QuerySyntaxError("APPLY rule must be an object");
		}

		const entries = Object.entries(rule);
		if (entries.length !== 1) {
			throw new QuerySyntaxError("APPLY rule must have exactly one key");
		}

		const [applyKey, tokenObj] = entries[0];

		// Check applykey is not empty and doesn't contain underscore
		if (!applyKey || applyKey.includes("_")) {
			throw new QuerySyntaxError("applykey cannot be empty or contain underscore");
		}

		// Check for duplicate applykeys
		if (seenApplyKeys.has(applyKey)) {
			throw new QuerySyntaxError("Duplicate applykey in APPLY");
		}
		seenApplyKeys.add(applyKey);

		if (!isPlainObject(tokenObj)) {
			throw new QuerySyntaxError("APPLY token must be an object");
		}

		const tokenEntries = Object.entries(tokenObj);
		if (tokenEntries.length !== 1) {
			throw new QuerySyntaxError("APPLY token must have exactly one entry");
		}

		const [token, key] = tokenEntries[0];

		if (!["MAX", "MIN", "AVG", "SUM", "COUNT"].includes(token)) {
			throw new QuerySyntaxError("Invalid APPLYTOKEN (must be MAX, MIN, AVG, COUNT, or SUM)");
		}

		if (typeof key !== "string" || !(allFields as readonly string[]).includes(key)) {
			throw new QuerySyntaxError("APPLYRULE must apply aggregation to a valid KEY");
		}

		// MAX, MIN, AVG, SUM must use numeric fields
		if (["MAX", "MIN", "AVG", "SUM"].includes(token) && !(numericFields as readonly string[]).includes(key)) {
			throw new QuerySyntaxError("MAX/MIN/AVG/SUM can only be applied to mfields");
		}
	}
}

function assertOptions(
	options: unknown,
	kind: "course_offerings" | "facilities",
	transformations?: Transformations
): asserts options is QueryOptions {
	if (!isPlainObject(options)) {
		throw new QuerySyntaxError("OPTIONS must be an object with COLUMNS and optional ORDER");
	}

	const columns = options.COLUMNS;
	if (columns === undefined) {
		throw new QuerySyntaxError("Missing COLUMNS");
	}

	if (!Array.isArray(columns) || columns.length === 0) {
		throw new QuerySyntaxError("OPTIONS must be an object with COLUMNS and optional ORDER");
	}

	const allFields = kind === "course_offerings" ? COURSE_OFFERINGS_FIELDS : FACILITIES_FIELDS;
	const applyKeys = transformations ? transformations.APPLY.map((r) => r.applyKey) : [];
	const groupKeys = transformations ? transformations.GROUP : [];

	for (const column of columns) {
		if (typeof column !== "string") {
			throw new QuerySyntaxError("Unknown key in COLUMNS");
		}

		if (transformations) {
			// With transformations: columns must be in GROUP or APPLY
			if (!(groupKeys as string[]).includes(column) && !(applyKeys as string[]).includes(column)) {
				throw new QuerySyntaxError("When TRANSFORMATIONS is present, all COLUMNS must be in GROUP or APPLY");
			}
		} else {
			// Without transformations: columns must be valid fields
			if (!(allFields as readonly string[]).includes(column)) {
				throw new QuerySyntaxError("Unknown key in COLUMNS");
			}
		}
	}

	if (options.ORDER !== undefined) {
		// ORDER can be string or object
		if (typeof options.ORDER === "string") {
			if (!columns.includes(options.ORDER)) {
				throw new QuerySyntaxError("ORDER must be a key in COLUMNS");
			}
		} else if (isPlainObject(options.ORDER)) {
			const orderObj = options.ORDER as any;

			if (orderObj.dir === undefined || orderObj.keys === undefined) {
				throw new QuerySyntaxError("ORDER object must have dir and keys");
			}

			if (orderObj.dir !== "UP" && orderObj.dir !== "DOWN") {
				throw new QuerySyntaxError("Invalid sort direction (must be UP or DOWN)");
			}

			if (!Array.isArray(orderObj.keys) || orderObj.keys.length === 0) {
				throw new QuerySyntaxError("ORDER keys must be a non-empty array");
			}

			for (const key of orderObj.keys) {
				if (typeof key !== "string" || !columns.includes(key)) {
					throw new QuerySyntaxError("All ORDER keys must be in COLUMNS");
				}
			}
		} else {
			throw new QuerySyntaxError("ORDER must be a string or object");
		}
	}
}

function validateQuery(raw: unknown, kind: "course_offerings" | "facilities"): ValidatedQuery {
	if (!isPlainObject(raw)) {
		throw new QuerySyntaxError("Missing WHERE");
	}

	const where = raw.WHERE;
	const options = raw.OPTIONS;
	const transformations = raw.TRANSFORMATIONS;

	if (where === undefined) {
		throw new QuerySyntaxError("Missing WHERE");
	}

	if (options === undefined) {
		throw new QuerySyntaxError("Missing OPTIONS");
	}

	if (!isPlainObject(where)) {
		throw new QuerySyntaxError("WHERE must be an object with at most one FILTER");
	}

	if (Object.keys(where).length > 0) {
		assertFilter(where, kind);
	}

	let parsedTransformations: Transformations | undefined;
	if (transformations !== undefined) {
		assertTransformations(transformations, kind);
		// Parse APPLY rules
		const applyRules: ApplyRule[] = [];
		for (const rule of (transformations as any).APPLY) {
			const [[applyKey, tokenObj]] = Object.entries(rule);
			const [[applyToken, key]] = Object.entries(tokenObj as any);
			applyRules.push({
				applyKey,
				applyToken: applyToken as ApplyToken,
				key: key as SearchField,
			});
		}
		parsedTransformations = {
			GROUP: [...(transformations as any).GROUP],
			APPLY: applyRules,
		};
	}

	assertOptions(options, kind, parsedTransformations);

	// Check for mixed fields
	const usedFields: string[] = [];

	// Collect fields from COLUMNS
	usedFields.push(...(options as any).COLUMNS);

	// Collect fields from ORDER (if it's a string)
	if ((options as any).ORDER && typeof (options as any).ORDER === "string") {
		usedFields.push((options as any).ORDER);
	}

	// Collect fields from GROUP and APPLY keys
	if (parsedTransformations) {
		usedFields.push(...parsedTransformations.GROUP);
		for (const rule of parsedTransformations.APPLY) {
			usedFields.push(rule.key);
		}
	}

	// Filter out applykeys (they're not field names)
	const applyKeys = parsedTransformations ? parsedTransformations.APPLY.map((r) => r.applyKey) : [];
	const actualFields = usedFields.filter((f) => !applyKeys.includes(f));

	checkForMixedFields(actualFields, kind);

	return {
		WHERE: where,
		OPTIONS: {
			COLUMNS: [...(options as any).COLUMNS],
			ORDER: (options as any).ORDER,
		},
		TRANSFORMATIONS: parsedTransformations,
	};
}

function parseFilter(rawFilter: Record<string, unknown>): QueryFilterNode {
	const [op, value] = Object.entries(rawFilter)[0];

	if (op === "AND" || op === "OR") {
		const children = (value as Record<string, unknown>[]).map((child) => parseFilter(child));
		return { type: op, children };
	}

	if (op === "NOT") {
		return {
			type: "NOT",
			child: parseFilter(value as Record<string, unknown>),
		};
	}

	if (op === "LT" || op === "GT" || op === "EQ") {
		const [key, comparisonValue] = Object.entries(value as Record<string, number>)[0];
		return {
			type: op,
			key: key as NumericField,
			value: comparisonValue,
		};
	}

	const [key, pattern] = Object.entries(value as Record<string, string>)[0];
	return {
		type: "IS",
		key: key as StringField,
		value: pattern,
	};
}

function parseWhere(where: Record<string, unknown>): QueryFilterNode {
	if (Object.keys(where).length === 0) {
		return { type: "ALL" };
	}

	return parseFilter(where);
}

function matchesWildcard(input: string, pattern: string): boolean {
	const startsWithWildcard = pattern.startsWith("*");
	const endsWithWildcard = pattern.endsWith("*");
	const core = pattern.replace(/^\*/, "").replace(/\*$/, "");

	if (startsWithWildcard && endsWithWildcard) {
		return input.includes(core);
	}

	if (startsWithWildcard) {
		return input.endsWith(core);
	}

	if (endsWithWildcard) {
		return input.startsWith(core);
	}

	return input === core;
}

function evaluate(node: QueryFilterNode, record: CourseOfferingsRecord | FacilitiesRecord): boolean {
	switch (node.type) {
		case "ALL":
			return true;

		case "AND":
			return node.children.every((child) => evaluate(child, record));

		case "OR":
			return node.children.some((child) => evaluate(child, record));

		case "NOT":
			return !evaluate(node.child, record);

		case "LT":
			return (record as any)[node.key] < node.value;

		case "GT":
			return (record as any)[node.key] > node.value;

		case "EQ":
			return (record as any)[node.key] === node.value;

		case "IS":
			return matchesWildcard((record as any)[node.key], node.value);

		default:
			return false;
	}
}

function project(
	records: Array<CourseOfferingsRecord | FacilitiesRecord>,
	columns: string[]
): Array<Record<string, string | number>> {
	return records.map((record) => {
		const projected: Record<string, string | number> = {};
		for (const column of columns) {
			projected[column] = (record as any)[column];
		}
		return projected;
	});
}

function applyAggregation(group: Array<Record<string, string | number>>, rule: ApplyRule): number {
	const { applyToken, key } = rule;

	if (applyToken === "COUNT") {
		const uniqueValues = new Set();
		for (const record of group) {
			uniqueValues.add(record[key]);
		}
		return uniqueValues.size;
	}

	const values = group.map((r) => r[key] as number);

	if (applyToken === "MAX") {
		return Math.max(...values);
	}

	if (applyToken === "MIN") {
		return Math.min(...values);
	}

	if (applyToken === "SUM") {
		const sum = values.reduce((acc, val) => acc + val, 0);
		return Number(sum.toFixed(2));
	}

	if (applyToken === "AVG") {
		// Use Decimal.js per spec requirements
		let total = new Decimal(0);
		for (const value of values) {
			total = total.add(new Decimal(value));
		}
		const avg = total.toNumber() / values.length;
		return Number(avg.toFixed(2));
	}

	return 0;
}

function groupAndAggregate(
	records: Array<Record<string, string | number>>,
	transformations: Transformations
): Array<Record<string, string | number>> {
	const { GROUP, APPLY } = transformations;

	// Group records by GROUP keys
	const groups = new Map<string, Array<Record<string, string | number>>>();

	for (const record of records) {
		const groupKey = GROUP.map((key) => JSON.stringify(record[key])).join("|");
		if (!groups.has(groupKey)) {
			groups.set(groupKey, []);
		}
		groups.get(groupKey)!.push(record);
	}

	// Apply aggregation to each group
	const results: Array<Record<string, string | number>> = [];

	for (const group of groups.values()) {
		const result: Record<string, string | number> = {};

		// Add GROUP keys from the first record in the group
		for (const key of GROUP) {
			result[key] = group[0][key];
		}

		// Apply aggregation rules
		for (const rule of APPLY) {
			result[rule.applyKey] = applyAggregation(group, rule);
		}

		results.push(result);
	}

	return results;
}

function sortByMultipleKeys(
	records: Array<Record<string, string | number>>,
	order: QueryOrder
): Array<Record<string, string | number>> {
	const { dir, keys } = order;
	const multiplier = dir === "UP" ? 1 : -1;

	return [...records].sort((left, right) => {
		for (const key of keys) {
			const leftValue = left[key];
			const rightValue = right[key];

			let comparison = 0;

			if (typeof leftValue === "number" && typeof rightValue === "number") {
				comparison = leftValue - rightValue;
			} else {
				// Use < operator per spec, NOT localeCompare
				const leftStr = String(leftValue);
				const rightStr = String(rightValue);
				if (leftStr < rightStr) {
					comparison = -1;
				} else if (leftStr > rightStr) {
					comparison = 1;
				}
			}

			if (comparison !== 0) {
				return comparison * multiplier;
			}
		}

		return 0;
	});
}

export class SearchService {
	public execute(
		query: unknown,
		records: Array<CourseOfferingsRecord | FacilitiesRecord>,
		kind: "course_offerings" | "facilities"
	): Array<Record<string, string | number>> {
		const validated = validateQuery(query, kind);
		const whereNode = parseWhere(validated.WHERE);

		// Filter records by WHERE clause
		const filtered = records.filter((record) => evaluate(whereNode, record));

		let results: Array<Record<string, string | number>>;

		if (validated.TRANSFORMATIONS) {
			// Apply grouping and aggregation
			const projected = project(filtered, [
				...validated.TRANSFORMATIONS.GROUP,
				...validated.TRANSFORMATIONS.APPLY.map((r) => r.key),
			]);
			const grouped = groupAndAggregate(projected, validated.TRANSFORMATIONS);

			// Project to COLUMNS
			results = grouped.map((record) => {
				const projected: Record<string, string | number> = {};
				for (const column of validated.OPTIONS.COLUMNS) {
					projected[column] = record[column];
				}
				return projected;
			});
		} else {
			// No transformations - just project
			results = project(filtered, validated.OPTIONS.COLUMNS);
		}

		// Apply sorting
		if (validated.OPTIONS.ORDER !== undefined) {
			if (typeof validated.OPTIONS.ORDER === "string") {
				// Single key sorting
				return sortByMultipleKeys(results, {
					dir: "UP",
					keys: [validated.OPTIONS.ORDER],
				});
			} else {
				// Multi-key sorting
				return sortByMultipleKeys(results, validated.OPTIONS.ORDER);
			}
		}

		return results;
	}
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
