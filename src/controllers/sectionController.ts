//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with extracing the section controller logic from App.ts

import type { Request, Response } from "express";
import { SectionService } from "../services/sectionService";
import { validateSection } from "../Validation";

interface PaginationRequest extends Request {
	pagination: {
		limit: number;
		offset: number;
	};
}

export function createSectionController(sectionService: SectionService) {
	return {
		async listSections(req: Request, res: Response) {
			const { limit, offset } = (req as PaginationRequest).pagination;
			const result = await sectionService.listSections({
				courseId: req.params.course,
				limit,
				offset,
			});

			const itemsWithLinks = result.items.map((section) => ({
				...section,
				links: {
					self: `/api/v1/courses/${req.params.course}/sections/${section.id}`,
					course: `/api/v1/courses/${req.params.course}`,
				},
			}));

			res.status(200).json({
				items: itemsWithLinks,
				total: result.total,
				limit: result.limit,
				offset: result.offset,
			});
		},

		async getSection(req: Request, res: Response) {
			const section = await sectionService.getSection(req.params.course, req.params.section);
			res.status(200).json({
				...section,
				links: {
					self: `/api/v1/courses/${req.params.course}/sections/${section.id}`,
					course: `/api/v1/courses/${req.params.course}`,
				},
			});
		},

		async putSection(req: Request, res: Response) {
			const validation = validateSection(req.body);
			if (!validation.valid) {
				res.status(422).json({
					error: "Validation failed",
					fields: validation.fields,
				});
				return;
			}

			const result = await sectionService.putSection({
				courseId: req.params.course,
				sectionId: req.params.section,
				instructor: req.body.instructor,
				year: req.body.year,
				avg: req.body.avg,
				pass: req.body.pass,
				fail: req.body.fail,
				audit: req.body.audit,
			});

			if (result.isNew) {
				res.status(201).json({
					...result.section,
					links: {
						self: `/api/v1/courses/${req.params.course}/sections/${result.section.id}`,
						course: `/api/v1/courses/${req.params.course}`,
					},
				});
				return;
			}

			res.status(204).send();
		},

		async deleteSection(req: Request, res: Response) {
			const result = await sectionService.removeSection(req.params.course, req.params.section);
			res.status(200).json(result);
		},
	};
}

// END AI-GENERATED CODE

////////////////////////////////////////////////////////////////