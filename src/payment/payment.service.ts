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
		this.PAYME_KEY = this.configService.get<string>('PAYME_SECRET_KEY_PROD')
		this.PAYME_MERCHANT_ID = this.configService.get<string>('PAYME_MERCHANT_ID')
		this.PAYME_BASE_URL = 'https://checkout.paycom.uz/api'
		if (!this.PAYME_KEY || !this.PAYME_MERCHANT_ID) {
			console.error('❌ PAYME конфигурация не найдена!')
			throw new Error('PAYME ключи не настроены')
		}
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
								code: '10902002003000999',
								package_code: '1321964',
								vat_percent: 12
							}
						]
					}
				}
			}

			const xAuth = `${this.PAYME_MERCHANT_ID?.trim()}:${this.PAYME_KEY?.trim()}`

			console.log('🔹 PAYME_AUTH:', xAuth)
			console.log('🔹 PAYME_PAYLOAD:', JSON.stringify(payload, null, 2))

			const response = await axios.post(
				`${this.PAYME_BASE_URL}`, // ✅ Убрал `/api`
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

			const xAuth = `${this.PAYME_MERCHANT_ID?.trim()}:${this.PAYME_KEY?.trim()}`

			console.log('🔹 PAYME_AUTH:', xAuth)
			console.log('🔹 PAYME_PAYLOAD:', JSON.stringify(payload, null, 2))

			const response = await axios.post(
				`${this.PAYME_BASE_URL}`, // ✅ Убрал `/api`
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

		try {
			if (!account || !account.order_id) {
				return {
					jsonrpc: '2.0',
					error: {
						code: -31050,
						message: {
							uz: 'Buyurtma identifikatori topilmadi',
							ru: 'Идентификатор заказа не найден',
							en: 'Order ID not found'
						}
					},
					id
				}
			}

			const fine = await this.prisma.fine.findUnique({
				where: { id: account.order_id }
			})

			console.log('FINE', fine)

			// ❌ Если штраф не найден
			if (!fine) {
				return {
					jsonrpc: '2.0',
					id: null,
					error: PaymeError.ProductNotFound
				}
			}

			const issuedAt = new Date(fine.issuedAt)
			const dueDate = new Date(issuedAt)
			dueDate.setDate(dueDate.getDate() + 15)

			const now = new Date()
			const isDiscountAvailable = now <= dueDate

			const payableAmount = isDiscountAvailable
				? fine.discountedAmount || fine.amount
				: fine.amount

			if (!payableAmount) {
				return {
					jsonrpc: '2.0',
					id: null,
					error: {
						code: -31001,
						message: {
							uz: "To'lov summasi aniqlanmadi",
							ru: 'Сумма для оплаты не определена',
							en: 'Payment amount not determined'
						}
					}
				}
			}

			if (amount !== payableAmount) {
				return {
					jsonrpc: '2.0',
					id: null,
					error: PaymeError.InvalidAmount
				}
			}

			return { jsonrpc: '2.0', result: { allow: true }, id }
		} catch (error) {
			console.error('Ошибка в checkPerformTransaction:', error)

			// ❌ Возвращаем JSON-RPC ошибку сервера
			return {
				jsonrpc: '2.0',
				id: null,
				error: {
					code: -31008, // Код ошибки сервера
					message: {
						uz: 'Ichki server xatosi',
						ru: 'Внутренняя ошибка сервера',
						en: 'Internal server error'
					}
				}
			}
		}
	}

	/**
	 * 📌 Проверка состояния транзакции
	 */
	async checkTransaction(params: any, requestId: number) {
		console.log('🔹 CheckTransaction вызван:', params)

		// Проверяем, существует ли транзакция
		// 🔍 Ищем транзакцию в базе
		const { id: transactionId } = params

		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId }
		})

		if (!transaction) {
			return {
				jsonrpc: '2.0',
				id: requestId,
				error: {
					code: -31003,
					message: {
						uz: 'Tranzaktsiya topilmadi',
						ru: 'Транзакция не найдена',
						en: 'Transaction not found'
					}
				}
			}
		}

		const cancelTime = transaction.cancelTime
			? transaction.cancelTime.getTime()
			: 0

		let state = 1
		if (transaction.status === 'success') state = 2
		if (transaction.status === 'canceled') state = transaction.state

		// Формируем корректный ответ
		if (state === 1) {
			return {
				jsonrpc: '2.0',
				id: requestId,
				result: {
					create_time: transaction.createdAt.getTime(),
					perform_time: transaction.performTime
						? transaction.performTime.getTime()
						: 0,
					cancel_time: 0, // ✅ Исправлено! API ожидает `0`
					transaction: transaction.transactionId,
					state: state, // ✅ Должно быть `1`
					reason: null // ✅ Исправлено! Должно быть `null`
				}
			}
		}

		// ✅ Если транзакция отменена, возвращаем `cancel_time` и `reason`
		return {
			jsonrpc: '2.0',
			id: requestId,
			result: {
				create_time: transaction.createdAt.getTime(),
				perform_time: transaction.performTime
					? transaction.performTime.getTime()
					: 0,
				cancel_time: cancelTime, // ✅ Теперь `0`, если транзакция не отменена
				transaction: transaction.transactionId,
				state: state,
				reason: transaction.reason || null // ✅ Теперь `null`, если нет причины
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

		// 📅 Рассчитываем, действует ли скидка
		const issuedAt = new Date(fine.issuedAt)
		const dueDate = new Date(issuedAt)
		dueDate.setDate(dueDate.getDate() + 15) // 15 дней с даты выдачи

		const now = new Date()
		const isDiscountAvailable = now <= dueDate

		// 💰 Определяем сумму оплаты с учетом скидки
		const payableAmount = isDiscountAvailable
			? fine.discountedAmount || fine.amount
			: fine.amount

		// 💰 Проверяем, совпадает ли сумма платежа
		if (payableAmount !== amount) {
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
				state: TransactionState.Pending,
				amount: payableAmount,
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
						status: 'canceled',
						cancelTime: new Date(),
						reason: 4 // Отмена по таймауту
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
	async performTransaction(params: any) {
		console.log('🔹 PerformTransaction вызван:', params)

		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId: params.id },
			include: { fine: true }
		})

		if (!transaction) {
			return {
				jsonrpc: '2.0',
				id: null,
				error: PaymeError.TransactionNotFound
			}
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
			return {
				jsonrpc: '2.0',
				id: null,
				error: PaymeError.CantDoOperation
			}
		}

		const performTime = new Date()

		await this.prisma.payment.update({
			where: { transactionId: params.id },
			data: {
				status: 'success',
				state: TransactionState.Paid,
				performTime: new Date()
			}
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
	async cancelTransaction(params: any, requestId: number) {
		console.log('🔹 CancelTransaction вызван:', params)

		const { id: transactionId, reason } = params

		// Поиск транзакции в базе
		const transaction = await this.prisma.payment.findUnique({
			where: { transactionId },
			include: { fine: true }
		})

		if (!transaction) {
			return {
				jsonrpc: '2.0',
				id: requestId,
				error: {
					code: -31003,
					message: {
						uz: 'Tranzaksiya topilmadi',
						ru: 'Транзакция не найдена',
						en: 'Transaction not found'
					}
				}
			}
		}

		// const currentTime = Date.now()

		// Если транзакция уже отменена, возвращаем её текущий статус без изменений
		if (transaction.state === -1 || transaction.state === -2) {
			return {
				jsonrpc: '2.0',
				id: requestId,
				result: {
					transaction: transactionId,
					cancel_time: transaction.cancelTime
						? transaction.cancelTime.getTime()
						: 0, // ✅ Всегда возвращаем timestamp
					state: transaction.state,
					reason: transaction.reason || null
				}
			}
		}

		// Определяем новый статус транзакции
		let newState = -1 // По умолчанию -1 (отмена)

		if (transaction.state === 2) {
			newState = -2 // Если транзакция завершена, устанавливаем -2
		}

		// Если транзакция ещё не отменена, устанавливаем `cancel_time`
		const cancelTime = transaction.cancelTime
			? transaction.cancelTime
			: new Date()

		// Обновляем статус транзакции в базе
		await this.prisma.payment.update({
			where: { transactionId },
			data: {
				status: 'canceled',
				cancelTime: cancelTime, // ✅ Гарантируем сохранение времени отмены
				state: newState,
				reason
			}
		})

		// Если транзакция была завершена (state = -2), обновляем статус заказа
		if (newState === -2 || -1) {
			await this.prisma.fine.update({
				where: { id: transaction.fineId },
				data: { status: 'deleted' }
			})
		}

		// Возвращаем корректный JSON-RPC ответ
		return {
			jsonrpc: '2.0',
			id: requestId,
			result: {
				transaction: transactionId,
				cancel_time: cancelTime.getTime(), // ✅ Теперь это всегда timestamp
				state: newState,
				reason
			}
		}
	}

	/* 📌 Получение выписки по транзакциям за указанный период
	 */
	async getStatement(params: { from: number; to: number }, requestId: number) {
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
			id: requestId,
			result: {
				transactions: transactions.map(transaction => ({
					id: transaction.transactionId,
					amount: transaction.amount,
					create_time: transaction.createdAt.getTime(),
					perform_time: transaction.performTime
						? transaction.performTime.getTime()
						: 0,
					cancel_time: transaction.cancelTime
						? transaction.cancelTime.getTime()
						: 0,
					transaction: transaction.transactionId,
					state: transaction.state, // Используем поле state
					reason: transaction.reason || null
					// receivers: null // Добавляем поле receivers, если нужно
				}))
			}
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
				: transaction.status === 'canceled'
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
