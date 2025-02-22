import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { InspectorController } from './inspector.controller'
import { InspectorService } from './inspector.service'

@Module({
	providers: [InspectorService, PrismaService],
	controllers: [InspectorController],
	exports: [InspectorService]
})
export class InspectorModule {}
