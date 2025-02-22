import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { EskizService } from './eskiz.service'

@Module({
	imports: [ConfigModule, HttpModule],
	providers: [EskizService],
	exports: [EskizService]
})
export class EskizModule {}
