import { Context } from 'hono';

export interface SuccessResponse<T = any> {
  data?: T;
  message?: string;
}

export interface ErrorResponse {
  error: string;
  details?: any;
}

export class ResponseUtil {
  static success<T>(c: Context, data: T, status: number = 200) {
    return c.json(data, status as any);
  }

  static created<T>(c: Context, data: T) {
    return c.json(data, 201 as any);
  }

  static error(c: Context, message: string, status: number = 500, details?: any) {
    const response: ErrorResponse = { error: message };
    if (details) response.details = details;
    return c.json(response, status as any);
  }

  static badRequest(c: Context, message: string = 'Bad request', details?: any) {
    return this.error(c, message, 400, details);
  }

  static unauthorized(c: Context, message: string = 'Unauthorized') {
    return this.error(c, message, 401);
  }

  static forbidden(c: Context, message: string = 'Forbidden') {
    return this.error(c, message, 403);
  }

  static notFound(c: Context, message: string = 'Not found') {
    return this.error(c, message, 404);
  }

  static conflict(c: Context, message: string = 'Conflict') {
    return this.error(c, message, 409);
  }

  static internalError(c: Context, message: string = 'Internal server error') {
    return this.error(c, message, 500);
  }
}
