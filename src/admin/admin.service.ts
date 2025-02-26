import {
	BadRequestException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { hash } from 'argon2'
import { CreateInspectorDto } from 'src/inspector/dto/create.inspector.dto'
import { UpdateInspectorDto } from 'src/inspector/dto/update.inspector.dto'
import { InspectorService } from 'src/inspector/inspector.service'
import { PrismaService } from 'src/prisma.service'
import { CreateAdminDto } from './dto/create.admin.dto'
import { UpdateAdminDto } from './dto/update.admin.dto'

@Injectable()
export class AdminService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly inspectorService: InspectorService
	) {}

	async getById(id: string) {
		const admin = await this.prisma.admin.findUnique({ where: { id } })

		return admin
	}

	async getProfile(adminId: string) {
		console.log('🔍 Ищем админа с ID:', adminId)
		const admin = await this.prisma.admin.findUnique({
			where: { id: adminId },
			select: {
				id: true,
				login: true,
				name: true,
				createdAt: true,
				updatedAt: true
			}
		})

		if (!admin) {
			throw new NotFoundException('Администратор не найден')
		}
		return admin
	}

	async updateProfile(id: string, dto: UpdateAdminDto) {
		let data = { ...dto }
		if (dto.password) {
			data = { ...dto, password: await hash(dto.password) }
		}
		return this.prisma.admin.update({
			where: { id },
			data
		})
	}

	async getByLogin(login: string) {
		const admin = await this.prisma.admin.findUnique({ where: { login } })

		return admin
	}

	async createAdmin(dto: CreateAdminDto) {
		const existingAdmin = await this.prisma.admin.findUnique({
			where: { login: dto.login }
		})
		if (existingAdmin) throw new Error('Админ с таким логином уже существует')

		const admin = {
			login: dto.login,
			name: dto.name,
			password: await hash(dto.password)
		}

		return this.prisma.admin.create({
			data: admin
		})
	}

	async getAllInspectors() {
		return this.prisma.inspector.findMany({
			include: {
				fines: true
			}
		})
	}

	async createInspector(dto: CreateInspectorDto) {
		const existingInspector = await this.inspectorService.getByLogin(dto.login)
		if (existingInspector)
			throw new Error('Инспектор с таким логином уже существует')

		return this.prisma.inspector.create({
			data: {
				login: dto.login,
				name: dto.name,
				password: await hash(dto.password)
			}
		})
	}

	async updateInspector(id: string, dto: UpdateInspectorDto) {
		if (!id) throw new BadRequestException('ID инспектора не указан!')

		// Проверяем, существует ли инспектор в базе данных
		const existingInspector = await this.prisma.inspector.findUnique({
			where: { id }
		})
		if (!existingInspector) {
			throw new NotFoundException(`Инспектор с ID "${id}" не найден!`)
		}

		// Создаём объект данных для обновления
		const data: any = { ...dto }

		// Если пароль передан – хешируем, иначе удаляем его из объекта
		if (dto.password && dto.password.trim() !== '') {
			data.password = await hash(dto.password)
		} else {
			delete data.password
		}

		// Логируем перед обновлением
		console.log(`🔹 Обновление инспектора ID: ${id}`, data)

		// Выполняем обновление
		return this.prisma.inspector.update({
			where: { id },
			data
		})
	}

	async deleteInspector(id: string) {
		const inspector = await this.prisma.inspector.findUnique({ where: { id } })

		if (!inspector) {
			throw new NotFoundException('Инспектор не найден')
		}
		return this.prisma.inspector.delete({ where: { id } })
	}

	async getFines({
		inspectorId,
		status,
		sortBy = 'createdAt',
		order = 'asc'
	}: {
		inspectorId?: string
		status?: string
		sortBy?: string
		order?: string
	}) {
		const where: any = {}

		if (inspectorId) where.inspectorId = inspectorId
		if (status === 'deleted') where.status = 'deleted'

		return this.prisma.fine.findMany({
			where,
			orderBy: {
				[sortBy]: order
			},
			include: {
				inspector: true
			}
		})
	}

	async getFineDetails(id: string) {
		const fine = await this.prisma.fine.findUnique({
			where: { id },
			include: {
				inspector: true
			}
		})
		if (!fine) throw new NotFoundException('Штраф не найден')

		return fine
	}

	async deleteFine(id: string) {
		const fine = await this.prisma.fine.findUnique({ where: { id } })

		if (!fine) throw new NotFoundException('Штраф не найден')

		this.prisma.payment.deleteMany({ where: { fineId: id } })

		return this.prisma.fine.delete({ where: { id } })
	}

	async saveRefreshToken(userId: string, refreshToken: string) {
		await this.prisma.admin.update({
			where: { id: userId },
			data: { refreshToken }
		})
	}

	async clearRefreshToken(userId: string) {
		await this.prisma.admin.update({
			where: { id: userId },
			data: { refreshToken: null }
		})
	}

	async getStatistics() {
		const inspectorCount = await this.prisma.inspector.count()
		const activeFinesCount = await this.prisma.fine.count({
			where: { status: { in: ['paid', 'pending'] } }
		})
		const pendingFines = await this.prisma.fine.count({
			where: { status: { in: ['pending'] } }
		})
		return { inspectorCount, activeFinesCount, pendingFines }
	}
}
