import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { FineLogController } from './fine-log.controller'
import { FineLogService } from './fine-log.service'

@Module({
	controllers: [FineLogController],
	providers: [FineLogService, PrismaService],
	exports: [FineLogService]
})
export class FineLogModule {}
