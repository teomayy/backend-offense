import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Put,
	Query,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { CreateInspectorDto } from 'src/inspector/dto/create.inspector.dto'
import { UpdateInspectorDto } from 'src/inspector/dto/update.inspector.dto'
import { AdminService } from './admin.service'
import { UpdateAdminDto } from './dto/update.admin.dto'

@Controller('admin')
export class AdminController {
	constructor(private readonly adminService: AdminService) {}

	@Post('inspector')
	@UsePipes(new ValidationPipe())
	async createInspector(@Body() dto: CreateInspectorDto) {
		return this.adminService.createInspector(dto)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Put()
	@Auth()
	async updateProfile(
		@CurrentUser('id') id: string,
		@Body() dto: UpdateAdminDto
	) {
		return this.adminService.updateProfile(id, dto)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Put('inspector/:id')
	@Auth()
	async updateInspector(
		@Param('id') id: string,
		@Body() dto: UpdateInspectorDto
	) {
		return this.adminService.updateInspector(id, dto)
	}

	@Auth()
	@Get()
	async profile(@CurrentUser('id') id: string) {
		return this.adminService.getProfile(id)
	}

	@Get('inspectors')
	async getInspectors() {
		return this.adminService.getAllInspectors()
	}

	@Delete('inspector/:id')
	async deleteInspector(@Param('id') id: string) {
		return this.adminService.deleteInspector(id)
	}

	@Get('fines')
	async getFines(
		@Query('inspectorId') inspectorId?: string,
		@Query('status') status?: string,
		@Query('sortBy') sortBy?: string,
		@Query('order') order: 'asc' | 'desc' = 'asc'
	) {
		return this.adminService.getFines({
			inspectorId,
			status,
			sortBy,
			order
		})
	}

	@Get('fines/:id')
	async getFinesDetails(@Param('id') id: string) {
		return this.adminService.getFineDetails(id)
	}

	@Delete('fine/:id')
	async deleteFine(@Param('id') id: string) {
		return this.adminService.deleteFine(id)
	}

	@Get('/stats')
	getStatistics() {
		return this.adminService.getStatistics()
	}
}
