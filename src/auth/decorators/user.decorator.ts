import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { RequestWithUser } from '../types/request.with.user'

export const CurrentUser = createParamDecorator(
	(data: string | undefined, ctx: ExecutionContext) => {
		const request = ctx.switchToHttp().getRequest<RequestWithUser>()
		const user = request.user

		return data ? user[data] : user
	}
)
