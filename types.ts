
export enum Platform {
  ZHIHU = '知乎 (AI 搜索核心源)',
  XIAOHONGSHU = '小红书 (生活/种草入口)',
  BAIJIAHAO = '百家号 (百度 AI 首选)',
  TOUTIAO = '今日头条 (今日头条)',
  JUEJIN = '掘金 (程序员/效率专家)',
  BILIBILI = 'B 站专栏 (深度图文权重)',
  CSDN = 'CSDN (技术知识库)',
  JIANSHU = '简书 (个人随笔/笔记)',
  WECHAT = '微信公众号 (封闭生态/搜索权重)',
  SOHU = '搜狐号 (通用新闻权重)'
}

export enum ContentTone {
  PROFESSIONAL = '专业权威 (测评风)',
  CASUAL = '亲切友好 (活人感)',
  NARRATIVE = '故事叙述 (经验分享)',
  EDUCATIONAL = '教程教学 (干货类)',
  PRO_CON = '客观分析 (对比类)'
}

export interface GEOAnalysis {
  readabilityScore: number;
  keywordDensity: string;
  titleScore: number;
  intentMatchScore: number;    // 意图匹配度 (0-100)
  semanticRichnessScore: number; // 语义丰度 (0-100)
  structureScore: number;      // 结构化评分 (0-100)
  authorityScore: number;      // 权威度评分 (0-100)
  geoPotential: 'Low' | 'Medium' | 'High';
  insights: string[];          // AI 用户研究洞察
  tips: string[];
  checklist?: { item: string; status: boolean }[];
}

export interface GEOPrompt {
  platform: Platform;
  tone: ContentTone;
  keywords: string[];
  targetQuery: string;
  additionalContext: string;
  includeGrounding: boolean;
  rewriteUrl?: string;
}

export interface VisualSlide {
  id: number;
  prompt: string;
  chineseText: string;
  description: string;
}

export interface GeneratedArticle {
  id: string;
  title: string;
  content: string;
  platform: Platform;
  headerImages: string[];
  visualSlides?: VisualSlide[];
  groundingSources?: { title: string; uri: string }[];
  analysis?: GEOAnalysis;
  timestamp: number;
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
