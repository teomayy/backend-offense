import {
	Body,
	Controller,
	Get,
	HttpCode,
	Put,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Auth } from 'src/auth/decorators/auth.decorator'
import { CurrentUser } from 'src/auth/decorators/user.decorator'
import { UpdateInspectorDto } from './dto/update.inspector.dto'
import { InspectorService } from './inspector.service'

@Controller('inspector/profile')
export class InspectorController {
	constructor(private readonly inspectorService: InspectorService) {}

	@Auth()
	@Get()
	async profile(@CurrentUser('id') id: string) {
		return this.inspectorService.getProfile(id)
	}

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Put()
	@Auth()
	async updateProfile(
		@CurrentUser('id') id: string,
		@Body() dto: UpdateInspectorDto
	) {
		return this.inspectorService.update(id, dto)
	}
}
