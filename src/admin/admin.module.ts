import { Module } from '@nestjs/common'
import { InspectorService } from 'src/inspector/inspector.service'
import { PrismaService } from 'src/prisma.service'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
	providers: [AdminService, PrismaService, InspectorService],
	controllers: [AdminController],
	exports: [AdminService]
})
export class AdminModule {}
