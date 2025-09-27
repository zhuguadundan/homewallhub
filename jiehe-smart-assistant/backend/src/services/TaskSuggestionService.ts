/**
 * 智能任务建议服务
 * 基于家庭情况和现有任务，提供智能任务建议
 */

import { logger } from '../utils/logger';
import { dbGet } from '../config/database';
import { AIService } from './AIService';
import { isAIEnabled } from '../config/ai';
import type { 
  TaskSuggestionRequest, 
  TaskSuggestionResponse, 
  TaskSuggestion,
  AIServiceRequest,
  AIRequestType 
} from '../interfaces/ai';

export interface FamilyTask {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string;
  estimated_time: number;
  due_date?: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  username: string;
  role: string;
  skills: string[];
  availability: string[];
  preferences: string[];
}

export class TaskSuggestionService {
  private static instance: TaskSuggestionService;
  private aiService: AIService;

  public static getInstance(): TaskSuggestionService {
    if (!TaskSuggestionService.instance) {
      TaskSuggestionService.instance = new TaskSuggestionService();
    }
    return TaskSuggestionService.instance;
  }

  constructor() {
    this.aiService = AIService.getInstance();
  }

  /**
   * 获取智能任务建议
   */
  async getTaskSuggestions(
    familyId: string,
    userId: string,
    request: TaskSuggestionRequest
  ): Promise<TaskSuggestionResponse> {
    try {
      // 1. 获取家庭现有任务
      const currentTasks = await this.getFamilyTasks(familyId);
      
      // 2. 获取家庭成员信息
      const familyMembers = await this.getFamilyMembers(familyId);
      
      // 3. 分析任务负载和分布
      const taskAnalysis = this.analyzeTaskLoad(currentTasks, familyMembers);
      
      // 4. 获取家庭环境信息
      const contextInfo = await this.getContextualInfo(familyId);

      // 5. 构建AI请求
      const aiPrompt = this.buildSuggestionPrompt(
        request,
        taskAnalysis,
        familyMembers,
        contextInfo
      );

      let aiResponse: any = null;
      
      // 6. 调用AI服务
      if (isAIEnabled()) {
        try {
          const aiRequest: AIServiceRequest = {
            prompt: aiPrompt,
            requestType: 'task_suggestion' as AIRequestType,
            userId,
            familyId,
            maxTokens: 1500,
            temperature: 0.8
          };

          aiResponse = await this.aiService.makeRequest(aiRequest);
        } catch (error) {
          logger.warn('AI任务建议服务失败，使用本地算法', { error: error instanceof Error ? error.message : error });
        }
      }

      // 7. 解析响应或使用本地算法
      let suggestions: TaskSuggestionResponse;
      
      if (aiResponse && aiResponse.content) {
        suggestions = this.parseAIResponse(aiResponse.content, taskAnalysis, familyMembers);
      } else {
        suggestions = this.getLocalSuggestions(request, taskAnalysis, familyMembers, contextInfo);
      }

      // 8. 优化和排序建议
      suggestions = this.optimizeSuggestions(suggestions, taskAnalysis, familyMembers);

      logger.info('任务建议生成成功', {
        familyId,
        userId,
        suggestionCount: suggestions.suggestions.length,
        usedAI: !!aiResponse
      });

      return suggestions;
    } catch (error) {
      logger.error('获取任务建议失败', { familyId, userId, error });
      throw error;
    }
  }

  /**
   * 获取家庭任务
   */
  private async getFamilyTasks(familyId: string): Promise<FamilyTask[]> {
    try {
      const tasks = await dbGet(
        `SELECT 
          id, title, description, category, priority, status, 
          assigned_to, estimated_time, due_date, created_at
        FROM tasks 
        WHERE family_id = ? AND is_deleted = 0 AND status != 'completed'
        ORDER BY priority DESC, due_date ASC`,
        [familyId]
      );

      return Array.isArray(tasks) ? tasks : tasks ? [tasks] : [];
    } catch (error) {
      logger.error('获取家庭任务失败', { familyId, error });
      return [];
    }
  }

  /**
   * 获取家庭成员信息
   */
  private async getFamilyMembers(familyId: string): Promise<FamilyMember[]> {
    try {
      const members = await dbGet(
        `SELECT 
          u.id, u.username, fm.role
        FROM users u
        JOIN family_members fm ON u.id = fm.user_id
        WHERE fm.family_id = ? AND fm.is_active = 1 AND u.is_active = 1
        ORDER BY fm.role ASC`,
        [familyId]
      );

      const memberArray = Array.isArray(members) ? members : members ? [members] : [];
      
      // 添加模拟的技能和偏好数据（实际应用中可从用户设置获取）
      return memberArray.map(member => ({
        ...member,
        skills: this.getDefaultSkills(member.role),
        availability: this.getDefaultAvailability(),
        preferences: this.getDefaultPreferences(member.role)
      }));
    } catch (error) {
      logger.error('获取家庭成员失败', { familyId, error });
      return [];
    }
  }

  /**
   * 分析任务负载
   */
  private analyzeTaskLoad(tasks: FamilyTask[], members: FamilyMember[]) {
    const memberWorkload: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    const priorityDistribution: Record<string, number> = {};
    const upcomingDeadlines: FamilyTask[] = [];
    
    // 初始化成员工作量
    members.forEach(member => {
      memberWorkload[member.id] = 0;
    });

    // 分析现有任务
    tasks.forEach(task => {
      // 工作量分析
      if (task.assigned_to) {
        memberWorkload[task.assigned_to] = (memberWorkload[task.assigned_to] || 0) + task.estimated_time;
      }

      // 分类分布
      categoryDistribution[task.category] = (categoryDistribution[task.category] || 0) + 1;

      // 优先级分布
      priorityDistribution[task.priority] = (priorityDistribution[task.priority] || 0) + 1;

      // 即将到期任务
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        if (dueDate <= threeDaysFromNow) {
          upcomingDeadlines.push(task);
        }
      }
    });

    return {
      memberWorkload,
      categoryDistribution,
      priorityDistribution,
      upcomingDeadlines,
      totalTasks: tasks.length,
      averageTaskTime: tasks.length > 0 ? tasks.reduce((sum, task) => sum + task.estimated_time, 0) / tasks.length : 0
    };
  }

  /**
   * 获取上下文信息
   */
  private async getContextualInfo(familyId: string) {
    try {
      // 获取库存相关信息
      const lowStockItems = await dbGet(
        `SELECT name FROM inventory_items 
        WHERE family_id = ? AND is_active = 1 
        AND (SELECT SUM(remaining_quantity) FROM inventory_batches WHERE item_id = inventory_items.id) <= minimum_stock`,
        [familyId]
      );

      // 获取即将过期物品
      const expiringItems = await dbGet(
        `SELECT ii.name FROM inventory_items ii
        JOIN inventory_batches ib ON ii.id = ib.item_id
        WHERE ii.family_id = ? AND ii.is_active = 1 
        AND DATE(ib.expire_date) <= DATE('now', '+3 days')`,
        [familyId]
      );

      // 获取近期日历事件
      const upcomingEvents = await dbGet(
        `SELECT title, start_time FROM calendar_events 
        WHERE family_id = ? AND is_active = 1 
        AND DATE(start_time) BETWEEN DATE('now') AND DATE('now', '+7 days')
        ORDER BY start_time ASC`,
        [familyId]
      );

      return {
        lowStockItems: Array.isArray(lowStockItems) ? lowStockItems : lowStockItems ? [lowStockItems] : [],
        expiringItems: Array.isArray(expiringItems) ? expiringItems : expiringItems ? [expiringItems] : [],
        upcomingEvents: Array.isArray(upcomingEvents) ? upcomingEvents : upcomingEvents ? [upcomingEvents] : []
      };
    } catch (error) {
      logger.error('获取上下文信息失败', { familyId, error });
      return {
        lowStockItems: [],
        expiringItems: [],
        upcomingEvents: []
      };
    }
  }

  /**
   * 构建AI建议提示词
   */
  private buildSuggestionPrompt(
    request: TaskSuggestionRequest,
    taskAnalysis: any,
    familyMembers: FamilyMember[],
    contextInfo: any
  ): string {
    const prompt = `
作为智能家庭管理助手，请基于以下信息为家庭提供任务建议：

## 家庭成员情况
${familyMembers.map(member => 
  `**${member.username}** (${member.role}): 技能[${member.skills.join(', ')}], 当前工作量: ${taskAnalysis.memberWorkload[member.id] || 0}分钟`
).join('\n')}

## 现有任务分析
- 总任务数：${taskAnalysis.totalTasks}
- 任务分类分布：${Object.entries(taskAnalysis.categoryDistribution).map(([k,v]) => `${k}: ${v}`).join(', ')}
- 优先级分布：${Object.entries(taskAnalysis.priorityDistribution).map(([k,v]) => `${k}: ${v}`).join(', ')}
- 即将到期任务：${taskAnalysis.upcomingDeadlines.length}个

## 家庭环境状况
${contextInfo.lowStockItems.length > 0 ? `**库存不足物品**：${contextInfo.lowStockItems.map((item: any) => item.name).join('、')}` : ''}
${contextInfo.expiringItems.length > 0 ? `**即将过期物品**：${contextInfo.expiringItems.map((item: any) => item.name).join('、')}` : ''}
${contextInfo.upcomingEvents.length > 0 ? `**近期活动**：${contextInfo.upcomingEvents.map((event: any) => event.title).join('、')}` : ''}

## 特殊要求
${request.timeAvailable ? `**可用时间**：${request.timeAvailable}分钟` : ''}
${request.priority ? `**优先级偏好**：${request.priority}` : ''}
${request.preferences ? `**类型偏好**：${request.preferences.join('、')}` : ''}

## 建议要求
请提供3-5个具体的任务建议，每个建议包含：
1. 任务标题和详细描述
2. 建议分配给的家庭成员（考虑技能匹配和工作量平衡）
3. 预估完成时间
4. 优先级和难度评估
5. 具体执行建议和注意事项

重点考虑：
- 工作量均衡分配
- 技能匹配
- 紧急程度
- 季节性和时效性因素

请以JSON格式返回建议结果。
`;

    return prompt.trim();
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(
    aiContent: string,
    taskAnalysis: any,
    familyMembers: FamilyMember[]
  ): TaskSuggestionResponse {
    try {
      // 尝试解析JSON格式
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.suggestions) {
          return {
            suggestions: parsed.suggestions,
            reasoning: parsed.reasoning || '基于家庭情况和任务分析的智能建议',
            tips: parsed.tips || this.getDefaultTips()
          };
        }
      }

      // 文本解析
      return this.parseTextSuggestions(aiContent, familyMembers);
    } catch (error) {
      logger.warn('解析AI任务建议响应失败', { error });
      return this.parseTextSuggestions(aiContent, familyMembers);
    }
  }

  /**
   * 解析文本格式建议
   */
  private parseTextSuggestions(
    content: string,
    familyMembers: FamilyMember[]
  ): TaskSuggestionResponse {
    const suggestions: TaskSuggestion[] = [];
    const sections = content.split(/\n\s*\n/);

    for (const section of sections) {
      if (section.includes('任务') || section.includes('建议')) {
        const suggestion: TaskSuggestion = {
          title: this.extractTaskTitle(section) || '家庭任务',
          description: this.extractTaskDescription(section) || '请根据实际情况完成此任务',
          estimatedTime: this.extractTime(section) || 30,
          difficulty: this.extractDifficulty(section) || 'medium',
          priority: this.extractPriority(section) || 'medium',
          assignedTo: this.suggestAssignee(section, familyMembers),
          category: this.extractCategory(section) || '其他',
          tips: this.extractTips(section)
        };
        
        suggestions.push(suggestion);
      }
    }

    return {
      suggestions: suggestions.length > 0 ? suggestions : this.getDefaultSuggestions(familyMembers),
      reasoning: '基于AI分析的家庭任务建议',
      tips: this.getDefaultTips()
    };
  }

  /**
   * 本地算法建议
   */
  private getLocalSuggestions(
    request: TaskSuggestionRequest,
    taskAnalysis: any,
    familyMembers: FamilyMember[],
    contextInfo: any
  ): TaskSuggestionResponse {
    const suggestions: TaskSuggestion[] = [];

    // 基于库存不足的任务建议
    if (contextInfo.lowStockItems.length > 0) {
      suggestions.push({
        title: '补充生活用品',
        description: `当前${contextInfo.lowStockItems.map((item: any) => item.name).join('、')}库存不足，需要及时补充`,
        estimatedTime: 60,
        difficulty: 'easy',
        priority: 'medium',
        assignedTo: this.getAvailableMember(familyMembers, 'shopping'),
        category: '购物',
        tips: ['制作购物清单', '比较商品价格', '选择合适的购买时机']
      });
    }

    // 基于即将过期物品的任务建议
    if (contextInfo.expiringItems.length > 0) {
      suggestions.push({
        title: '处理即将过期食材',
        description: `${contextInfo.expiringItems.map((item: any) => item.name).join('、')}即将过期，建议尽快使用`,
        estimatedTime: 45,
        difficulty: 'medium',
        priority: 'high',
        assignedTo: this.getAvailableMember(familyMembers, 'cooking'),
        category: '烹饪',
        tips: ['查找相关菜谱', '优先使用即将过期食材', '合理搭配其他食材']
      });
    }

    // 基于工作量平衡的任务建议
    const leastBusyMember = this.getLeastBusyMember(familyMembers, taskAnalysis.memberWorkload);
    if (leastBusyMember) {
      suggestions.push({
        title: '家居环境整理',
        description: '整理家居环境，保持家庭空间整洁有序',
        estimatedTime: 90,
        difficulty: 'easy',
        priority: 'low',
        assignedTo: leastBusyMember.id,
        category: '清洁',
        tips: ['从一个房间开始', '分类整理物品', '定期维护']
      });
    }

    // 基于即将到来的活动
    if (contextInfo.upcomingEvents.length > 0) {
      suggestions.push({
        title: '活动准备工作',
        description: `为即将到来的${contextInfo.upcomingEvents[0]?.title}做好准备`,
        estimatedTime: 60,
        difficulty: 'medium',
        priority: 'medium',
        assignedTo: familyMembers[0]?.id,
        category: '活动',
        tips: ['提前规划', '准备必要物品', '确认时间安排']
      });
    }

    return {
      suggestions: suggestions.length > 0 ? suggestions : this.getDefaultSuggestions(familyMembers),
      reasoning: '基于家庭实际情况的智能分析建议',
      tips: this.getDefaultTips()
    };
  }

  /**
   * 优化建议排序
   */
  private optimizeSuggestions(
    suggestions: TaskSuggestionResponse,
    taskAnalysis: any,
    familyMembers: FamilyMember[]
  ): TaskSuggestionResponse {
    // 按优先级和紧急程度排序
    suggestions.suggestions.sort((a, b) => {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const aWeight = priorityWeight[a.priority as keyof typeof priorityWeight] || 1;
      const bWeight = priorityWeight[b.priority as keyof typeof priorityWeight] || 1;
      
      if (aWeight !== bWeight) {
        return bWeight - aWeight;
      }
      
      // 优先级相同时，按预估时间排序
      return a.estimatedTime - b.estimatedTime;
    });

    // 限制建议数量
    suggestions.suggestions = suggestions.suggestions.slice(0, 5);

    return suggestions;
  }

  // 辅助方法
  private getDefaultSkills(role: string): string[] {
    const skillMap: Record<string, string[]> = {
      admin: ['管理', '规划', '协调', '决策'],
      member: ['执行', '配合', '学习', '改进'],
      child: ['学习', '整理', '简单清洁']
    };
    return skillMap[role] || ['基础任务'];
  }

  private getDefaultAvailability(): string[] {
    return ['工作日晚上', '周末'];
  }

  private getDefaultPreferences(role: string): string[] {
    const prefMap: Record<string, string[]> = {
      admin: ['管理类', '规划类'],
      member: ['日常维护', '清洁整理'],
      child: ['学习相关', '简单任务']
    };
    return prefMap[role] || ['一般任务'];
  }

  private extractTaskTitle(text: string): string | null {
    const patterns = [/任务[：:](.+?)(?=\n|$)/i, /标题[：:](.+?)(?=\n|$)/i, /建议[：:](.+?)(?=\n|$)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractTaskDescription(text: string): string | null {
    const patterns = [/描述[：:](.+?)(?=\n|$)/i, /说明[：:](.+?)(?=\n|$)/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractTime(text: string): number | null {
    const match = text.match(/(\d+)\s*分钟/);
    return match ? parseInt(match[1]) : null;
  }

  private extractDifficulty(text: string): 'easy' | 'medium' | 'hard' | null {
    if (text.includes('简单') || text.includes('容易')) return 'easy';
    if (text.includes('困难') || text.includes('复杂')) return 'hard';
    if (text.includes('中等')) return 'medium';
    return null;
  }

  private extractPriority(text: string): 'low' | 'medium' | 'high' | null {
    if (text.includes('高优先级') || text.includes('紧急')) return 'high';
    if (text.includes('低优先级')) return 'low';
    if (text.includes('中优先级') || text.includes('一般')) return 'medium';
    return null;
  }

  private extractCategory(text: string): string {
    const categories = ['清洁', '购物', '烹饪', '维护', '学习', '娱乐', '运动'];
    for (const category of categories) {
      if (text.includes(category)) return category;
    }
    return '其他';
  }

  private extractTips(text: string): string[] {
    const tips: string[] = [];
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes('建议') || line.includes('提示') || line.includes('注意')) {
        tips.push(line.trim());
      }
    }
    return tips.length > 0 ? tips : ['按计划执行', '注意安全'];
  }

  private suggestAssignee(text: string, members: FamilyMember[]): string | undefined {
    // 简单的分配逻辑，实际可以更复杂
    return members[0]?.id;
  }

  private getAvailableMember(members: FamilyMember[], skillType: string): string | undefined {
    // 根据技能类型选择合适的成员
    const suitable = members.find(member => 
      member.skills.some(skill => skill.includes(skillType))
    );
    return suitable?.id || members[0]?.id;
  }

  private getLeastBusyMember(members: FamilyMember[], workload: Record<string, number>): FamilyMember | null {
    if (members.length === 0) return null;
    
    return members.reduce((least, current) => {
      const leastLoad = workload[least.id] || 0;
      const currentLoad = workload[current.id] || 0;
      return currentLoad < leastLoad ? current : least;
    });
  }

  private getDefaultSuggestions(members: FamilyMember[]): TaskSuggestion[] {
    return [
      {
        title: '日常家居整理',
        description: '整理客厅和卧室，保持家居环境整洁',
        estimatedTime: 60,
        difficulty: 'easy',
        priority: 'medium',
        assignedTo: members[0]?.id,
        category: '清洁',
        tips: ['分区域进行', '物品归类摆放']
      }
    ];
  }

  private getDefaultTips(): string[] {
    return [
      '合理安排时间，避免任务堆积',
      '根据家庭成员特点分配任务',
      '定期检查任务完成情况',
      '鼓励家庭成员积极参与',
      '建立良好的任务执行习惯'
    ];
  }
}