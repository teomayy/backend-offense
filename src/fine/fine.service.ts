import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common'
import { FineStatus } from '@prisma/client'

import { EskizService } from 'src/eskiz/eskiz.service'
import { PaymeService } from 'src/payment/payment.service'
import { PrismaService } from 'src/prisma.service'
import { CreateFineDto } from './dto/create.fine.dto'
import { UpdateFineDto } from './dto/update.fine'

@Injectable()
export class FineService {
	private readonly logger = new Logger(FineService.name)

	constructor(
		private prisma: PrismaService,
		private eskizService: EskizService,
		private paymeService: PaymeService
	) {}

	private generatePaymentReference(): string {
		const reference = Math.random().toString(36).substring(2, 15).toUpperCase()
		console.log('✅ Сгенерирован номер платежа:', reference) // Логируем
		return reference
	}

	async createFine(inspectorId: string, dto: CreateFineDto) {
		const fineType = await this.prisma.fineType.findUnique({
			where: { id: dto.fineTypeId }
		})

		if (!fineType) {
			throw new NotFoundException('Тип штрафа не найден')
		}

		let amount = 0
		const baseSalary = dto.baseSalary || 0

		if (fineType.fixedAmount) {
			amount = fineType.fixedAmount
		} else if (fineType.percentage) {
			if (!baseSalary) {
				throw new BadRequestException(
					'Базовый оклад обязателен для процентного штрафа'
				)
			}
			amount = Math.round(baseSalary * (fineType.percentage / 100))
		} else if (dto.amount) {
			amount = dto.amount
		} else {
			throw new Error('Необходимо указать сумму штрафа')
		}

		const discountedAmount = Math.round(amount / 2)
		const dueDate = new Date()
		dueDate.setDate(dueDate.getDate() + 15)

		try {
			// ✅ Создаём штраф
			const fine = await this.prisma.fine.create({
				data: {
					inspectorId,
					name: dto.name,
					phone: dto.phone,
					fineTypeId: dto.fineTypeId,
					baseSalary,
					amount,
					discountedAmount,
					dueDate,
					paymentReference: `F-${this.generatePaymentReference()}`,
					status: FineStatus.pending
				}
			})

			// await this.eskizService.sendSms(
			// 	dto.phone,
			// 	`Вам выписан штраф на сумму ${amount} сум. Если оплатите до ${dueDate.toLocaleDateString()}, сумма составит ${discountedAmount} сум. Оплата по счету: ${fine.paymentReference}.`
			// )

			return {
				message: 'Штраф создан. Выберите способ оплаты.',
				fineId: fine.id
			}
		} catch (error) {
			console.error('❌ Ошибка при создании штрафа и транзакции:', error)
			throw new BadRequestException('Не удалось создать штраф и транзакцию')
		}
	}

	async processPayment(fineId: string, method: 'payme' | 'paynet' | 'uzum') {
		const fine = await this.prisma.fine.findUnique({
			where: { id: fineId }
		})

		if (!fine) {
			throw new NotFoundException('Штраф не найден тут 1')
		}

		const currentDate = new Date()
		const dueDate = new Date(fine.dueDate)

		// 🏷 Если оплата в течение 15 дней — применяется скидка
		const payableAmount =
			currentDate <= dueDate && fine.discountedAmount
				? fine.discountedAmount
				: fine.amount

		if (method === 'payme') {
			await this.paymeService.checkPerformTransaction(
				{ account: { order_id: fineId }, amount: payableAmount },
				Date.now()
			)

			const receiptRes = await this.paymeService.createReceipt(
				fine.id,
				payableAmount,
				'Оплата штрафа'
			)

			if (!receiptRes?.result?.receipt?._id) {
				throw new Error('Ошибка: Payme не вернул чек (receipt)')
			}

			const transactionId = receiptRes.result.receipt._id

			// ✅ Отправляем чек клиенту
			const receiptResponse = await this.paymeService.sendReceipt(
				transactionId,
				fine.phone,
				`Вам выставлен штраф на сумму ${payableAmount} сум.`
			)

			console.log('✅ Чек отправлен в Payme:', receiptResponse)
			return {
				success: true,
				transactionId,
				paidAmount: payableAmount
			}
		}
	}

	async updateFine(fineId: string, dto: UpdateFineDto) {
		const fine = await this.getFineById(fineId)
		if (!fine) throw new NotFoundException('Штраф не найден тут 2')

		const updatedFine = await this.prisma.fine.update({
			where: { id: fineId },
			data: { ...dto }
		})

		return updatedFine
	}

	async deleteFine(fineId: string) {
		console.log(`🔹 Удаление штрафа с ID: ${fineId}`)

		const fine = await this.getFineById(fineId)
		if (!fine) {
			console.error(`❌ Штраф с ID ${fineId} не найден!`)
			throw new NotFoundException('Штраф не найден тут 3')
		}

		console.log(`✅ Штраф найден: ${JSON.stringify(fine, null, 2)}`)

		// Удаление связанных платежей
		await this.prisma.payment.deleteMany({
			where: { fineId: fineId }
		})

		// Удаление штрафа
		return this.prisma.fine.delete({
			where: { id: fineId }
		})
	}

	async getFinesWithFilters(query: {
		inspectorId?: string
		status?: FineStatus
		startDate?: string
		endDate?: string
	}) {
		const { inspectorId, status, startDate, endDate } = query

		const where: any = {}

		if (inspectorId) where.inspectorId = inspectorId
		if (status) where.status = status
		if (startDate && endDate) {
			where.issuedAt = { gte: new Date(startDate), lte: new Date(endDate) }
		}

		return this.prisma.fine.findMany({ where, orderBy: { createdAt: 'desc' } })
	}

	/**
	 * Получение штрафов инспектора
	 */
	async getFinesByInspector(inspectorId: string) {
		return this.prisma.fine.findMany({
			where: { inspectorId },
			orderBy: { createdAt: 'desc' }
		})
	}

	/**
	 * Получение информации о конкретном штрафе
	 */
	async getFineById(fineId: string) {
		const fine = await this.prisma.fine.findUnique({
			where: { id: fineId },
			include: { FineType: true }
		})

		if (!fine) throw new NotFoundException('Штраф не найден тут 4')

		return fine
	}

	async getFines() {
		return this.prisma.fine.findMany()
	}

	async updateFineStatus(fineId: string) {
		const fine = await this.getFineById(fineId)
		if (!fine) throw new NotFoundException('Штраф не найден тут 5')

		if (fine.status === FineStatus.paid) {
			throw new BadRequestException('Штраф уже оплачен')
		}

		await this.prisma.fine.update({
			where: { id: fineId },
			data: { status: FineStatus.paid }
		})

		return { message: 'Статус штрафа обновлен' }
	}

	/**
	 * Получение статистики по штрафам инспектора
	 */

	async getInspectorStats(inspectorId: string) {
		// Общее количество штрафов
		const totalFines = await this.prisma.fine.count({
			where: { inspectorId }
		})

		// Количество оплаченных штрафов
		const paidFines = await this.prisma.fine.count({
			where: { inspectorId, status: FineStatus.paid }
		})

		// Общая сумма выписанных штрафов
		const pendingFines = totalFines - paidFines

		// Общая сумма выписанных штрафов
		const totalAmount = await this.prisma.fine.aggregate({
			where: { inspectorId },
			_sum: { amount: true }
		})

		// Сумма оплаченных штрафов
		const paidAmount = await this.prisma.fine.aggregate({
			where: { inspectorId, status: FineStatus.paid },
			_sum: { amount: true }
		})

		return {
			totalAmount: totalAmount._sum.amount || 0,
			totalFines,
			paidAmount: paidAmount._sum.amount || 0,
			pendingFines,
			paidFines
		}
	}
}
