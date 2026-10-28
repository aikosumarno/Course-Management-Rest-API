//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted in extracting the pagination parsing logic into middleware
import { RequestHandler } from "express";
import { InvalidRequestError } from "../errors/domainErrors";
import { validatePagination } from "../Validation";

export const parsePagination: RequestHandler = (req, _res, next) => {
	const validation = validatePagination(req.query as Record<string, unknown>);
	if (!validation.valid) {
		throw new InvalidRequestError(validation.params);
	}

	(req as any).pagination = validation.value;
	next();
};

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
