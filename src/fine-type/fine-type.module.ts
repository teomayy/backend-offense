import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { FineTypeController } from './fine-type.controller'
import { FineTypeService } from './fine-type.service'

@Module({
	providers: [FineTypeService, PrismaService],
	controllers: [FineTypeController]
})
export class FineTypeModule {}
