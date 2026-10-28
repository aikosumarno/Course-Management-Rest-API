// BEGIN AI-GENERATED CODE: AI assisted with extracting section repository

import { CourseRepository } from "./courseRepository";
import type { Section } from "../models/section";

/**
 * Repository for Section data access.
 * Handles CRUD operations for sections within courses.
 */
export class SectionRepository {
	private courseRepo: CourseRepository;

	constructor(courseRepo: CourseRepository) {
		this.courseRepo = courseRepo;
	}

	/**
	 * List all sections for a course
	 * Returns undefined if course doesn't exist
	 */
	async listSections(courseId: string): Promise<Section[] | undefined> {
		const course = await this.courseRepo.getCourseData(courseId);
		if (course === undefined) {
			return undefined;
		}

		return [...course.sections].sort((left, right) => left.id.localeCompare(right.id));
	}

	/**
	 * Get a single section by id
	 * Returns undefined if course doesn't exist
	 * Returns null if course exists but section doesn't
	 */
	async getSection(courseId: string, sectionId: string): Promise<Section | null | undefined> {
		const course = await this.courseRepo.getCourseData(courseId);
		if (course === undefined) {
			return undefined;
		}

		const section = course.sections.find((item) => item.id === sectionId);
		if (section === undefined) {
			return null;
		}

		return section;
	}

	/**
	 * Create or update a section
	 * Returns null if course doesn't exist
	 * Returns true if created (new), false if updated (existing)
	 */
	async putSection(
		courseId: string,
		sectionId: string,
		instructor: string,
		year: number,
		avg: number,
		pass: number,
		fail: number,
		audit: number
	): Promise<boolean | null> {
		const course = await this.courseRepo.getCourseData(courseId);
		if (course === undefined) {
			return null;
		}

		const existingIndex = course.sections.findIndex((section) => section.id === sectionId);
		const isNew = existingIndex === -1;

		const section: Section = {
			id: sectionId,
			instructor,
			year,
			avg,
			pass,
			fail,
			audit,
		};

		if (isNew) {
			course.sections.push(section);
		} else {
			course.sections[existingIndex] = section;
		}

		await this.courseRepo.updateCourseData(courseId, course);
		return isNew;
	}

	/**
	 * Remove a section
	 * Returns undefined if course doesn't exist
	 * Returns null if course exists but section doesn't
	 */
	async removeSection(courseId: string, sectionId: string): Promise<Section | null | undefined> {
		const course = await this.courseRepo.getCourseData(courseId);
		if (course === undefined) {
			return undefined;
		}

		const index = course.sections.findIndex((section) => section.id === sectionId);
		if (index === -1) {
			return null;
		}

		const removed = course.sections[index];
		course.sections.splice(index, 1);
		await this.courseRepo.updateCourseData(courseId, course);

		return {
			id: removed.id,
			instructor: removed.instructor,
			year: removed.year,
			avg: removed.avg,
			pass: removed.pass,
			fail: removed.fail,
			audit: removed.audit,
		};
	}
}

// END AI-GENERATED CODE
