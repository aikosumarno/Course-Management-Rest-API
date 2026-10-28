//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with implementing service layer business logic,
// coordinating between repositories, and domain error handling

// Service layer for course business logic
// Services contain domain logic and coordinate between repositories

import { CourseRepository } from "../repositories/courseRepository";
import { SectionRepository } from "../repositories/sectionRepository";
import type { Course, DeleteCourseResponse } from "../models/course";
import { NotFoundError } from "../errors/domainErrors";

export interface ListCoursesInput {
	limit: number;
	offset: number;
}

export interface ListCoursesResult {
	items: Course[];
	total: number;
	limit: number;
	offset: number;
}

export interface CreateCourseInput {
	id: string;
	title: string;
	dept: string;
	code: string;
}

export interface CreateCourseResult {
	course: Course;
	isNew: boolean;
}

export class CourseService {
	private courseRepo: CourseRepository;
	private sectionRepo: SectionRepository;

	constructor(courseRepo: CourseRepository, sectionRepo: SectionRepository) {
		this.courseRepo = courseRepo;
		this.sectionRepo = sectionRepo;
	}

	/**
	 * List all courses with pagination
	 */
	async listCourses(input: ListCoursesInput): Promise<ListCoursesResult> {
		const allCourses = await this.courseRepo.listCourses();

		return {
			items: allCourses.slice(input.offset, input.offset + input.limit),
			total: allCourses.length,
			limit: input.limit,
			offset: input.offset,
		};
	}

	/**
	 * Get a single course by ID
	 * @throws NotFoundError if course doesn't exist
	 */
	async getCourse(id: string): Promise<Course> {
		const course = await this.courseRepo.getCourse(id);
		if (!course) {
			throw new NotFoundError(`no course with id '${id}'`);
		}
		return course;
	}

	/**
	 * Create or update a course
	 */
	async putCourse(input: CreateCourseInput): Promise<CreateCourseResult> {
		const existingCourse = await this.courseRepo.getCourse(input.id);
		await this.courseRepo.putCourse(input.id, input.title, input.dept, input.code);

		return {
			course: input,
			isNew: !existingCourse,
		};
	}

	/**
	 * Delete a course and all its sections
	 * @throws NotFoundError if course doesn't exist
	 */
	async removeCourse(id: string): Promise<DeleteCourseResponse> {
		const result = await this.courseRepo.removeCourse(id);
		if (!result) {
			throw new NotFoundError(`no course with id '${id}'`);
		}
		return result;
	}
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
