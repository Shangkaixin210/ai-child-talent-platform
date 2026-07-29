export type BusinessModule =
  | 'chatObserve'
  | 'storyCreate'
  | 'campusDesign'
  | 'careerSim'

export interface TalentDimensionResult {
  dimensionId: string
  dimensionName: string
  score: number
  evidence: string[]
}

/**
 * 四个业务模块统一输出的数据结构。
 * 后续每个模块完成任务后均按此格式提交，Report 页面即可统一汇总。
 */
export interface ModuleOutput {
  module: BusinessModule
  userId: string
  taskId: string
  completedAt: string
  dimensions: TalentDimensionResult[]
  summary: string
  rawData?: Record<string, unknown>
}

export type ModuleOutputMap = Partial<Record<BusinessModule, ModuleOutput>>
