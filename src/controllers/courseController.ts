//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI assisted with extracing the course controller logic from App.ts


import type { Request, Response } from "express";
import { CourseService } from "../services/courseService";
import { validateCourse } from "../Validation";

interface PaginationRequest extends Request {
	pagination: {
		limit: number;
		offset: number;
	};
}

export function createCourseController(courseService: CourseService) {
	return {
		async listCourses(req: Request, res: Response) {
			const { limit, offset } = (req as PaginationRequest).pagination;
			const result = await courseService.listCourses({ limit, offset });

			const itemsWithLinks = result.items.map((course) => ({
				...course,
				links: {
					self: `/api/v1/courses/${course.id}`,
					sections: `/api/v1/courses/${course.id}/sections`,
				},
			}));

			res.status(200).json({
				total: result.total,
				limit: result.limit,
				offset: result.offset,
				items: itemsWithLinks,
			});
		},

		async getCourse(req: Request, res: Response) {
			const course = await courseService.getCourse(req.params.course);
			res.status(200).json({
				...course,
				links: {
					self: `/api/v1/courses/${course.id}`,
					sections: `/api/v1/courses/${course.id}/sections`,
				},
			});
		},

		async putCourse(req: Request, res: Response) {
			const validation = validateCourse(req.body);
			if (!validation.valid) {
				res.status(422).json({
					error: "Validation failed",
					fields: validation.fields,
				});
				return;
			}

			const result = await courseService.putCourse({
				id: req.params.course,
				title: req.body.title,
				dept: req.body.dept,
				code: req.body.code,
			});

			if (result.isNew) {
				res.status(201).json({
					...result.course,
					links: {
						self: `/api/v1/courses/${result.course.id}`,
						sections: `/api/v1/courses/${result.course.id}/sections`,
					},
				});
				return;
			}

			res.status(204).send();
		},

		async deleteCourse(req: Request, res: Response) {
			const result = await courseService.removeCourse(req.params.course);
			res.status(200).json(result);
		},
	};
}

// END AI-GENERATED CODE

////////////////////////////////////////////////////////////////
