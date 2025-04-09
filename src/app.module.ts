import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AdminModule } from './admin/admin.module'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { AuthModule } from './auth/auth.module'
import { EskizModule } from './eskiz/eskiz.module'
import { FineLogModule } from './fine-log/fine-log.module'
import { FineTypeModule } from './fine-type/fine-type.module'
import { FineModule } from './fine/fine.module'
import { InspectorModule } from './inspector/inspector.module'
import { PaymentModule } from './payment/payment.module'

@Module({
	imports: [
		ConfigModule.forRoot(),
		ScheduleModule.forRoot(),
		FineModule,
		EskizModule,
		FineTypeModule,
		PaymentModule,
		AuthModule,
		AdminModule,
		FineLogModule,
		InspectorModule,
		CacheModule.register()
	],
	controllers: [AppController],
	providers: [AppService]
})
export class AppModule {}
