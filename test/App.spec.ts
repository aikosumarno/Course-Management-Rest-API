// Begin AI-generated code: AI assisted with writing comprehensive tests for the App module, covering upload validation and job status endpoints.

import fs from "fs/promises";
import { expect } from "chai";
import request from "supertest";
import { StatusCodes } from "http-status-codes";
import { Application, createApp } from "../src/App";
import JSZip from "jszip";

const { OK, CREATED, NO_CONTENT, NOT_FOUND, BAD_REQUEST, UNPROCESSABLE_ENTITY } = StatusCodes;

const datadir = "./data" as const;

const DMP = {
	name: "Hugh Dempster Pavilion",
	address: "6245 Agronomy Road V6T 1Z4",
	lat: 49.26125,
	lon: -123.24807,
};

const ORCH = {
	name: "Orchard Commons",
	address: "6363 Agronomy Road",
	lat: 49.26048,
	lon: -123.25027,
};

async function makeCourseOfferingsZip(
	offerings: object[] = [
		{
			id: "cpsc110_2022s_001",
			Course: "110",
			Title: "Intro CS",
			Professor: "Gregor Kiczales",
			Subject: "CPSC",
			Section: "001",
			Year: "2022",
			Avg: 72.5,
			Pass: 180,
			Fail: 20,
			Audit: 5,
		},
	]
): Promise<Buffer> {
	const zip = new JSZip();
	zip.file("courses/data.json", JSON.stringify({ result: offerings }));
	return zip.generateAsync({ type: "nodebuffer" });
}

async function makeFacilitiesZip(options?: { omitIndex?: boolean; indexHtml?: string }): Promise<Buffer> {
	const zip = new JSZip();

	const defaultIndex = `
<!DOCTYPE html>
<html><body>
  <table class="views-table cols-5 table">
    <tbody>
      <tr>
        <td class="views-field views-field-title">
          <a href="buildings/DMP.htm">Hugh Dempster Pavilion</a>
        </td>
        <td class="views-field views-field-field-building-code">DMP</td>
        <td class="views-field views-field-field-building-address">6245 Agronomy Road V6T 1Z4</td>
      </tr>
    </tbody>
  </table>
</body></html>`;

	const roomHtml = `
<!DOCTYPE html>
<html><body>
  <table class="views-table cols-5 table">
    <tbody>
      <tr>
        <td class="views-field views-field-field-room-number">
          <a href="http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101">101</a>
        </td>
        <td class="views-field views-field-field-room-capacity">40</td>
        <td class="views-field views-field-field-room-furniture">Classroom-Movable Tables &amp; Chairs</td>
        <td class="views-field views-field-field-room-type">Small Group</td>
        <td class="views-field views-field-nothing">
          <a href="http://students.ubc.ca/campus/discover/buildings-and-classrooms/room/DMP-101">More info</a>
        </td>
      </tr>
    </tbody>
  </table>
</body></html>`;

	if (!options?.omitIndex) {
		zip.file("index.htm", options?.indexHtml ?? defaultIndex);
	}
	zip.file("buildings/DMP.htm", roomHtml);

	return zip.generateAsync({ type: "nodebuffer" });
}

async function waitForJob(app: Application, id: string, timeoutMs = 15000): Promise<request.Response> {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		const res = await request(app).get(`/api/v2/datasets/${id}`);
		if (res.body?.status !== "processing") return res;
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`Job ${id} did not settle within ${timeoutMs}ms`);
}

describe("Buildings REST endpoints", function () {
	this.timeout(10000);

	let app: Application;

	beforeEach(async () => {
		app = await createApp({ datadir });
	});

	afterEach(async () => {
		for (let i = 0; i < 5; i++) {
			try {
				await fs.rm(datadir, { recursive: true, force: true });
				return;
			} catch {
				await new Promise((r) => setTimeout(r, 100));
			}
		}
		// Final attempt — if still failing, ignore it
		await fs.rm(datadir, { recursive: true, force: true }).catch(() => {});
	});

	// ══════════════════════════════════════════════════════════════════════
	// POST /api/v2/datasets  — upload validation
	// ══════════════════════════════════════════════════════════════════════

	describe("POST /api/v2/datasets — validation", () => {
		it("returns 422 with correct shape when kind is missing", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app).post("/api/v2/datasets").attach("archive", zip, "data.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body).to.have.property("error", "Validation failed");
			expect(res.body.fields).to.have.property(
				"kind",
				"required but missing" // ← CORRECT per spec
			);
		});

		it("returns 422 with correct shape when kind is invalid", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "bad_kind")
				.attach("archive", zip, "data.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("kind", "expected to be course_offerings or facilities");
		});

		it("returns 422 with correct shape when archive is missing", async () => {
			const res = await request(app).post("/api/v2/datasets").field("kind", "course_offerings");

			expect(res.body.fields).to.have.property(
				"archive",
				"required but missing" // ← correct
			);
		});

		it("returns 422 when both kind and archive are missing", async () => {
			const res = await request(app).post("/api/v2/datasets");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("kind");
			expect(res.body.fields).to.have.property("archive");
		});

		it("returns 202 with correct shape for valid course_offerings upload", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			expect(res.status).to.equal(202);
			expect(res.body).to.have.property("id").that.is.a("string").and.not.empty;
			expect(res.body).to.have.property("status", "processing");
			expect(res.body).to.have.property("kind", "course_offerings");
			expect(res.body).to.have.property("message", "Dataset accepted for processing");
		});

		it("returns 202 with correct shape for valid facilities upload", async () => {
			const zip = await makeFacilitiesZip();
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", zip, "data.zip");

			expect(res.status).to.equal(202);
			expect(res.body).to.have.property("id").that.is.a("string").and.not.empty;
			expect(res.body).to.have.property("status", "processing");
			expect(res.body).to.have.property("kind", "facilities");
			expect(res.body).to.have.property("message", "Dataset accepted for processing");
		});

		it("each upload gets a unique job id", async () => {
			const zip = await makeCourseOfferingsZip();
			const post = () =>
				request(app).post("/api/v2/datasets").field("kind", "course_offerings").attach("archive", zip, "data.zip");

			const [r1, r2] = await Promise.all([post(), post()]);
			expect(r1.body.id).to.not.equal(r2.body.id);
		});

		it("campus.zip upload produces correct buildings and rooms stats", async () => {
			this.timeout(120000);
			const campusZip = await fs.readFile("./test/campus.zip");

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", campusZip, "campus.zip");

			expect(upload.status).to.equal(202);

			const final = await waitForJob(app, upload.body.id, 120000); // 2 min timeout for 74 geolocation calls

			expect(final.body.status).to.equal("completed");
			expect(final.body.stats.buildings_added).to.equal(74);
			expect(final.body.stats.buildings_modified).to.equal(0);
			expect(final.body.stats.rooms_added).to.equal(364);
			expect(final.body.stats.rooms_modified).to.equal(0);
		});

		it("produces correct courses and sections stats", async function () {
			this.timeout(120000);

			const partialPairZip = await fs.readFile("./test/partial-pair.zip");

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", partialPairZip, "partial-pair.zip");

			expect(upload.status).to.equal(202);
			expect(upload.body).to.have.property("id").that.is.a("string");

			console.log("Job started:", upload.body.id);
			console.log("Waiting for job to complete...");

			const final = await waitForJob(app, upload.body.id, 120000);

			console.log("Final job status:", final.body.status);
			console.log("Stats:", JSON.stringify(final.body.stats, null, 2));

			expect(final.body.status).to.equal("completed");
			expect(final.body.stats.files_total).to.equal(462);
			expect(final.body.stats.files_processed).to.equal(461);
			expect(final.body.stats.files_skipped).to.equal(1);
			expect(final.body.stats.courses_seen).to.equal(346);
			expect(final.body.stats.courses_added).to.equal(346);
			expect(final.body.stats.courses_modified).to.equal(0);
			expect(final.body.stats.sections_seen).to.equal(4987);
			expect(final.body.stats.sections_added).to.equal(4987);
			expect(final.body.stats.sections_modified).to.equal(0);
		});
	});

	describe("POST /api/v2/datasets — edge cases", () => {

		it("returns 422 with 'required but missing' when kind is an empty string", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app).post("/api/v2/datasets").field("kind", "").attach("archive", zip, "data.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("kind", "required but missing");
		});

		it("returns 422 with correct message when kind is 'COURSE_OFFERINGS' (wrong case)", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "COURSE_OFFERINGS")
				.attach("archive", zip, "data.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("kind", "expected to be course_offerings or facilities");
		});

		it("returns 422 with correct message when kind is 'Facilities' (wrong case)", async () => {
			const zip = await makeCourseOfferingsZip();
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "Facilities")
				.attach("archive", zip, "data.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("kind", "expected to be course_offerings or facilities");
		});

		// ── archive field edge cases ──

		it("returns 422 with 'expected non-empty file' when archive is an empty buffer", async () => {
			const res = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", Buffer.alloc(0), "empty.zip");

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("archive", "expected non-empty file");
		});

		it("fails with 'Missing index.htm file' when zip contains index.html instead of index.htm", async () => {
			const zip = new JSZip();
			zip.file("index.html", "<html><body></body></html>"); // wrong extension
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Missing index.htm file");
		});

		it("fails with 'Missing index.htm file' when index.htm is in a nested subdirectory", async () => {
			const zip = new JSZip();
			zip.file("a/b/index.htm", "<html><body></body></html>");
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Missing index.htm file");
		});

		it("fails with 'No building table found' when index.htm has a table without views-table class", async () => {
			const zip = await makeFacilitiesZip({
				indexHtml: "<html><body><table class='other-class'><tbody><tr><td>data</td></tr></tbody></table></body></html>",
			});

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("No building table found in index.htm");
		});

		it("skips records where Avg is a string instead of number", async () => {
			const zip = await makeCourseOfferingsZip([
				{
					id: "cpsc110_s001",
					Course: "110",
					Title: "Intro CS",
					Professor: "Prof A",
					Subject: "CPSC",
					Section: "001",
					Year: "2022",
					Avg: "72.5", // ← string, should be rejected
					Pass: 180,
					Fail: 20,
					Audit: 5,
				},
			]);

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("completed");
			expect(final.body.stats.sections_added).to.equal(0);
		});

		it("file with result: [] (empty array) counts as processed not skipped", async () => {
			const zip = new JSZip();
			zip.file("courses/empty.json", JSON.stringify({ result: [] }));
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("completed");
			expect(final.body.stats.files_processed).to.equal(1);
			expect(final.body.stats.files_skipped).to.equal(0);
			expect(final.body.stats.sections_added).to.equal(0);
		});

		it("file with result property that is not an array counts as skipped", async () => {
			const zip = new JSZip();
			zip.file("courses/bad.json", JSON.stringify({ result: "not an array" }));
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("completed");
			expect(final.body.stats.files_skipped).to.equal(1);
			expect(final.body.stats.files_processed).to.equal(0);
		});
	});

	// GET /api/v2/datasets/:id  — job status

	describe("GET /api/v2/datasets/:id — job status", () => {
		it("returns 404 with correct shape for unknown job id", async () => {
			const res = await request(app).get("/api/v2/datasets/nonexistent_id");

			expect(res.status).to.equal(NOT_FOUND);
			expect(res.body).to.have.property("error", "Not found");
			expect(res.body).to.have.property("message").that.includes("nonexistent_id");
		});

		it("returns a valid status immediately after upload", async () => {
			const zip = await makeCourseOfferingsZip();
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			const res = await request(app).get(`/api/v2/datasets/${upload.body.id}`);

			expect(res.status).to.equal(OK);
			expect(["processing", "completed", "failed"]).to.include(res.body.status);
		});

		it("job eventually leaves the processing state", async () => {
			const zip = await makeCourseOfferingsZip();
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);
			expect(final.body.status).to.not.equal("processing");
		});

		it("completed course_offerings job has correct stats keys", async () => {
			const zip = await makeCourseOfferingsZip();
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("completed");
			expect(final.body).to.have.property("message", "Dataset processing complete");
			expect(final.body.stats).to.have.all.keys(
				"files_total",
				"files_processed",
				"files_skipped",
				"courses_seen",
				"courses_added",
				"courses_modified",
				"sections_seen",
				"sections_added",
				"sections_modified"
			);
		});

		it("stats are correct for a fresh single-offering upload", async () => {
			const zip = await makeCourseOfferingsZip();
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);
			const { stats } = final.body;

			expect(stats.files_total).to.equal(1);
			expect(stats.files_processed).to.equal(1);
			expect(stats.files_skipped).to.equal(0);
			expect(stats.courses_added).to.equal(1);
			expect(stats.courses_modified).to.equal(0);
			expect(stats.sections_added).to.equal(1);
			expect(stats.sections_modified).to.equal(0);
		});

		// failure messages

		it("fails with exact message for invalid zip (course_offerings)", async () => {
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", Buffer.from("not a zip"), "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Data is not in a valid zip format");
		});

		it("fails with exact message when courses/ directory is missing", async () => {
			const zip = new JSZip();
			zip.file("other/data.json", JSON.stringify({ result: [] }));
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "course_offerings")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Missing root courses directory");
		});

		it("fails with exact message for invalid zip (facilities)", async () => {
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", Buffer.from("not a zip"), "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Data is not in a valid zip format");
		});

		it("fails with exact message when index.htm is missing", async () => {
			const zip = await makeFacilitiesZip({ omitIndex: true });
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Missing index.htm file");
		});

		it("fails with exact message when no building table found in index.htm", async () => {
			const zip = await makeFacilitiesZip({
				indexHtml: "<html><body><p>No table here.</p></body></html>",
			});
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("No building table found in index.htm");
		});

		it("completed facilities job has buildings/rooms stats keys", async () => {
			const zip = await makeFacilitiesZip();
			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", zip, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			// Job completes or fails depending on geolocation service availability.
			// Either way the stats shape must be correct if completed.
			if (final.body.status === "completed") {
				expect(final.body.stats).to.have.all.keys(
					"buildings_added",
					"buildings_modified",
					"rooms_added",
					"rooms_modified"
				);
			}
		});

		it("index.htm in a subdirectory is treated as missing (must be at zip root)", async () => {
			const zip = new JSZip();
			zip.file("subdir/index.htm", "<html><body></body></html>");
			const buf = await zip.generateAsync({ type: "nodebuffer" });

			const upload = await request(app)
				.post("/api/v2/datasets")
				.field("kind", "facilities")
				.attach("archive", buf, "data.zip");

			const final = await waitForJob(app, upload.body.id);

			expect(final.body.status).to.equal("failed");
			expect(final.body.message).to.equal("Missing index.htm file");
		});
	});

	// GET /api/v2/buildings  — list

	describe("GET /api/v2/buildings", () => {
		it("returns 200 with empty items array when no buildings exist", async () => {
			const res = await request(app).get("/api/v2/buildings");

			expect(res.status).to.equal(OK);
			expect(res.body).to.include({ total: 0, limit: 100, offset: 0 });
			expect(res.body.items).to.be.an("array").with.lengthOf(0);
		});

		it("returns all buildings with correct shape after creation", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);

			const res = await request(app).get("/api/v2/buildings");

			expect(res.status).to.equal(OK);
			expect(res.body.total).to.equal(2);
			expect(res.body.items).to.be.an("array").with.lengthOf(2);
		});

		it("each item includes id, name, address, lat, lon, and links", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings");
			const item = res.body.items[0];

			expect(item).to.have.property("id", "DMP");
			expect(item).to.have.property("name", DMP.name);
			expect(item).to.have.property("address", DMP.address);
			expect(item).to.have.property("lat", DMP.lat);
			expect(item).to.have.property("lon", DMP.lon);
			expect(item).to.have.property("links").that.is.an("object");
		});

		it("results are ordered by id ascending", async () => {
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings");
			const ids = res.body.items.map((b: any) => b.id);

			expect(ids).to.deep.equal([...ids].sort());
		});

		// pagination

		it("default limit is 100 and default offset is 0", async () => {
			const res = await request(app).get("/api/v2/buildings");

			expect(res.body.limit).to.equal(100);
			expect(res.body.offset).to.equal(0);
		});

		it("respects a custom limit", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);

			const res = await request(app).get("/api/v2/buildings?limit=1");

			expect(res.status).to.equal(OK);
			expect(res.body.limit).to.equal(1);
			expect(res.body.items).to.have.lengthOf(1);
			expect(res.body.total).to.equal(2); // total ignores limit
		});

		it("respects a custom offset", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);

			const res = await request(app).get("/api/v2/buildings?offset=1");

			expect(res.status).to.equal(OK);
			expect(res.body.offset).to.equal(1);
			expect(res.body.items).to.have.lengthOf(1);
			expect(res.body.total).to.equal(2); // total ignores offset
		});

		it("returns 400 when limit is below 1", async () => {
			const res = await request(app).get("/api/v2/buildings?limit=0");

			expect(res.status).to.equal(BAD_REQUEST);
			expect(res.body).to.have.property("error", "Invalid request parameters");
			expect(res.body.params).to.have.property("limit", "expected an integer between 1 and 5000");
		});

		it("returns 400 when limit exceeds 5000", async () => {
			const res = await request(app).get("/api/v2/buildings?limit=5001");

			expect(res.status).to.equal(BAD_REQUEST);
			expect(res.body.params).to.have.property("limit", "expected an integer between 1 and 5000");
		});

		it("returns 400 when limit is not an integer", async () => {
			const res = await request(app).get("/api/v2/buildings?limit=abc");

			expect(res.status).to.equal(BAD_REQUEST);
			expect(res.body.params).to.have.property("limit");
		});

		it("returns 400 when offset is negative", async () => {
			const res = await request(app).get("/api/v2/buildings?offset=-1");

			expect(res.status).to.equal(BAD_REQUEST);
			expect(res.body).to.have.property("error", "Invalid request parameters");
			expect(res.body.params).to.have.property("offset", "expected an integer >= 0");
		});

		it("returns 400 when offset is not an integer", async () => {
			const res = await request(app).get("/api/v2/buildings?offset=1.5");

			expect(res.status).to.equal(BAD_REQUEST);
			expect(res.body.params).to.have.property("offset");
		});

		it("returns an empty items array when offset exceeds total", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings?offset=999");

			expect(res.status).to.equal(OK);
			expect(res.body.items).to.be.an("array").with.lengthOf(0);
			expect(res.body.total).to.equal(1);
		});
	});

	// GET /api/v2/buildings/:building  — retrieve single

	describe("GET /api/v2/buildings/:building", () => {
		it("returns 404 with correct error shape for a non-existent building", async () => {
			const res = await request(app).get("/api/v2/buildings/NONEXISTENT");

			expect(res.status).to.equal(NOT_FOUND);
			expect(res.body).to.have.property("error", "Not found");
			expect(res.body).to.have.property("message").that.includes("NONEXISTENT");
		});

		it("returns 200 with all required fields for an existing building", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings/DMP");

			expect(res.status).to.equal(OK);
			expect(res.body).to.deep.include({
				id: "DMP",
				name: DMP.name,
				address: DMP.address,
				lat: DMP.lat,
				lon: DMP.lon,
			});
		});

		it("returns links.self and links.rooms with correct paths", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings/DMP");

			expect(res.body.links).to.deep.equal({
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			});
		});

		it("ids are case-sensitive (DMP and dmp are different buildings)", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings/dmp");

			expect(res.status).to.equal(NOT_FOUND);
		});
	});

	// PUT /api/v2/buildings/:building  — create or replace

	describe("PUT /api/v2/buildings/:building", () => {
		// 201 create

		it("returns 201 with full building body when creating a new building", async () => {
			const res = await request(app).put("/api/v2/buildings/DMP").send(DMP);

			expect(res.status).to.equal(CREATED);
			expect(res.body).to.deep.include({
				id: "DMP",
				name: DMP.name,
				address: DMP.address,
				lat: DMP.lat,
				lon: DMP.lon,
			});
			expect(res.body.links).to.deep.equal({
				self: "/api/v2/buildings/DMP",
				rooms: "/api/v2/buildings/DMP/rooms",
			});
		});

		it("building is retrievable after creation", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings/DMP");
			expect(res.status).to.equal(OK);
			expect(res.body).to.have.property("id", "DMP");
		});

		// 204 update

		it("returns 204 when replacing an existing building", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, name: "DMP Updated" });

			expect(res.status).to.equal(NO_CONTENT);
		});

		it("GET reflects the updated values after a replace", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, name: "DMP Updated" });

			const res = await request(app).get("/api/v2/buildings/DMP");
			expect(res.body).to.have.property("name", "DMP Updated");
		});

		//  422 validation 

		it("returns 422 with error + fields when name is missing", async () => {
			const { name: _omit, ...noName } = DMP;
			const res = await request(app).put("/api/v2/buildings/DMP").send(noName);

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body).to.have.property("error", "Validation failed");
			expect(res.body.fields).to.have.property("name");
		});

		it("returns 422 when address is missing", async () => {
			const { address: _omit, ...noAddress } = DMP;
			const res = await request(app).put("/api/v2/buildings/DMP").send(noAddress);

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("address");
		});

		it("returns 422 when lat is missing", async () => {
			const { lat: _omit, ...noLat } = DMP;
			const res = await request(app).put("/api/v2/buildings/DMP").send(noLat);

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("lat");
		});

		it("returns 422 when lon is missing", async () => {
			const { lon: _omit, ...noLon } = DMP;
			const res = await request(app).put("/api/v2/buildings/DMP").send(noLon);

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("lon");
		});

		it("returns 422 with 'expected a string' when name is not a string", async () => {
			const res = await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, name: 42 });

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("name", "expected a string");
		});

		it("returns 422 with 'expected a string' when address is not a string", async () => {
			const res = await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, address: true });

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("address", "expected a string");
		});

		it("returns 422 with 'expected a number' when lat is not a number", async () => {
			const res = await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, lat: "not-a-number" });

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("lat", "expected a number");
		});

		it("returns 422 with 'expected a number' when lon is not a number", async () => {
			const res = await request(app)
				.put("/api/v2/buildings/DMP")
				.send({ ...DMP, lon: "not-a-number" });

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body.fields).to.have.property("lon", "expected a number");
		});

		it("returns 422 when body is empty", async () => {
			const res = await request(app).put("/api/v2/buildings/DMP").send({});

			expect(res.status).to.equal(UNPROCESSABLE_ENTITY);
			expect(res.body).to.have.property("error", "Validation failed");
		});
	});

	// DELETE /api/v2/buildings/:building  — remove

	describe("DELETE /api/v2/buildings/:building", () => {
		it("returns 404 with correct error shape for a non-existent building", async () => {
			const res = await request(app).delete("/api/v2/buildings/NONEXISTENT");

			expect(res.status).to.equal(NOT_FOUND);
			expect(res.body).to.have.property("error", "Not found");
			expect(res.body).to.have.property("message").that.includes("NONEXISTENT");
		});

		it("returns 200 with building metadata and rooms count when deleted", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).delete("/api/v2/buildings/DMP");

			expect(res.status).to.equal(OK);
			expect(res.body).to.deep.include({
				id: "DMP",
				name: DMP.name,
				address: DMP.address,
				lat: DMP.lat,
				lon: DMP.lon,
			});
			expect(res.body).to.have.property("rooms").that.is.a("number");
		});

		it("rooms count is 0 when the building had no rooms", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).delete("/api/v2/buildings/DMP");

			expect(res.body.rooms).to.equal(0);
		});

		it("rooms count reflects how many rooms were removed", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
				building: "DMP",
				number: "101",
				seats: 40,
				type: "Lecture",
				furniture: "Chairs",
				href: "http://example.com/101",
			});
			await request(app).put("/api/v2/buildings/DMP/rooms/DMP_102").send({
				building: "DMP",
				number: "102",
				seats: 80,
				type: "Lecture",
				furniture: "Chairs",
				href: "http://example.com/102",
			});

			const res = await request(app).delete("/api/v2/buildings/DMP");

			expect(res.body.rooms).to.equal(2);
		});

		it("building is no longer retrievable after deletion", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).delete("/api/v2/buildings/DMP");

			const res = await request(app).get("/api/v2/buildings/DMP");
			expect(res.status).to.equal(NOT_FOUND);
		});

		it("all rooms are removed when the building is deleted", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/DMP/rooms/DMP_101").send({
				building: "DMP",
				number: "101",
				seats: 40,
				type: "Lecture",
				furniture: "Chairs",
				href: "http://example.com/101",
			});

			await request(app).delete("/api/v2/buildings/DMP");

			const res = await request(app).get("/api/v2/buildings/DMP/rooms/DMP_101");
			expect(res.status).to.equal(NOT_FOUND);
		});

		it("returns 404 on a second delete of the same building", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).delete("/api/v2/buildings/DMP");

			const res = await request(app).delete("/api/v2/buildings/DMP");
			expect(res.status).to.equal(NOT_FOUND);
		});

		it("does not affect other buildings", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);

			await request(app).delete("/api/v2/buildings/DMP");

			const res = await request(app).get("/api/v2/buildings/ORCH");
			expect(res.status).to.equal(OK);
		});
	});

	// Cross-cutting / edge cases

	describe("Cross-cutting", () => {
		it("GET list total reflects actual count after adds and deletes", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);
			await request(app).delete("/api/v2/buildings/DMP");

			const res = await request(app).get("/api/v2/buildings");
			expect(res.body.total).to.equal(1);
		});

		it("building id in response always matches the path parameter", async () => {
			await request(app).put("/api/v2/buildings/ORCH").send(ORCH);

			const res = await request(app).get("/api/v2/buildings/ORCH");
			expect(res.body.id).to.equal("ORCH");
		});

		it("lat and lon are returned as numbers, not strings", async () => {
			await request(app).put("/api/v2/buildings/DMP").send(DMP);

			const res = await request(app).get("/api/v2/buildings/DMP");
			expect(res.body.lat).to.be.a("number");
			expect(res.body.lon).to.be.a("number");
		});
	});
});

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
