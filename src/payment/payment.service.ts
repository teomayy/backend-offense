import { HttpException, HttpStatus, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import axios from 'axios'
import { PaymeError, TransactionState } from 'src/constants/payme.constants'
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
	 * 📌 Проверка возможности выполнения транзакции
	 */
	async checkPerformTransaction(params: any, id: number) {
		const { account, amount } = params

		const fine = await this.prisma.fine.findUnique({
			where: { id: account.order_id }
		})

		if (!fine) {
			throw new HttpException(PaymeError.ProductNotFound, HttpStatus.NOT_FOUND)
		}

		if (fine.amount !== amount) {
			throw new HttpException(PaymeError.InvalidAmount, HttpStatus.BAD_REQUEST)
		}

		return { jsonrpc: '2.0', result: { allow: true }, id }
	}

	/**
	 * 📌 Проверка состояния транзакции
	 */
	async checkTransaction(params: any) {
		console.log('🔹 CheckTransaction вызван:', params)

		// Проверяем, существует ли транзакция
		const transaction = await this.findTransactionById(params.id)

		if (!transaction.transactionId) {
			return {
				jsonrpc: '2.0',
				error: {
					code: -31003,
					message: {
						uz: 'Tranzaktsiya topilmadi',
						ru: 'Транзакция не найдена',
						en: 'Transaction not found'
					}
				},
				id: params.id
			}
		}

		// Формируем корректный ответ
		return {
			jsonrpc: '2.0',
			id: params.id,
			result: {
				create_time: transaction.createdAt,
				perform_time: transaction.performTime,
				cancel_time: transaction.cancelTime,
				transaction: transaction.transactionId,
				state: transaction.status === 'success' ? 2 : 1, // 2 - оплачено, 1 - ожидает
				reason: transaction.reason
			}
		}
	}

	/**
	 * 📌 Создание транзакции
	 */
	async createTransaction(params: any, requestId: number) {
		console.log('🔹 CreateTransaction вызван:', params)

		const { id: transactionId, time: createTime, amount, account } = params

		console.log('transactionIDDD', transactionId)

		if (!account || !account.order_id) {
			return {
				jsonrpc: '2.0',
				id: requestId, // ✅ Возвращаем ID запроса
				error: {
					code: -31050,
					message: {
						uz: 'Buyurtma identifikatori topilmadi',
						ru: 'Идентификатор заказа не найден',
						en: 'Order ID not found'
					}
				}
			}
		}

		const orderId = account.order_id

		// 🔎 Проверяем, существует ли штраф (счет плательщика)
		const fine = await this.prisma.fine.findUnique({
			where: { id: orderId }
		})

		if (!fine) {
			return {
				jsonrpc: '2.0',
				id: requestId, // ✅ Возвращаем ID запроса
				error: {
					code: -31050,
					message: {
						uz: 'Buyurtma topilmadi',
						ru: 'Заказ не найден',
						en: 'Order not found'
					}
				}
			}
		}

		// 💰 Проверяем, совпадает ли сумма платежа
		if (fine.amount !== amount) {
			return {
				jsonrpc: '2.0',
				id: requestId, // ✅ Возвращаем ID запроса
				error: {
					code: -31001,
					message: {
						uz: 'To‘lov summasi noto‘g‘ri',
						ru: 'Неверная сумма платежа',
						en: 'Invalid payment amount'
					}
				}
			}
		}

		const validCreateTime = Number.isInteger(createTime)
			? new Date(createTime)
			: new Date()

		// Проверяем, является ли `validCreateTime` корректной датой
		if (isNaN(validCreateTime.getTime())) {
			return {
				jsonrpc: '2.0',
				id: requestId,
				error: {
					code: -31008,
					message: {
						uz: 'Noto‘g‘ri tranzaksiya vaqti',
						ru: 'Неверное время транзакции',
						en: 'Invalid transaction time'
					}
				}
			}
		}

		// 🔎 Проверяем, есть ли уже активная транзакция для этого заказа
		const existingTransaction = await this.prisma.payment.findFirst({
			where: { fineId: orderId }
		})

		if (existingTransaction) {
			if (existingTransaction.transactionId === transactionId) {
				// ✅ Возвращаем существующую транзакцию
				return {
					jsonrpc: '2.0',
					id: requestId, // ✅ Возвращаем ID запроса
					result: {
						transaction: existingTransaction.transactionId,
						create_time: existingTransaction.createdAt.getTime(),
						state: TransactionState.Pending // Ожидание оплаты
					}
				}
			}

			// ❌ Ошибка: повторная транзакция с другим ID
			return {
				jsonrpc: '2.0',
				id: requestId, // ✅ Возвращаем ID запроса
				error: {
					code: -31050,
					message: {
						uz: 'Tranzaksiya allaqachon mavjud, boshqa ID bilan qaytadan yaratib bo‘lmaydi',
						ru: 'Транзакция уже существует, повторное создание с другим ID невозможно',
						en: 'Transaction already exists, cannot recreate with a different ID'
					}
				}
			}
		}

		// ✅ Создаем новую транзакцию
		const newTransaction = await this.prisma.payment.create({
			data: {
				fineId: orderId,
				method: 'payme',
				status: 'pending',
				createdAt: validCreateTime,
				amount: fine.amount,
				transactionId
			}
		})

		console.log(
			`✅ Транзакция ${newTransaction.transactionId} успешно создана!`
		)

		// 🔄 Запускаем таймер отмены по таймауту (12 часов = 43 200 000 мс)
		setTimeout(async () => {
			const transaction = await this.prisma.payment.findUnique({
				where: { transactionId }
			})

			if (transaction && transaction.status === 'pending') {
				await this.prisma.payment.update({
					where: { transactionId },
					data: {
						status: 'failed',
						cancelTime: new Date(),
						reason: '4' // Отмена по таймауту
					}
				})

				await this.prisma.fine.update({
					where: { id: orderId },
					data: { status: 'pending' } // Возвращаем статус "ожидание оплаты"
				})

				console.log(`❌ Транзакция ${transactionId} отменена по таймауту.`)
			}
		}, 43200000) // 12 часов

		// ✅ Возвращаем успешный ответ
		return {
			jsonrpc: '2.0',
			id: requestId, // ✅ Возвращаем ID запроса
			result: {
				transaction: newTransaction.transactionId,
				create_time: newTransaction.createdAt.getTime(),
				state: TransactionState.Pending // Ожидание оплаты
			}
		}
	}

	/**
	 * 📌 Выполнение платежа
	 */
	async performTransaction(params: any, id: number) {
		console.log('🔹 PerformTransaction вызван:', params)

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

		if (transaction.status !== 'pending') {
			if (transaction.status === 'success') {
				return {
					jsonrpc: '2.0',
					id: params.id,
					result: {
						perform_time: transaction.performTime
							? transaction.performTime.getTime()
							: 0,
						transaction: transaction.transactionId,
						state: TransactionState.Paid
					}
				}
			}
			throw new HttpException(
				PaymeError.CantDoOperation,
				HttpStatus.BAD_REQUEST
			)
		}

		const performTime = new Date()

		await this.prisma.payment.update({
			where: { transactionId: params.id },
			data: { status: 'success', performTime } // ✅ Записываем `performTime`
		})

		await this.prisma.fine.update({
			where: { id: transaction.fine.id },
			data: { status: 'paid' }
		})

		return {
			jsonrpc: '2.0',
			id: params.id,
			result: {
				perform_time: performTime.getTime(),
				transaction: transaction.transactionId,
				state: TransactionState.Paid
			}
		}
	}

	/**
	 * 📌 Отмена транзакции
	 */
	async cancelTransaction(params: any, id: number) {
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

		const cancelTime = new Date()

		await this.prisma.payment.update({
			where: { transactionId: params.id },
			data: {
				status: 'failed',
				cancelTime, // ✅ Записываем `cancelTime`
				reason: params.reason ? String(params.reason) : null // ✅ Записываем `reason`
			}
		})

		await this.prisma.fine.update({
			where: { id: transaction.fine.id },
			data: { status: 'deleted' }
		})

		return {
			jsonrpc: '2.0',
			id: params.id,
			result: {
				transaction: transaction.transactionId,
				cancel_time: cancelTime.getTime(),
				state: TransactionState.PendingCanceled,
				reason: params.reason ? String(params.reason) : null
			}
		}
	}

	/**
	 * 📌 Получение списка транзакций
	 */
	/**
	 * 📌 Получение выписки по транзакциям за указанный период
	 */
	async getStatement(params: { from: number; to: number }) {
		console.log('🔹 getStatement вызван:', params)

		const { from, to } = params

		// Преобразуем timestamps в Date
		const fromDate = new Date(from)
		const toDate = new Date(to)

		// Запрашиваем транзакции за период
		const transactions = await this.prisma.payment.findMany({
			where: {
				createdAt: {
					gte: fromDate,
					lte: toDate
				}
			},
			include: {
				fine: true // Подгружаем информацию о штрафе
			}
		})

		// Преобразуем данные в нужный формат
		return {
			jsonrpc: '2.0',
			result: transactions.map(transaction => ({
				id: transaction.transactionId,
				time: transaction.createdAt.getTime(),
				amount: transaction.amount,
				account: {
					order_id: transaction.fineId // ID заказа
				},
				create_time: transaction.createdAt.getTime(),
				perform_time: transaction.performTime
					? transaction.performTime.getTime()
					: 0,
				cancel_time: transaction.cancelTime
					? transaction.cancelTime.getTime()
					: 0,
				transaction: transaction.transactionId,
				state: transaction.status,
				reason: transaction.reason || null
			}))
		}
	}

	/**
	 * 📌 Поиск заказа (штрафа) по `order_id`
	 */
	async findOrderById(orderId: string) {
		console.log('🔹 findOrderById вызван:', orderId)

		const fine = await this.prisma.fine.findUnique({
			where: { id: orderId }
		})

		if (!fine) return null

		return {
			id: fine.id,
			amount: fine.amount,
			status: fine.status
		}
	}

	async findTransactionById(transactionId: string) {
		console.log(`🔹 Поиск транзакции по ID: ${transactionId}`)

		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId }
		})

		if (!transaction) {
			console.log(`❌ Транзакция с ID ${transactionId} не найдена`)
			return null
		}

		console.log(`✅ Найдена транзакция:`, transaction)

		const state =
			transaction.status === 'success'
				? 2
				: transaction.status === 'failed'
					? -1
					: 1

		return {
			id: transaction.id,
			transactionId: transaction.transactionId,
			fineId: transaction.fineId,
			status: transaction.status,
			createdAt: transaction.createdAt.getTime(), // Timestamp в миллисекундах
			performTime: transaction.performTime
				? transaction.performTime.getTime()
				: 0,
			cancelTime: transaction.cancelTime ? transaction.cancelTime.getTime() : 0,
			reason: transaction.reason || null,
			state
		}
	}
}
