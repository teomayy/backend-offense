import { Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'

@Injectable()
export class FineTypeService {
	constructor(private prisma: PrismaService) {}

	/**
	 * Создание нового типа штрафа
	 */
	async createFineType(
		name: string,
		percentage?: number,
		fixedAmount?: number
	) {
		return this.prisma.fineType.create({
			data: {
				name,
				percentage,
				fixedAmount
			}
		})
	}

	/**
	 * Получение списка типов штрафов
	 */
	async getFineTypes() {
		return this.prisma.fineType.findMany()
	}

	/**
	 * Получение информации о конкретном типе штрафа
	 */
	async getFineTypeById(id: string) {
		return this.prisma.fineType.findUnique({ where: { id } })
	}

	async deleteFineType(id: string) {
		return this.prisma.fineType.delete({ where: { id } })
	}
}
