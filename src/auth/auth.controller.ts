import {
	Body,
	Controller,
	HttpCode,
	Post,
	Req,
	Res,
	UnauthorizedException,
	UseGuards,
	UsePipes,
	ValidationPipe
} from '@nestjs/common'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { CurrentUser } from './decorators/user.decorator'
import { AuthDto } from './dto/auth.dto'
import { JwtAuthGuard } from './guards/jwt.guards'
import { RequestWithUser } from './types/request.with.user'

@Controller('auth')
export class AuthController {
	constructor(private readonly authService: AuthService) {}

	// @Post('register')
	// async register(@Body() dto: AuthDto) {
	// 	return this.authService.register(dto)
	// }

	@UsePipes(new ValidationPipe())
	@HttpCode(200)
	@Post('login')
	async login(@Body() dto: AuthDto, @Res({ passthrough: true }) res: Response) {
		const { refreshToken, ...response } = await this.authService.login(dto)
		this.authService.addRefreshTokenToResponse(res, refreshToken)
		return response
	}

	@Post('verify-role')
	@UseGuards(JwtAuthGuard)
	verifyRole(@Req() req: any) {
		try {
			const user = req.user
			return { role: user.role }
		} catch (error) {
			return { role: null }
		}
	}

	@HttpCode(200)
	@Post('login/access-token')
	async getNewTokens(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshTokenFromCookies =
			req.cookies[this.authService.REFRESH_TOKEN_NAME]

		if (!refreshTokenFromCookies) {
			this.authService.removeRefreshTokenResponse(res)
			throw new UnauthorizedException('Refresh token not passed')
		}

		const { refreshToken, ...response } = await this.authService.getNewTokens(
			refreshTokenFromCookies
		)

		this.authService.addRefreshTokenToResponse(res, refreshToken)

		return response
	}

	@Post('logout')
	async logout(@Res({ passthrough: true }) res: Response) {
		// const refreshToken = req.cookies?.refreshToken
		this.authService.removeRefreshTokenResponse(res)
		return true
	}

	@HttpCode(200)
	@Post('force-logout')
	async forceLogout(
		@Req() req: RequestWithUser,
		@Res() res: Response,
		@CurrentUser('role') role: string
	) {
		const user = req.user as any

		if (!user) throw new UnauthorizedException('Пользователь не авторизован')

		await this.authService.forceLogout(user.id, role)
		this.authService.removeRefreshTokenResponse(res)
		return true
	}
}
