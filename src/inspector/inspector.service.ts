import { Injectable } from '@nestjs/common'
import { hash } from 'argon2'
import { PrismaService } from 'src/prisma.service'
import { UpdateInspectorDto } from './dto/update.inspector.dto'

@Injectable()
export class InspectorService {
	constructor(private readonly prisma: PrismaService) {}

	async getById(id: string) {
		const inspector = await this.prisma.inspector.findUnique({
			where: {
				id
			}
		})
		return inspector
	}

	async getByLogin(login: string) {
		const inspector = await this.prisma.inspector.findUnique({
			where: { login }
		})

		return inspector
	}

	async getProfile(id: string) {
		const profile = await this.getById(id)

		const [totalFines, paidFines, pendingFines] = await Promise.all([
			this.prisma.fine.count({ where: { inspectorId: id } }),
			this.prisma.fine.count({
				where: { inspectorId: id, status: { in: ['paid'] } }
			}),
			this.prisma.fine.count({
				where: { inspectorId: id, status: { in: ['pending'] } }
			})
		])

		return {
			inspector: profile,
			statistics: {
				totalFines,
				paidFines,
				pendingFines
			}
		}
	}

	async update(id: string, dto: UpdateInspectorDto) {
		let data = dto

		if (dto.password) {
			data = { ...dto, password: await hash(dto.password) }
		}

		return this.prisma.inspector.update({
			where: {
				id
			},
			data,
			select: {
				name: true
			}
		})
	}

	async saveRefreshToken(userId: string, refreshToken: string) {
		await this.prisma.inspector.update({
			where: { id: userId },
			data: { refreshToken }
		})
	}

	async clearRefreshToken(userId: string) {
		await this.prisma.inspector.update({
			where: { id: userId },
			data: { refreshToken: null }
		})
	}
}
