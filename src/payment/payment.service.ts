import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import {
	PaymeError,
	PaymeMethod,
	TransactionState
} from 'src/constants/payme.constants'
import { PrismaService } from 'src/prisma.service'

@Injectable()
export class PaymeService {
	private readonly PAYME_KEY: string
	private readonly PAYME_MERCHANT_ID: string
	private readonly PAYME_BASE_URL: string

	constructor(
		private configService: ConfigService,
		private readonly prisma: PrismaService
	) {
		this.PAYME_KEY = this.configService.get<string>('PAYME_SECRET_KEY_TEST')
		this.PAYME_MERCHANT_ID = this.configService.get<string>('PAYME_MERCHANT_ID')
		this.PAYME_BASE_URL = 'https://test.paycom.uz'
	}

	/**
	 * 📌 Создание чека через API Payme
	 */
	async createReceipt(orderId: string, amount: number, description?: string) {
		try {
			const payload = {
				id: Date.now().toString(),
				method: 'receipts.create',
				params: {
					amount,
					account: { order_id: orderId },
					description: description || 'Оплата штрафа',
					detail: {
						receipt_type: 0,
						items: [
							{
								title: 'Оплата штрафа',
								price: amount,
								count: 1,
								code: '00702001001000001',
								package_code: '123456',
								vat_percent: 15
							}
						]
					}
				}
			}

			const xAuth = `${'5e730e8e0b852a417aa49ceb'.trim()}:${'ZPDODSiTYKuX0jyO7Kl2to4rQbNwG08jbghj'.trim()}`

			console.log('🔹 PAYME_AUTH:', xAuth)
			console.log('🔹 PAYME_PAYLOAD:', JSON.stringify(payload, null, 2))

			const response = await axios.post(
				`https://checkout.test.paycom.uz/api`, // ✅ Убрал `/api`
				payload,
				{
					headers: {
						'Content-Type': 'application/json',
						'X-Auth': xAuth
					}
				}
			)
			return response.data
		} catch (error) {
			console.error(
				'❌ Ошибка при создании чека в Payme:',
				error.response?.data || error
			)
			throw new HttpException(
				`Ошибка Payme: ${error.response?.data?.error?.message || 'Неизвестная ошибка'}`,
				HttpStatus.BAD_REQUEST
			)
		}
	}

	/**
	 * 📌 Отправка чека через API Payme
	 */
	async sendReceipt(receiptId: string, phone: string, description: string) {
		try {
			const payload = {
				id: Date.now().toString(),
				method: 'receipts.send',
				params: {
					id: receiptId,
					phone,
					description
				}
			}

			const xAuth = `${'5e730e8e0b852a417aa49ceb'.trim()}:${'ZPDODSiTYKuX0jyO7Kl2to4rQbNwG08jbghj'.trim()}`

			console.log('🔹 PAYME_AUTH:', xAuth)
			console.log('🔹 PAYME_PAYLOAD:', JSON.stringify(payload, null, 2))

			const response = await axios.post(
				`https://checkout.test.paycom.uz/api`, // ✅ Убрал `/api`
				payload,
				{
					headers: {
						'Content-Type': 'application/json',
						'X-Auth': xAuth
					}
				}
			)

			return response.data
		} catch (error) {
			console.error('❌ Ошибка при отправке чека в Payme:', error)
			throw new HttpException(
				`Ошибка Payme: ${error.response?.data?.error?.message || 'Неизвестная ошибка'}`,
				HttpStatus.BAD_REQUEST
			)
		}
	}

	/**
	 * 📌 Выполнение платежа (изменение статуса + отправка чека)
	 */
	async performTransaction(params: any) {
		console.log('🔹 PerformTransaction вызван:', params)

		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId: params.id },
			include: { fine: true }
		})

		if (!transaction || transaction.status !== 'pending') {
			throw new HttpException(
				PaymeError.TransactionNotFound,
				HttpStatus.BAD_REQUEST
			)
		}

		// Обновляем статус платежа и штрафа
		await this.prisma.payment.update({
			where: { id: transaction.id },
			data: { status: 'success' }
		})

		await this.prisma.fine.update({
			where: { id: transaction.fine.id },
			data: { status: 'paid' }
		})
		// Отправка чека
		const receiptResponse = await this.sendReceipt(
			transaction.fine.id,
			transaction.fine.phone,
			'Оплата штрафа'
		)

		return {
			result: {
				transaction: transaction.id,
				perform_time: Date.now(),
				state: TransactionState.Paid,
				receipt: receiptResponse
			}
		}
	}

	/**
	 * 📌 Валидация запроса по `X-Auth`
	 */
	validateAuth(authHeader: string): boolean {
		if (!authHeader) return false
		console.log('🔹 Заголовок Authorization:', authHeader)

		const authString =
			`Basic ` +
			Buffer.from(authHeader.split(' ')[1] || '', 'base64').toString()

		console.log('🔹 Декодированный заголовок:', authString)
		console.log('🔹 Ожидаем:', `${this.PAYME_MERCHANT_ID}:${this.PAYME_KEY}`)

		return authString === `${this.PAYME_MERCHANT_ID}:${this.PAYME_KEY}`
	}

	/**
	 * 📌 Обработка входящих запросов от Payme
	 */
	async handleWebhook(body: any) {
		const { method, params } = body

		switch (method) {
			case PaymeMethod.CheckPerformTransaction:
				return this.checkPerformTransaction(params)
			case PaymeMethod.CreateTransaction:
				return this.createTransaction(params)
			case PaymeMethod.PerformTransaction:
				return this.performTransaction(params)
			case PaymeMethod.CancelTransaction:
				return this.cancelTransaction(params)
			case PaymeMethod.CheckTransaction:
				return this.checkTransaction(params)
			default:
				throw new HttpException(
					{ code: -32601, message: { ru: 'Метод не поддерживается' } },
					HttpStatus.BAD_REQUEST
				)
		}
	}

	/**
	 * 📌 Проверка, можно ли выполнить платёж (есть ли такой заказ)
	 */
	async checkPerformTransaction(params: any) {
		console.log('🔹 CheckPerformTransaction вызван:', params)

		const orderId = params.account?.order_id

		if (!orderId) {
			throw new HttpException(PaymeError.ProductNotFound, HttpStatus.NOT_FOUND)
		}

		const fine = await this.findOrderById(orderId)
		if (!fine) {
			throw new HttpException(PaymeError.ProductNotFound, HttpStatus.NOT_FOUND)
		}

		if (fine.status !== 'pending') {
			throw new HttpException(
				PaymeError.CantDoOperation,
				HttpStatus.BAD_REQUEST
			)
		}

		if (fine.amount !== params.amount) {
			throw new HttpException(PaymeError.InvalidAmount, HttpStatus.BAD_REQUEST)
		}

		return { result: { allow: true } }
	}

	/**
	 * 📌 Создание транзакции
	 */
	async createTransaction(params: any) {
		console.log('🔹 CreateTransaction вызван:', params)

		const orderId = params.account?.order_id
		if (!orderId) {
			throw new HttpException(
				PaymeError.ProductNotFound,
				HttpStatus.BAD_REQUEST
			)
		}

		const fine = await this.findOrderById(orderId)
		if (!fine) {
			throw new HttpException(PaymeError.ProductNotFound, HttpStatus.NOT_FOUND)
		}

		if (fine.status !== 'pending') {
			throw new HttpException(
				PaymeError.CantDoOperation,
				HttpStatus.BAD_REQUEST
			)
		}

		const transaction = await this.prisma.payment.create({
			data: {
				fineId: orderId,
				method: 'payme',
				status: 'pending',
				transactionId: params.id
			}
		})
		return {
			result: {
				transaction: transaction.transactionId,
				create_time: Date.now(),
				state: TransactionState.Pending // В ожидании
			}
		}
	}

	/**
	 * 📌 Проверка существования транзакции
	 */
	async checkTransaction(params: any) {
		console.log('🔹 CheckTransaction:', params)
		// Здесь проверяем, существует ли транзакция
		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId: params.id }
		})

		if (!transaction) {
			throw new HttpException(
				PaymeError.TransactionNotFound,
				HttpStatus.NOT_FOUND
			)
		}

		return {
			result: {
				create_time: transaction.createdAt.getTime(),
				transaction: transaction.transactionId,
				state:
					transaction.status === 'success'
						? TransactionState.Paid
						: TransactionState.Pending
			}
		}
	}

	/**
	 * 📌 Отмена транзакции
	 */
	async cancelTransaction(params: any) {
		console.log('🔹 CancelTransaction вызван:', params)

		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId: params.id },
			include: { fine: true }
		})

		if (!transaction) {
			throw new HttpException(
				PaymeError.TransactionNotFound,
				HttpStatus.NOT_FOUND
			)
		}

		await this.prisma.payment.update({
			where: { id: transaction.id },
			data: { status: 'failed' }
		})

		await this.prisma.fine.update({
			where: { id: transaction.fine.id },
			data: { status: 'pending' } // Возвращаем штраф в статус ожидания
		})

		return {
			result: {
				transaction: transaction.id,
				cancel_time: Date.now(),
				state: TransactionState.PendingCanceled
			}
		}
	}

	/**
	 * 📌 Метод-заглушка: поиск заказа по ID
	 */
	async findOrderById(id: string) {
		const fine = await this.prisma.fine.findUnique({
			where: { id: id }
		})

		if (!fine) return null

		return {
			id: fine.id,
			amount: fine.amount,
			status: fine.status
		}
	}

	/**
	 * 📌 Метод-заглушка: поиск транзакции по ID
	 */
	async findTransactionById(id: string) {
		return {
			id,
			createTime: Date.now(),
			status: 1, // 1 - в ожидании, 2 - выполнена, -1 - отменена
			amount: 100000,
			save: async function () {
				console.log(`Transaction ${this.id} updated!`)
			}
		}
	}
}
