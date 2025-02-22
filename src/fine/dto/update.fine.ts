import {
	IsInt,
	IsOptional,
	IsPhoneNumber,
	IsString,
	Min
} from 'class-validator'

export class UpdateFineDto {
	@IsOptional()
	@IsString()
	name?: string

	@IsOptional()
	@IsPhoneNumber('UZ')
	phone?: string

	@IsOptional()
	fineTypeId?: string

	@IsOptional()
	@IsInt()
	@Min(0)
	baseSalary?: number

	@IsOptional()
	@IsInt()
	@Min(0)
	amount?: number
}
