import { Request } from 'express'

interface User {
	id: string
	login: string
	role: string
}

export interface RequestWithUser extends Request {
	user: User
}
