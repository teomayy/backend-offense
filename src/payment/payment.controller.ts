import {
	BadRequestException,
	Body,
	Controller,
	HttpCode,
	Next,
	Post,
	Res
} from '@nestjs/common'
import { NextFunction, Response } from 'express'
import { PaymeMethod } from 'src/constants/payme.constants'
import { FineService } from 'src/fine/fine.service'
import { PaymeService } from './payment.service'

@Controller('payme')
export class PaymentController {
	constructor(
		private readonly paymeService: PaymeService,
		private readonly fineService: FineService
	) {}

	@Post('webhook')
	@HttpCode(200)
	async payme(
		@Body() body: any,
		@Res() res: Response,
		@Next() next: NextFunction
	) {
		try {
			const { method, params, id } = body

			let result
			switch (method) {
				case PaymeMethod.CheckPerformTransaction:
					await this.paymeService.checkPerformTransaction(params, id)
					return res.json({
						jsonrpc: '2.0',
						result: { allow: true },
						id
					})

				case PaymeMethod.CheckTransaction:
					result = await this.paymeService.checkTransaction(params)
					break

				case PaymeMethod.CreateTransaction:
					result = await this.paymeService.createTransaction(params, id)
					break

				case PaymeMethod.PerformTransaction:
					result = await this.paymeService.performTransaction(params, id)
					break

				case PaymeMethod.CancelTransaction:
					result = await this.paymeService.cancelTransaction(params, id)
					break

				case PaymeMethod.GetStatement:
					result = await this.paymeService.getStatement(params)
					result = { transactions: result }
					break

				default:
					return res.json({
						jsonrpc: '2.0',
						error: { code: -32601, message: 'Метод не поддерживается' },
						id
					})
			}

			return res.json(result)
		} catch (err) {
			next(err)
		}
	}

	@Post('process')
	async proccessPayment(
		@Body('fineId') fineId: string,
		@Body('method') method: 'payme' | 'paynet' | 'uzum'
	) {
		if (!fineId || !method) {
			throw new BadRequestException('Необходимо указать fineId и method')
		}
		return await this.fineService.processPayment(fineId, method)
	}
}
