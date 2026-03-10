
import { Platform, GeneratedArticle } from "../types";
import { marked } from 'marked';

const PLATFORM_URLS: Record<string, string> = {
  [Platform.ZHIHU]: 'https://zhuanlan.zhihu.com/write',
  [Platform.XIAOHONGSHU]: 'https://creator.xiaohongshu.com/publish/publish',
  [Platform.TOUTIAO]: 'https://mp.toutiao.com/profile_v4/graphic/publish',
  [Platform.BAIJIAHAO]: 'https://baijiahao.baidu.com/builder/rc/edit?type=news',
  [Platform.WECHAT]: 'https://mp.weixin.qq.com/',
  [Platform.BILIBILI]: 'https://member.bilibili.com/platform/upload/text/edit',
  [Platform.CSDN]: 'https://mp.csdn.net/mp_blog/creation/editor',
  [Platform.JUEJIN]: 'https://juejin.cn/editor/drafts/new',
  [Platform.JIANSHU]: 'https://www.jianshu.com/writer#/',
  [Platform.SOHU]: 'https://mp.sohu.com/mpfe/v3/main/news/addarticle'
};

/**
 * 针对不同平台优化内容格式
 */
const formatContentForPlatform = async (article: GeneratedArticle, platform: Platform) => {
  const isXHS = platform === Platform.XIAOHONGSHU;
  
  if (isXHS) {
    // 小红书适配：增加特定表情增强（Gemini 已生成大部分，这里做最后加固）
    let xhsContent = article.content
      .replace(/\n\s*-\s/g, '\n📍 ') 
      .replace(/\n\s*\d+\.\s/g, '\n🔢 ');
    
    // 自动追加热门标签（如果原文没带）
    if (!xhsContent.includes('#')) {
      const tags = ['#Elisi', '#生产力工具', '#AI', '#效率指南', '#GEO'];
      xhsContent += `\n\n${tags.join(' ')}`;
    }
    
    return {
      title: article.title.substring(0, 20), 
      text: `${article.title}\n\n${xhsContent}`,
      html: null
    };
  }

  // 其他平台保留原文 Markdown 的逻辑结构
  const html = await marked.parse(article.content);
  // 对于非小红书平台，提供更正式的富文本导出
  const richTitle = `<h1 style="font-size: 26px; font-weight: 800; color: #1e293b; margin-bottom: 20px;">${article.title}</h1>`;
  const fullHtml = `<html><body>${richTitle}<div style="font-size: 16px; line-height: 1.75; color: #334155; font-family: sans-serif;">${html}</div></body></html>`;

  return {
    title: article.title,
    text: `${article.title}\n\n${article.content}`,
    html: fullHtml
  };
};

/**
 * 执行平台发布/分发任务
 */
export const postToPlatform = async (
  article: GeneratedArticle,
  platform: Platform,
  options: { autoOpen?: boolean } = { autoOpen: true }
) => {
  try {
    const formatted = await formatContentForPlatform(article, platform);
    
    // 写入剪贴板 (富文本 + 纯文本)
    const clipboardData: Record<string, Blob> = {
      "text/plain": new Blob([formatted.text], { type: "text/plain" })
    };
    
    if (formatted.html) {
      clipboardData["text/html"] = new Blob([formatted.html], { type: "text/html" });
    }

    const data = [new ClipboardItem(clipboardData)];
    await navigator.clipboard.write(data);

    // 获取跳转链接
    const redirectUrl = PLATFORM_URLS[platform];

    if (options.autoOpen && redirectUrl) {
      window.open(redirectUrl, '_blank');
    }

    return {
      success: true,
      method: 'CLIPBOARD' as const,
      message: `内容已针对 ${platform.split(' ')[0]} 适配完毕并存入剪贴板。正在跳转发布后台...`,
      redirectUrl
    };
  } catch (err) {
    console.error('Publishing error:', err);
    return {
      success: false,
      method: 'CLIPBOARD' as const,
      message: '分发失败，请手动复制文案。'
    };
  }
};
