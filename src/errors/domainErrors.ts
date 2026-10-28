//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with implementing custom domain error classes
// for consistent error handling across the application

export class NotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "NotFoundError";
	}
}

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ValidationError";
	}
}

export class TooManyResultsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TooManyResultsError";
	}
}

export class InvalidRequestError extends Error {
	constructor(public params: Record<string, string>) {
		super("Invalid request parameters");
		this.name = "InvalidRequestError";
	}
}
