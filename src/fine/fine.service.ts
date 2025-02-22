import {
	BadRequestException,
	Injectable,
	Logger,
	NotFoundException
} from '@nestjs/common'
import { FineStatus } from '@prisma/client'

import { EskizService } from 'src/eskiz/eskiz.service'
import { PrismaService } from 'src/prisma.service'
import { CreateFineDto } from './dto/create.fine.dto'
import { UpdateFineDto } from './dto/update.fine'

@Injectable()
export class FineService {
	private readonly logger = new Logger(FineService.name)

	constructor(
		private prisma: PrismaService,
		private eskizService: EskizService
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
				paymentReference: this.generatePaymentReference(),
				status: FineStatus.pending
			}
		})

		await this.eskizService.sendSms(
			dto.phone,
			`Вам выписан штраф на сумму ${amount} сум. Если оплатите до ${dueDate.toLocaleDateString()}, сумма составит ${discountedAmount} сум. Оплата по счету: ${fine.paymentReference}.`
		)

		this.logger.log(
			`Инспектор ${inspectorId} выписал штраф ${fine.id} на сумму ${fine.amount} сум.`
		)

		return fine
	}

	async updateFine(fineId: string, dto: UpdateFineDto) {
		const fine = await this.getFineById(fineId)
		if (!fine) throw new NotFoundException('Штраф не найден')

		const updatedFine = await this.prisma.fine.update({
			where: { id: fineId },
			data: { ...dto }
		})

		return updatedFine
	}

	async deleteFine(fineId: string) {
		const fine = await this.getFineById(fineId)
		if (!fine) throw new NotFoundException('Штраф не найден')

		await this.prisma.fine.delete({ where: { id: fineId } })

		return true
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
