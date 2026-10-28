// BEGIN AI-GENERATED CODE: AI assisted with extracting course repository

import { FileStore } from "../storage/fileStore";
import type { Course, CourseData, DeleteCourseResponse } from "../models/course";

/**
 * Repository for Course data access.
 * Handles CRUD operations for courses using the storage layer.
 */
export class CourseRepository {
	private store: FileStore;
	private readonly filename = "courses.json";

	constructor(store: FileStore) {
		this.store = store;
	}

	/**
	 * Check if a course exists
	 */
	async courseExists(courseId: string): Promise<boolean> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		return data[courseId] !== undefined;
	}

	/**
	 * List all courses (without sections data)
	 * Returns courses sorted by id
	 */
	async listCourses(): Promise<Course[]> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		return Object.values(data)
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((course) => ({
				id: course.id,
				title: course.title,
				dept: course.dept,
				code: course.code,
			}));
	}

	/**
	 * List all courses with their sections (internal representation)
	 * Used by services that need section data
	 */
	async listCourseData(): Promise<CourseData[]> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		return Object.values(data).sort((left, right) => left.id.localeCompare(right.id));
	}

	/**
	 * Get a single course by id (without sections data)
	 * Returns undefined if course doesn't exist
	 */
	async getCourse(courseId: string): Promise<Course | undefined> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		const course = data[courseId];
		if (course === undefined) {
			return undefined;
		}

		return {
			id: course.id,
			title: course.title,
			dept: course.dept,
			code: course.code,
		};
	}

	/**
	 * Get full course data including sections (internal representation)
	 */
	async getCourseData(courseId: string): Promise<CourseData | undefined> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		return data[courseId];
	}

	/**
	 * Create or update a course
	 * Returns true if created (new), false if updated (existing)
	 */
	async putCourse(courseId: string, title: string, dept: string, code: string): Promise<boolean> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		const existing = data[courseId];
		const isNew = existing === undefined;

		data[courseId] = {
			id: courseId,
			title,
			dept,
			code,
			sections: existing ? existing.sections : [],
		};

		await this.store.writeCollection(this.filename, data);
		return isNew;
	}

	/**
	 * Remove a course and all its sections
	 * Returns undefined if course doesn't exist
	 */
	async removeCourse(courseId: string): Promise<DeleteCourseResponse | undefined> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		const existing = data[courseId];
		if (existing === undefined) {
			return undefined;
		}

		// Create response with section count
		const response: DeleteCourseResponse = {
			id: existing.id,
			title: existing.title,
			dept: existing.dept,
			code: existing.code,
			sections: existing.sections.length,
		};

		delete data[courseId];
		await this.store.writeCollection(this.filename, data);
		return response;
	}

	/**
	 * Update course data (used internally by section repository)
	 */
	async updateCourseData(courseId: string, courseData: CourseData): Promise<void> {
		const data = await this.store.readCollection<CourseData>(this.filename);
		data[courseId] = courseData;
		await this.store.writeCollection(this.filename, data);
	}
}

// END AI-GENERATED CODE
