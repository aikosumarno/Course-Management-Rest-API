//////////////////////////////////////////////////////////////////

// BEGIN AI-GENERATED CODE: AI helped implement the complete facilities data model with CRUD operations

import * as fs from "fs/promises";
import * as path from "path";

/**
 * Building resource representation
 */
export interface Building {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	links?: {
		self?: string;
		rooms?: string;
	};
}

/**
 * Room resource representation
 */
export interface Room {
	id: string;
	building: string;
	number: string;
	type: string;
	furniture: string;
	href: string;
	seats: number;
	links?: {
		self?: string;
		building?: string;
	};
}

/**
 * Internal building data structure with nested rooms
 */
export interface BuildingData extends Building {
	rooms: Room[];
}

/**
 * Response for DELETE building endpoint
 */
export interface DeleteBuildingResponse {
	id: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	rooms: number; // Count of rooms removed
}

/**
 * Manages buildings and rooms data with file-based persistence
 */
export class FacilitiesDataModel {
	private datadir: string;

	constructor(datadir: string) {
		this.datadir = datadir;
	}

	/**
	 * Get the path to the buildings storage file
	 */
	private getStorePath(): string {
		return path.join(this.datadir, "buildings.json");
	}

	/**
	 * Read all buildings from storage
	 */
	private async readStore(): Promise<Record<string, BuildingData>> {
		try {
			const filePath = this.getStorePath();
			const raw = await fs.readFile(filePath, "utf-8");
			const parsed = JSON.parse(raw) as Record<string, BuildingData>;
			return parsed;
		} catch {
			return {};
		}
	}

	/**
	 * Write all buildings to storage
	 */
	private async writeStore(store: Record<string, BuildingData>): Promise<void> {
		// Ensure directory exists
		await fs.mkdir(this.datadir, { recursive: true });
		const filePath = this.getStorePath();
		await fs.writeFile(filePath, JSON.stringify(store, null, 2), "utf-8");
	}

	/**
	 * Format a room for API response with HATEOAS links
	 */
	private toRoomResponse(buildingId: string, room: Room): Room {
		return {
			id: room.id,
			building: room.building,
			number: room.number,
			type: room.type,
			furniture: room.furniture,
			href: room.href,
			seats: room.seats,
			links: {
				self: `/api/v2/buildings/${buildingId}/rooms/${room.id}`,
				building: `/api/v2/buildings/${buildingId}`,
			},
		};
	}

	/**
	 * Format a building for API response with HATEOAS links
	 */
	private toBuildingResponse(building: BuildingData): Building {
		return {
			id: building.id,
			name: building.name,
			address: building.address,
			lat: building.lat,
			lon: building.lon,
			links: {
				self: `/api/v2/buildings/${building.id}`,
				rooms: `/api/v2/buildings/${building.id}/rooms`,
			},
		};
	}

	/**
	 * Check if a building exists
	 */
	async buildingExists(buildingId: string): Promise<boolean> {
		const store = await this.readStore();
		return store[buildingId] !== undefined;
	}

	/**
	 * List all buildings sorted by id
	 */
	async listBuildings(): Promise<Building[]> {
		const store = await this.readStore();
		return Object.values(store)
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((building) => this.toBuildingResponse(building));
	}

	/**
	 * Get raw building data for internal use (e.g., search queries)
	 */
	async listBuildingData(): Promise<BuildingData[]> {
		const store = await this.readStore();
		return Object.values(store).sort((left, right) => left.id.localeCompare(right.id));
	}

	/**
	 * Get a single building by id
	 */
	async getBuilding(buildingId: string): Promise<Building | undefined> {
		const store = await this.readStore();
		const building = store[buildingId];
		if (building === undefined) {
			return undefined;
		}

		return this.toBuildingResponse(building);
	}

	/**
	 * Create or update a building
	 * @returns true if created (new), false if updated (existing)
	 */
	async putBuilding(buildingId: string, name: string, address: string, lat: number, lon: number): Promise<boolean> {
		const store = await this.readStore();
		const existing = store[buildingId];
		const isNew = existing === undefined;

		store[buildingId] = {
			id: buildingId,
			name,
			address,
			lat,
			lon,
			rooms: existing ? existing.rooms : [],
		};

		await this.writeStore(store);
		return isNew;
	}

	/**
	 * Remove a building and all its rooms
	 * @returns DeleteBuildingResponse if removed, undefined if not found
	 */
	async removeBuilding(buildingId: string): Promise<DeleteBuildingResponse | undefined> {
		const store = await this.readStore();
		const existing = store[buildingId];
		if (existing === undefined) {
			return undefined;
		}

		// Create response with room count
		const response: DeleteBuildingResponse = {
			id: existing.id,
			name: existing.name,
			address: existing.address,
			lat: existing.lat,
			lon: existing.lon,
			rooms: existing.rooms.length, // Count, not array
		};

		delete store[buildingId];
		await this.writeStore(store);
		return response;
	}

	/**
	 * List all rooms for a building sorted by id
	 * @returns Room array if building exists, undefined if building not found
	 */
	async listRooms(buildingId: string): Promise<Room[] | undefined> {
		const store = await this.readStore();
		const building = store[buildingId];
		if (building === undefined) {
			return undefined;
		}

		return [...building.rooms]
			.sort((left, right) => left.id.localeCompare(right.id))
			.map((room) => this.toRoomResponse(buildingId, room));
	}

	/**
	 * Get a single room by id
	 * @returns Room if found, null if room doesn't exist, undefined if building doesn't exist
	 */
	async getRoom(buildingId: string, roomId: string): Promise<Room | null | undefined> {
		const store = await this.readStore();
		const building = store[buildingId];
		if (building === undefined) {
			return undefined;
		}

		const room = building.rooms.find((item) => item.id === roomId);
		if (room === undefined) {
			return null;
		}

		return this.toRoomResponse(buildingId, room);
	}

	/**
	 * Create or update a room
	 * @returns true if created, false if updated, null if building doesn't exist
	 */
	async putRoom(
		buildingId: string,
		roomId: string,
		building: string,
		number: string,
		type: string,
		furniture: string,
		href: string,
		seats: number
	): Promise<boolean | null> {
		const store = await this.readStore();
		const buildingData = store[buildingId];
		if (buildingData === undefined) {
			return null;
		}

		const existingIndex = buildingData.rooms.findIndex((room) => room.id === roomId);
		const isNew = existingIndex === -1;

		const room: Room = {
			id: roomId,
			building,
			number,
			type,
			furniture,
			href,
			seats,
		};

		if (isNew) {
			buildingData.rooms.push(room);
		} else {
			buildingData.rooms[existingIndex] = room;
		}

		await this.writeStore(store);
		return isNew;
	}

	/**
	 * Remove a room from a building
	 * @returns Room if removed, null if room doesn't exist, undefined if building doesn't exist
	 */
	async removeRoom(buildingId: string, roomId: string): Promise<Room | null | undefined> {
		const store = await this.readStore();
		const building = store[buildingId];
		if (building === undefined) {
			return undefined;
		}

		const index = building.rooms.findIndex((room) => room.id === roomId);
		if (index === -1) {
			return null;
		}

		const removed = building.rooms[index];
		building.rooms.splice(index, 1);
		await this.writeStore(store);
		return {
			id: removed.id,
			building: removed.building,
			number: removed.number,
			type: removed.type,
			furniture: removed.furniture,
			href: removed.href,
			seats: removed.seats,
		};
	}
}

// END AI-GENERATED CODE

//////////////////////////////////////////////////////////////////
