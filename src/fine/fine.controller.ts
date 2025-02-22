import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
	UseGuards
} from '@nestjs/common'
import { FineStatus } from '@prisma/client'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { JwtAuthGuard } from 'src/auth/guards/jwt.guards'
import { RolesGuard } from 'src/auth/guards/roles.guards'
import { CreateFineDto } from './dto/create.fine.dto'
import { UpdateFineDto } from './dto/update.fine'
import { FineService } from './fine.service'

@Controller('fine')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FineController {
	constructor(private readonly fineService: FineService) {}

	@Post('create')
	@Roles('inspector')
	async createFine(
		@CurrentUser('id') inspectorId: string,
		@Body() dto: CreateFineDto
	) {
		return this.fineService.createFine(inspectorId, dto)
	}

	// @Get()
	// async getAllFines(@CurrentUser()) {
	// 	return this.fineService.getFines()
	// }

	@Get()
	async getFinesByInspector(@CurrentUser('id') inspectorId: string) {
		return this.fineService.getFinesByInspector(inspectorId)
	}

	@Get(':fineId')
	async getFineById(@Param('fineId') fineId: string) {
		return this.fineService.getFineById(fineId)
	}

	@Patch(':fineId')
	@Roles('inspector')
	async updateFine(
		@Param('fineId') fineId: string,
		@Body() dto: UpdateFineDto
	) {
		return this.fineService.updateFine(fineId, dto)
	}

	@Delete(':fineId')
	@Roles('inspector')
	async deleteFine(@Param('fineId') fineId: string) {
		return this.fineService.deleteFine(fineId)
	}

	@Get('filter')
	@Roles('inspector', 'admin')
	async getFinesWithFilter(
		@Query('inspectorId') inspectorId?: string,
		@Query('status') status?: FineStatus,
		@Query('startDate') startDate?: string,
		@Query('endDate') endDate?: string
	) {
		return this.fineService.getFinesWithFilters({
			inspectorId,
			status,
			startDate,
			endDate
		})
	}

	@Patch(':fineId/pay')
	async updateFineStatus(@Param('fineId') fineId: string) {
		return this.fineService.updateFineStatus(fineId)
	}

	@Get('inspector/stats')
	@Roles('inspector')
	async getInspectorStats(@CurrentUser('id') inspectorId: string) {
		return this.fineService.getInspectorStats(inspectorId)
	}
}
