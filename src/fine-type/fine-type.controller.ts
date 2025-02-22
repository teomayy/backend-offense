import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { FineTypeService } from './fine-type.service'

@Controller('fine-type')
export class FineTypeController {
	constructor(private readonly fineTypeService: FineTypeService) {}

	@Post('create')
	async createFineType(
		@Body() body: { name: string; percentage?: number; fixedAmount?: number }
	) {
		return this.fineTypeService.createFineType(
			body.name,
			body.percentage,
			body.fixedAmount
		)
	}

	@Get()
	async getFineTypes() {
		return this.fineTypeService.getFineTypes()
	}

	@Get(':id')
	async getFineTypeById(@Param('id') id: string) {
		return this.fineTypeService.getFineTypeById(id)
	}
}
