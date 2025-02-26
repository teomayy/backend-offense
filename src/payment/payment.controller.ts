import {
	Body,
	Controller,
	Headers,
	HttpException,
	HttpStatus,
	Post
} from '@nestjs/common'
import { PaymeService } from './payment.service'

@Controller('payme')
export class PaymentController {
	constructor(private readonly paymeService: PaymeService) {}

	@Post('webhook')
	async paymeWebhook(@Body() body: any, @Headers('X-Auth') authHeader: string) {
		console.log('🔹 Получен Webhook:', JSON.stringify(body, null, 2))

		if (!this.paymeService.validateAuth(authHeader)) {
			throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED)
		}
		return this.paymeService.handleWebhook(body)
	}

	/**
	 * 📌 Создание чека
	 */

	@Post('create-receipt')
	async createReceipt(
		@Body() body: { orderId: string; amount: number; description?: string }
	) {
		return this.paymeService.createReceipt(
			body.orderId,
			body.amount,
			body.description
		)
	}

	@Post('send-receipt')
	async sendReceipt(@Body() body: { phone: string; orderId: string }) {
		return this.paymeService.sendReceipt(
			body.orderId,
			body.phone,
			'Оплата штрафа'
		)
	}
}
