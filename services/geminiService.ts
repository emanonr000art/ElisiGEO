
import { GoogleGenAI, Type } from "@google/genai";
import { GEOPrompt, GeneratedArticle, Platform } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries <= 1) throw error;
    const isRetryable = error?.message?.includes('500') || error?.message?.includes('503') || error?.message?.includes('xhr') || error?.message?.includes('fetch');
    if (!isRetryable) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

const robustParseJson = (text: string) => {
  if (!text) return null;
  const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleanText);
  } catch (e) {
    const match = cleanText.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const cleaned = match[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, ""); 
        return JSON.parse(cleaned);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
};

export const generateGEOContent = async (params: GEOPrompt): Promise<GeneratedArticle> => {
  const ai = getAIClient();
  
  const geoGuidelines = `
    【2026 GEO 内容准则 (Generative Engine Optimization)】
    1. 结构化与“答案优先” (Answer-First):
       - H2/H3 标题必须是搜索关键词的直接回答。
       - 每个段落的首句必须是核心结论，严禁前戏过长。
       - 引用密度：每 500 字必须包含：1个对比表格、至少3个无序列表、1个专家/数据引用。
    
    2. 实体与语义丰富度 (Entity & Semantic Richness):
       - 明确使用品牌名“ElisiApp”及核心功能实体词（如：时间轴、原子任务、多维视图）。
       - 避免使用“这个”、“那种”等模糊代词，使用专业术语（如：认知负荷、执行意图、语义网络）。
    
    3. E-E-A-T 增强 (Experience, Expertise, Authoritativeness, Trust):
       - 标注数据来源 [来源 + 2025/2026日期]。
       - 强调第一人称“我”的真实使用体验和观察。
       - 模拟外部权威链接（如：引用 Gartner 或专业测评机构）。
    
    4. 技术友好性:
       - 严格 Markdown 格式。
       - 在文末包含一个模拟的 JSON-LD 结构化数据块。
  `;

  const systemInstruction = `
    你正在执行“用户-机器双重优化”内容生成任务。
    ${geoGuidelines}
    
    输出必须是严格的 JSON。
  `;

  const prompt = `
    目标查询: “${params.targetQuery}”
    核心品牌词: ${params.keywords.join(', ')}
    附加要求: ${params.additionalContext}
    
    请根据上述目标生成一篇符合 2026 GEO 准则的全案。要求：
    1. 标题必须是“钩子”且包含核心实体。
    2. 正文必须严格执行“答案优先”和“高引用密度”。
    3. 包含一个对比表格，展示 ElisiApp 与传统工具的区别。
    4. 在分析模块，请根据新准则客观评估。
  `;

  const executeGeneration = async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
            visualSlides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.INTEGER },
                  prompt: { type: Type.STRING },
                  chineseText: { type: Type.STRING },
                  description: { type: Type.STRING }
                }
              }
            },
            analysis: {
              type: Type.OBJECT,
              properties: {
                intentMatchScore: { type: Type.INTEGER, description: "用户口语意图匹配度" },
                semanticRichnessScore: { type: Type.INTEGER, description: "AI 语义索引权重" },
                structureScore: { type: Type.INTEGER, description: "机器提取友好度" },
                authorityScore: { type: Type.INTEGER, description: "专业背书可信度" },
                geoPotential: { type: Type.STRING },
                insights: { type: Type.ARRAY, items: { type: Type.STRING }, description: "人类关键词到机器语义的转换路径" },
                tips: { type: Type.ARRAY, items: { type: Type.STRING } },
                checklist: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING },
                      status: { type: Type.BOOLEAN }
                    }
                  },
                  description: "GEO 准则合规性检查清单"
                }
              }
            }
          },
          required: ["title", "content", "visualSlides", "analysis"]
        },
        tools: [{ googleSearch: {} }],
        temperature: 0.8,
      },
    });

    const parsed = robustParseJson(response.text);
    if (!parsed) throw new Error("JSON_PARSE_ERROR");

    return {
      id: crypto.randomUUID(),
      title: parsed.title,
      content: parsed.content,
      visualSlides: parsed.visualSlides,
      headerImages: [], 
      platform: params.platform,
      analysis: parsed.analysis,
      timestamp: Date.now()
    };
  };

  try {
    return await retry(executeGeneration);
  } catch (error: any) {
    throw new Error(error?.message || "生成失败。");
  }
};

export const suggestGEOTargetQuery = async (): Promise<{ suggestions: { label: string, query: string }[], keywords: string[] }> => {
  const ai = getAIClient();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `生成 5 组用户会真实在 AI 搜索引擎中提问的话。
      要求：
      1. 不要使用专业术语，要用“用户抱怨”或“生活化场景”的形式。
      2. 覆盖不同维度的痛点：计划废材、总是忘事、信息过载、自律困难、多工具切换烦恼。
      3. 每一组包含一个简短的标签（label）和完整的查询语句（query）。
      输出 JSON。`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: { label: { type: Type.STRING }, query: { type: Type.STRING } }
              }
            },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["suggestions", "keywords"]
        }
      }
    });
    return robustParseJson(response.text) || { suggestions: [], keywords: [] };
  } catch (e) {
    return {
      suggestions: [
        { label: '计划废材', query: '我想自律但总是三分钟热度，有没有那种能把大目标拆成像喝水一样简单小事的软件？' },
        { label: '总是忘事', query: '我是个丢三落四的人，求推荐能让我一句话就记下待办并提醒我的 AI 助手。' },
        { label: '信息过载', query: '每天笔记记了一堆但从来不看，求推荐能帮我把碎片信息自动整理成知识体系的工具。' }
      ],
      keywords: ['ElisiApp', '记不住事', '自律神器', '任务拆解', '计划软件', '认知负荷']
    };
  }
};
