import { Context, Next } from 'koa';
import Joi from 'joi';
import { ValidationError } from './errorHandler';

// 验证位置枚举
export enum ValidateLocation {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
}

/**
 * 输入验证中间件
 */
export const validateMiddleware = (
  schema: Joi.ObjectSchema,
  location: ValidateLocation = ValidateLocation.BODY
) => {
  return async (ctx: Context, next: Next): Promise<void> => {
    try {
      let data: any;
      
      switch (location) {
        case ValidateLocation.BODY:
          data = ctx.request.body;
          break;
        case ValidateLocation.QUERY:
          data = ctx.query;
          break;
        case ValidateLocation.PARAMS:
          data = ctx.params;
          break;
        default:
          data = ctx.request.body;
      }

      // 执行验证
      const { error, value } = schema.validate(data, {
        abortEarly: false, // 显示所有错误
        allowUnknown: false, // 不允许未知字段
        stripUnknown: true, // 删除未知字段
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message.replace(/"/g, ''),
          value: detail.context?.value,
        }));

        throw new ValidationError(`输入验证失败: ${errorMessages.map(e => e.message).join(', ')}`);
      }

      // 将验证后的数据替换原始数据
      switch (location) {
        case ValidateLocation.BODY:
          ctx.request.body = value;
          break;
        case ValidateLocation.QUERY:
          ctx.query = value;
          break;
        case ValidateLocation.PARAMS:
          ctx.params = value;
          break;
      }

      await next();
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      } else {
        throw new ValidationError('输入验证过程中发生错误');
      }
    }
  };
};