import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { JwtAuthGuard } from 'src/auth/guards/jwt.guards'
import { RolesGuard } from 'src/auth/guards/roles.guards'
import { FineLogService } from './fine-log.service'

@Controller('/fine-log')
export class FineLogController {
	constructor(private readonly fineLogService: FineLogService) {}

	@Get(':fineId')
	@Roles('inspector', 'admin')
	@UseGuards(JwtAuthGuard, RolesGuard)
	getLogs(@Param('fineId') fineId: string, @CurrentUser() user: any) {
		return this.fineLogService.getLogsByFineId(fineId, user)
	}
}
