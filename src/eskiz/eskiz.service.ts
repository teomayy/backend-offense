import { HttpService } from '@nestjs/axios'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { lastValueFrom } from 'rxjs'

@Injectable()
export class EskizService {
	private token: string

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService
	) {
		this.authenticate()
	}

	private async authenticate() {
		const email = this.configService.get<string>('ESKIZ_EMAIL')
		const password = this.configService.get<string>('ESKIZ_PASSWORD')

		try {
			const response = await lastValueFrom(
				this.httpService.post('https://notify.eskiz.uz/api/auth/login', {
					email,
					password
				})
			)
			this.token = response.data.data.token
			console.log('TOKEN', this.token)
		} catch (error) {
			console.error('Ошибка авторизации в Eskiz:', error.message)
			throw new Error('Ошибка авторизации в Eskiz')
		}
	}

	async sendSms(
		phoneNumber: string,
		message: string,
		callbackUrl?: string
	): Promise<void> {
		if (!this.token) {
			await this.authenticate()
		}
		const normalizedPhone = phoneNumber.replace(/[^0-9]/g, '')

		try {
			const formData = new URLSearchParams({
				mobile_phone: normalizedPhone,
				message,
				from: '4546'
			})

			if (callbackUrl) {
				formData.append('callback_url', callbackUrl)
			}

			const response = await lastValueFrom(
				this.httpService.post(
					'https://notify.eskiz.uz/api/message/sms/send',
					formData,
					{
						headers: {
							Authorization: `Bearer ${this.token}`
						}
					}
				)
			)

			if (response.data.status === 'waiting') {
				console.log('SMS в процессе отправки. Message ID:', response.data.id)
			} else if (response.data.status !== 'ok') {
				console.error('Ошибка отправки SMS через Eskiz:', response.data.message)
				throw new Error(`Ошибка Eskiz: ${response.data.message}`)
			} else {
				console.log('SMS успешно отправлено.')
			}
		} catch (error) {
			console.error('Ошибка отправки SMS:', error.message)
			throw new Error('Ошибка отправки SMS через Eskiz')
		}
	}
}
