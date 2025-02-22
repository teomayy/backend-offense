import { PartialType } from '@nestjs/mapped-types'
import { IsOptional, IsString, MinLength } from 'class-validator'
import { CreateAdminDto } from './create.admin.dto'

export class UpdateAdminDto extends PartialType(CreateAdminDto) {
	@IsString()
	@IsOptional()
	login?: string

	@IsString()
	@IsOptional()
	name?: string

	@IsOptional()
	@MinLength(6, {
		message: 'Пароль должен быть не менее 6 символов'
	})
	@IsString()
	password?: string
}
