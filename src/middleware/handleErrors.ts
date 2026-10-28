//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with implementing centralized error handling middleware
// and mapping domain errors to appropriate HTTP responses

import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { NotFoundError, ValidationError, TooManyResultsError, InvalidRequestError } from "../errors/domainErrors";

export const handleErrors: ErrorRequestHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
	if (err instanceof NotFoundError) {
		res.status(404).json({ error: "Not found", message: err.message });
		return;
	}

	if (err instanceof ValidationError) {
		res.status(422).json({ error: "Validation failed", message: err.message });
		return;
	}

	if (err instanceof InvalidRequestError) {
		res.status(400).json({ error: "Invalid request parameters", params: err.params });
		return;
	}

	if (err instanceof TooManyResultsError) {
		res.status(413).json({
			error: "Too many results",
			message: err.message,
			limit: 5000,
		});
		return;
	}

	// Default to 500 for unknown errors
	res.status(500).json({ error: "Internal server error" });
};
