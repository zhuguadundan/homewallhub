import { Context } from 'koa'
import { ValidationError } from '../middlewares/errorHandler'

// 验证规则接口
export interface ValidationRule {
  required?: boolean
  // 放宽类型定义，兼容各控制器中使用的字符串字面量与扩展类型
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid' | string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  // 放宽以兼容字符串正则表达式写法
  pattern?: any
  enum?: any[]
  custom?: (value: any) => boolean | string
  // 允许额外的校验元数据（如 items、minItems 等），避免编译报错
  [key: string]: any
}

// 验证模式
export interface ValidationSchema {
  [key: string]: ValidationRule
}

// 验证结果
export interface ValidationResult {
  isValid: boolean
  errors: { [key: string]: string[] }
  data: any
}

// 通用验证器类
export class Validator {
  // 验证数据
  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: { [key: string]: string[] } = {}
    const validatedData: any = {}

    // 检查必需字段
    Object.keys(schema).forEach(field => {
      const rule = schema[field]
      const value = data[field]

      // 检查必需字段
      if (rule.required && (value === undefined || value === null || value === '')) {
        if (!errors[field]) errors[field] = []
        errors[field].push(`${field} 是必需的`)
        return
      }

      // 如果值为空且不是必需的，跳过验证
      if (value === undefined || value === null || value === '') {
        return
      }

      // 类型验证
      if (rule.type) {
        const typeError = this.validateType(field, value, rule.type)
        if (typeError) {
          if (!errors[field]) errors[field] = []
          errors[field].push(typeError)
          return
        }
      }

      // 长度验证
      if (rule.minLength !== undefined || rule.maxLength !== undefined) {
        const lengthError = this.validateLength(field, value, rule.minLength, rule.maxLength)
        if (lengthError) {
          if (!errors[field]) errors[field] = []
          errors[field].push(lengthError)
        }
      }

      // 数值范围验证
      if (rule.min !== undefined || rule.max !== undefined) {
        const rangeError = this.validateRange(field, value, rule.min, rule.max)
        if (rangeError) {
          if (!errors[field]) errors[field] = []
          errors[field].push(rangeError)
        }
      }

      // 正则表达式验证
      if (rule.pattern && !rule.pattern.test(value)) {
        if (!errors[field]) errors[field] = []
        errors[field].push(`${field} 格式不正确`)
      }

      // 枚举值验证
      if (rule.enum && !rule.enum.includes(value)) {
        if (!errors[field]) errors[field] = []
        errors[field].push(`${field} 必须是以下值之一: ${rule.enum.join(', ')}`)
      }

      // 自定义验证
      if (rule.custom) {
        const customResult = rule.custom(value)
        if (typeof customResult === 'string') {
          if (!errors[field]) errors[field] = []
          errors[field].push(customResult)
        } else if (customResult === false) {
          if (!errors[field]) errors[field] = []
          errors[field].push(`${field} 验证失败`)
        }
      }

      // 如果没有错误，添加到验证后的数据中
      if (!errors[field]) {
        validatedData[field] = value
      }
    })

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      data: validatedData
    }
  }

  // 实例方法包装，便于以实例形式使用（兼容现有控制器写法）
  validate(data: any, schema: ValidationSchema): ValidationResult {
    return Validator.validate(data, schema)
  }

  // 类型验证
  private static validateType(field: string, value: any, type: string): string | null {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${field} 必须是字符串类型`
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${field} 必须是数字类型`
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${field} 必须是布尔类型`
        }
        break
      case 'array':
        if (!Array.isArray(value)) {
          return `${field} 必须是数组类型`
        }
        break
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          return `${field} 必须是对象类型`
        }
        break
      case 'email':
        if (typeof value !== 'string' || !this.isValidEmail(value)) {
          return `${field} 必须是有效的邮箱格式`
        }
        break
      case 'uuid':
        if (typeof value !== 'string' || !this.isValidUuid(value)) {
          return `${field} 必须是有效的UUID格式`
        }
        break
    }
    return null
  }

  // 长度验证
  private static validateLength(field: string, value: any, minLength?: number, maxLength?: number): string | null {
    const length = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : 0

    if (minLength !== undefined && length < minLength) {
      return `${field} 长度不能少于 ${minLength}`
    }

    if (maxLength !== undefined && length > maxLength) {
      return `${field} 长度不能超过 ${maxLength}`
    }

    return null
  }

  // 数值范围验证
  private static validateRange(field: string, value: any, min?: number, max?: number): string | null {
    if (typeof value !== 'number') return null

    if (min !== undefined && value < min) {
      return `${field} 不能小于 ${min}`
    }

    if (max !== undefined && value > max) {
      return `${field} 不能大于 ${max}`
    }

    return null
  }

  // 邮箱格式验证
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // UUID格式验证
  private static isValidUuid(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i
    return uuidRegex.test(uuid)
  }  // 创建验证中间件
  static createMiddleware(schema: ValidationSchema, target: 'body' | 'query' | 'params' = 'body') {
    return async (ctx: Context, next: Function) => {
      const data = target === 'body' ? ctx.request.body :
                   target === 'query' ? ctx.query :
                   ctx.params

      const result = this.validate(data, schema)

      if (!result.isValid) {
        throw new ValidationError('验证失败', result.errors)
      }

      // 将验证后的数据附加到上下文
      ctx.validatedData = result.data
      await next()
    }
  }
}

// 常用验证模式
export const ValidationSchemas = {
  // 用户相关
  userRegister: {
    username: {
      required: true,
      type: 'string',
      minLength: 2,
      maxLength: 20,
      pattern: /^[a-zA-Z0-9_\u4e00-\u9fa5]+$/
    },
    email: {
      required: true,
      type: 'email'
    },
    password: {
      required: true,
      type: 'string',
      minLength: 6,
      maxLength: 100
    },
    nickname: {
      type: 'string',
      maxLength: 50
    }
  } as ValidationSchema,

  userLogin: {
    email: {
      required: true,
      type: 'email'
    },
    password: {
      required: true,
      type: 'string',
      minLength: 1
    }
  } as ValidationSchema,

  // 家庭相关
  createFamily: {
    name: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    avatar: {
      type: 'string',
      maxLength: 200
    }
  } as ValidationSchema,

  updateFamily: {
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 50
    },
    description: {
      type: 'string',
      maxLength: 500
    },
    avatar: {
      type: 'string',
      maxLength: 200
    },
    settings: {
      type: 'object'
    }
  } as ValidationSchema,

  joinFamily: {
    inviteCode: {
      required: true,
      type: 'string',
      minLength: 8,
      maxLength: 8,
      pattern: /^[A-Z0-9]{8}$/
    },
    nickname: {
      type: 'string',
      maxLength: 50
    }
  } as ValidationSchema,  // 任务相关
  createTask: {
    title: {
      required: true,
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent']
    },
    category: {
      type: 'string',
      maxLength: 50
    },
    assigned_to: {
      type: 'string'
    },
    due_date: {
      type: 'string',
      custom: (value: string) => {
        if (!value) return true
        const date = new Date(value)
        return !isNaN(date.getTime()) || '截止日期格式无效'
      }
    },
    estimated_hours: {
      type: 'number',
      min: 0,
      max: 1000
    },
    is_recurring: {
      type: 'boolean'
    },
    recurring_pattern: {
      type: 'string',
      enum: ['daily', 'weekly', 'monthly', 'yearly']
    }
  } as ValidationSchema,

  updateTask: {
    title: {
      type: 'string',
      minLength: 1,
      maxLength: 100
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    status: {
      type: 'string',
      enum: ['todo', 'in_progress', 'completed', 'cancelled']
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'urgent']
    },
    category: {
      type: 'string',
      maxLength: 50
    },
    assigned_to: {
      type: 'string'
    },
    due_date: {
      type: 'string',
      custom: (value: string) => {
        if (!value) return true
        const date = new Date(value)
        return !isNaN(date.getTime()) || '截止日期格式无效'
      }
    },
    estimated_hours: {
      type: 'number',
      min: 0,
      max: 1000
    },
    actual_hours: {
      type: 'number',
      min: 0,
      max: 1000
    },
    progress: {
      type: 'number',
      min: 0,
      max: 100
    }
  } as ValidationSchema,

  // 通用ID验证
  id: {
    id: {
      required: true,
      type: 'string',
      custom: (value: string) => {
        // 验证UUID或自定义ID格式
        return /^[a-zA-Z0-9]{32}$/.test(value) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) || 'ID格式无效'
      }
    }
  } as ValidationSchema,

  // 分页验证
  pagination: {
    page: {
      type: 'number',
      min: 1,
      custom: (value: any) => {
        const num = parseInt(value)
        return !isNaN(num) && num >= 1 || '页码必须是大于0的整数'
      }
    },
    limit: {
      type: 'number',
      min: 1,
      max: 100,
      custom: (value: any) => {
        const num = parseInt(value)
        return !isNaN(num) && num >= 1 && num <= 100 || '每页数量必须是1-100之间的整数'
      }
    }
  } as ValidationSchema,

  // 权限管理相关
  updateMemberPermissions: {
    userId: {
      required: true,
      type: 'string'
    },
    permissions: {
      required: true,
      type: 'object',
      custom: (value: any) => {
        const allowedKeys = [
          'can_manage_tasks',
          'can_manage_inventory',
          'can_manage_menu',
          'can_manage_calendar',
          'can_manage_messages',
          'can_invite_members'
        ]
        
        const keys = Object.keys(value)
        if (keys.length === 0) {
          return '权限配置不能为空'
        }
        
        for (const key of keys) {
          if (!allowedKeys.includes(key)) {
            return `未知权限字段: ${key}`
          }
          if (typeof value[key] !== 'boolean') {
            return `权限字段 ${key} 必须是布尔值`
          }
        }
        
        return true
      }
    }
  } as ValidationSchema,
}
