import {
	ForbiddenException,
	Injectable,
	NotFoundException
} from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'

@Injectable()
export class FineLogService {
	constructor(private prisma: PrismaService) {}

	async getLogsByFineId(fineId: string, user: { role: string; id: string }) {
		const fine = await this.prisma.fine.findUnique({ where: { id: fineId } })

		if (!fine) throw new NotFoundException('Штраф не найден')

		if (user.role === 'inspector' && fine.inspectorId !== user.id) {
			throw new ForbiddenException('Нет доступа к логам этого штрафа')
		}

		return this.prisma.fileLog.findMany({
			where: { fineId },
			orderBy: { createdAt: 'desc' }
		})
	}
}
