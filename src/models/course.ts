// BEGIN AI-GENERATED CODE: AI assisted with extracting course model

import type { Section } from "./section";

// Domain model for Course resource
export interface Course {
	id: string;
	title: string;
	dept: string;
	code: string;
}

//combining course with its sections
export interface CourseData extends Course {
	sections: Section[];
}

//Response for DELETE course endpoint
export interface DeleteCourseResponse {
	id: string;
	title: string;
	dept: string;
	code: string;
	sections: number;
}

// ENDAI-GENERATED CODE