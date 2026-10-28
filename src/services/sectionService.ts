//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with implementing service layer business logic,
// coordinating between repositories, and domain error handling

// Service layer for section business logic
// Services contain domain logic and coordinate between repositories

import { CourseRepository } from "../repositories/courseRepository";
import { SectionRepository } from "../repositories/sectionRepository";
import type { Section } from "../models/section";
import { NotFoundError } from "../errors/domainErrors";

export interface ListSectionsInput {
	courseId: string;
	limit: number;
	offset: number;
}

export interface ListSectionsResult {
	items: Section[];
	total: number;
	limit: number;
	offset: number;
}

export interface CreateSectionInput {
	courseId: string;
	sectionId: string;
	instructor: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export interface CreateSectionResult {
	section: Section;
	isNew: boolean;
}

export interface DeleteSectionResponse {
	id: string;
	instructor: string;
	year: number;
	avg: number;
	pass: number;
	fail: number;
	audit: number;
}

export class SectionService {
	private courseRepo: CourseRepository;
	private sectionRepo: SectionRepository;

	constructor(courseRepo: CourseRepository, sectionRepo: SectionRepository) {
		this.courseRepo = courseRepo;
		this.sectionRepo = sectionRepo;
	}

	/**
	 * List all sections for a course with pagination
	 * @throws NotFoundError if course doesn't exist
	 */
	async listSections(input: ListSectionsInput): Promise<ListSectionsResult> {
		// Validate course exists
		const course = await this.courseRepo.getCourse(input.courseId);
		if (!course) {
			throw new NotFoundError(`no course with id '${input.courseId}'`);
		}

		const allSections = await this.sectionRepo.listSections(input.courseId);
		if (!allSections) {
			// This shouldn't happen if course exists, but handle it
			return {
				items: [],
				total: 0,
				limit: input.limit,
				offset: input.offset,
			};
		}

		return {
			items: allSections.slice(input.offset, input.offset + input.limit),
			total: allSections.length,
			limit: input.limit,
			offset: input.offset,
		};
	}

	/**
	 * Get a single section by course ID and section ID
	 * @throws NotFoundError if course or section doesn't exist
	 */
	async getSection(courseId: string, sectionId: string): Promise<Section> {
		// Validate course exists
		const course = await this.courseRepo.getCourse(courseId);
		if (!course) {
			throw new NotFoundError(`no course with id '${courseId}'`);
		}

		const section = await this.sectionRepo.getSection(courseId, sectionId);
		if (!section) {
			throw new NotFoundError(`no section '${sectionId}' in course '${courseId}'`);
		}

		return section;
	}

	/**
	 * Create or update a section
	 * @throws NotFoundError if course doesn't exist
	 */
	async putSection(input: CreateSectionInput): Promise<CreateSectionResult> {
		// Validate course exists
		const course = await this.courseRepo.getCourse(input.courseId);
		if (!course) {
			throw new NotFoundError(`no course with id '${input.courseId}'`);
		}

		const existingSection = await this.sectionRepo.getSection(input.courseId, input.sectionId);

		await this.sectionRepo.putSection(
			input.courseId,
			input.sectionId,
			input.instructor,
			input.year,
			input.avg,
			input.pass,
			input.fail,
			input.audit
		);

		const section: Section = {
			id: input.sectionId,
			instructor: input.instructor,
			year: input.year,
			avg: input.avg,
			pass: input.pass,
			fail: input.fail,
			audit: input.audit,
		};

		return {
			section,
			isNew: !existingSection,
		};
	}

	/**
	 * Delete a section
	 * @throws NotFoundError if course or section doesn't exist
	 */
	async removeSection(courseId: string, sectionId: string): Promise<DeleteSectionResponse> {
		// Validate course exists
		const course = await this.courseRepo.getCourse(courseId);
		if (!course) {
			throw new NotFoundError(`no course with id '${courseId}'`);
		}

		const section = await this.sectionRepo.getSection(courseId, sectionId);
		if (!section) {
			throw new NotFoundError(`no section '${sectionId}' in course '${courseId}'`);
		}

		await this.sectionRepo.removeSection(courseId, sectionId);

		return {
			id: section.id,
			instructor: section.instructor,
			year: section.year,
			avg: section.avg,
			pass: section.pass,
			fail: section.fail,
			audit: section.audit,
		};
	}
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
