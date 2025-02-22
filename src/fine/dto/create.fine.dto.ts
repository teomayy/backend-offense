import {
	IsInt,
	IsNotEmpty,
	IsPhoneNumber,
	IsString,
	Min
} from 'class-validator'

export class CreateFineDto {
	@IsString()
	@IsNotEmpty()
	name: string

	@IsNotEmpty()
	@IsPhoneNumber('UZ')
	phone: string

	@IsNotEmpty()
	fineTypeId: string

	@IsNotEmpty()
	@IsInt()
	@Min(0)
	baseSalary?: number

	@IsInt()
	@Min(0)
	amount?: number
}
