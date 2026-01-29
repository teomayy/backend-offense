import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
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
		console.log('✅ Сгенерирован номер платежа:', reference)
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

		// ✅ Отправляем SMS (не блокирует создание штрафа)
		try {
			await this.eskizService.sendSms(
				dto.phone,
				`Вам выписан штраф на сумму ${amount} сум. Если оплатите до ${dueDate.toLocaleDateString()}, сумма составит ${discountedAmount} сум. Оплата по счету: ${fine.paymentReference}.`
			)
			console.log('✅ SMS отправлено успешно')
		} catch (smsError) {
			console.warn('⚠️ SMS не отправлено, но штраф создан:', smsError.message)
		}

		return {
			message: 'Штраф создан. Выберите способ оплаты.',
			fineId: fine.id
		}
	}

	async processPayment(fineId: string, method: 'payme' | 'paynet' | 'uzum') {
		const fine = await this.prisma.fine.findUnique({
			where: { id: fineId }
		})

		if (!fine) {
			throw new NotFoundException('Штраф не найден')
		}

		const currentDate = new Date()
		const dueDate = new Date(fine.dueDate)

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
		if (!fine) throw new NotFoundException('Штраф не найден')

		const updatedFine = await this.prisma.fine.update({
			where: { id: fineId },
			data: { ...dto }
		})

		await this.prisma.fileLog.create({
			data: {
				fineId: fineId,
				status: updatedFine.status,
				amount: updatedFine.amount
			}
		})

		return updatedFine
	}

	async deleteFine(fineId: string) {
		const fine = await this.getFineById(fineId)
		if (!fine) {
			throw new NotFoundException('Штраф не найден')
		}

		const transactions = await this.prisma.payment.findMany({
			where: { fineId }
		})

		for (const transaction of transactions) {
			try {
				await this.paymeService.cancelTransaction(
					{ id: transaction.transactionId, reason: 4 },
					Date.now()
				)
			} catch (error) {
				console.warn(`Не удалось отменить транзакцию ${transaction.transactionId}:`, error.message)
			}
		}

		await this.prisma.payment.deleteMany({
			where: { fineId: fineId }
		})

		return this.prisma.fine.delete({
			where: { id: fineId }
		})
	}

	@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
	async handleExpiredFines() {
		const expired = await this.prisma.fine.findMany({
			where: {
				status: FineStatus.pending,
				dueDate: { lt: new Date() },
				discountedAmount: { not: null }
			}
		})

		for (const fine of expired) {
			await this.prisma.fine.update({
				where: { id: fine.id },
				data: { discountedAmount: null }
			})

			await this.prisma.fileLog.create({
				data: {
					fineId: fine.id,
					status: FineStatus.pending,
					amount: fine.amount
				}
			})

			try {
				const amountInTiyin = fine.amount * 100
				const receipt = await this.paymeService.createReceipt(
					fine.id,
					amountInTiyin,
					'Повторный счёт по истечению скидки'
				)

				const receiptId = receipt?.result?.receipt?._id

				if (receiptId) {
					await this.paymeService.sendReceipt(
						receiptId,
						fine.phone,
						`Срок скидки по штрафу истёк. Новый счёт: ${fine.amount} сум.`
					)
				}
			} catch (error) {
				this.logger.error(`Ошибка при отправке повторного чека для штрафа ${fine.id}:`, error)
			}

			try {
				await this.eskizService.sendSms(
					fine.phone,
					`Срок скидки по штрафу истёк, Новый счёт: ${fine.amount} сум.`
				)
			} catch (error) {
				this.logger.warn(`Не удалось отправить SMS: ${error.message}`)
			}
		}
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

	async getFinesByInspector(inspectorId: string) {
		return this.prisma.fine.findMany({
			where: { inspectorId },
			orderBy: { createdAt: 'desc' }
		})
	}

	async getFineById(fineId: string) {
		const fine = await this.prisma.fine.findUnique({
			where: { id: fineId },
			include: { FineType: true }
		})

		if (!fine) throw new NotFoundException('Штраф не найден')
		return fine
	}

	async getFines() {
		return this.prisma.fine.findMany()
	}

	async updateFineStatus(fineId: string) {
		const fine = await this.getFineById(fineId)
		if (!fine) throw new NotFoundException('Штраф не найден')

		if (fine.status === FineStatus.paid) {
			throw new BadRequestException('Штраф уже оплачен')
		}

		await this.prisma.fine.update({
			where: { id: fineId },
			data: { status: FineStatus.paid }
		})

		return { message: 'Статус штрафа обновлен' }
	}

	async getInspectorStats(inspectorId: string) {
		const totalFines = await this.prisma.fine.count({
			where: { inspectorId }
		})

		const paidFines = await this.prisma.fine.count({
			where: { inspectorId, status: FineStatus.paid }
		})

		const pendingFines = totalFines - paidFines

		const totalAmount = await this.prisma.fine.aggregate({
			where: { inspectorId },
			_sum: { amount: true }
		})

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
