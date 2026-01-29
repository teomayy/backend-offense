import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsPhoneNumber,
	IsString,
	Min
} from 'class-validator'
import { Transform } from 'class-transformer'

export class CreateFineDto {
	@IsString()
	@IsNotEmpty()
	name: string

	@IsNotEmpty()
	@IsPhoneNumber('UZ')
	phone: string

	@IsNotEmpty()
	fineTypeId: string

	@IsOptional()
	@Transform(({ value }) => value === '' || value === null || value === undefined ? 0 : Number(value))
	@IsInt()
	@Min(0)
	baseSalary?: number

	@IsOptional()
	@Transform(({ value }) => value === '' || value === null || value === undefined ? 0 : Number(value))
	@IsInt()
	@Min(0)
	amount?: number
}
