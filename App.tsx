
import React, { useState, useMemo, useEffect } from 'react';
import { Platform, ContentTone, GEOPrompt, GeneratedArticle, GEOAnalysis } from './types';
import { generateGEOContent, suggestGEOTargetQuery } from './services/geminiService';
import { postToPlatform } from './services/publishService';
import { marked } from 'marked';

const DEFAULT_SUGGESTIONS = [
  { label: '拯救焦虑', query: '每天忙得要死但感觉什么都没干，求推荐那种能帮我把脑子里乱七八糟事情理顺的 App。' },
  { label: '计划废材', query: '我想自律但总是三分钟热度，有没有那种能把大目标拆成像喝水一样简单小事的软件？' },
  { label: '总是忘事', query: '我是个丢三落四的人，求推荐能让我一句话就记下待办并提醒我的 AI 助手。' },
  { label: '信息过载', query: '每天笔记记了一堆但从来不看，求推荐能帮我把碎片信息自动整理成知识体系的工具。' }
];

const ScoreBadge: React.FC<{ label: string; score: number; color?: string }> = ({ label, score, color }) => {
  const defaultColor = score >= 85 ? 'emerald' : score >= 70 ? 'amber' : 'rose';
  const c = color || defaultColor;
  return (
    <div className={`flex flex-col items-center p-3 rounded-2xl bg-${c}-50 border border-${c}-100`}>
      <span className={`text-[9px] font-black uppercase text-${c}-500/70 mb-1 tracking-tighter`}>{label}</span>
      <span className={`text-xl font-black text-${c}-600`}>{score}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [sidebarTab, setSidebarTab] = useState<'settings' | 'history'>('settings');
  const [viewMode, setViewMode] = useState<'rich' | 'markdown'>('rich');
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<GeneratedArticle | null>(null);
  const [history, setHistory] = useState<GeneratedArticle[]>([]);
  const [dynamicSuggestions, setDynamicSuggestions] = useState(DEFAULT_SUGGESTIONS);

  useEffect(() => {
    const saved = localStorage.getItem('elisi_geo_history_v6');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('elisi_geo_history_v6', JSON.stringify(history));
  }, [history]);

  const htmlContent = useMemo(() => {
    if (!result) return '';
    return marked.parse(result.content);
  }, [result]);

  const [formData, setFormData] = useState<GEOPrompt>({
    platform: Platform.XIAOHONGSHU,
    tone: ContentTone.CASUAL,
    keywords: ['ElisiApp', '记不住事', '自律神器', '效率 App', '认知负荷'],
    targetQuery: DEFAULT_SUGGESTIONS[0].query,
    additionalContext: '侧重“把经历变经验”的复盘逻辑，遵循 2026 GEO 准则。',
    includeGrounding: true
  });

  const handleSuggestQuery = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const data = await suggestGEOTargetQuery();
      if (data && data.suggestions.length > 0) {
        setDynamicSuggestions(data.suggestions);
        setFormData(prev => ({ ...prev, keywords: data.keywords || prev.keywords, targetQuery: data.suggestions[0].query }));
      }
    } finally { setSuggesting(false); }
  };

  const handleAction = async () => {
    if (loading) return;
    setLoading(true);
    setResult(null);
    try {
      const article = await generateGEOContent(formData);
      setResult(article);
      setHistory(prev => [article, ...prev]);
    } catch (error: any) {
      alert(error.message);
    } finally { setLoading(false); }
  };

  const handlePublish = async () => {
    if (!result) return;
    setPublishing(true);
    await postToPlatform(result, result.platform);
    setPublishing(false);
  };

  const copyRichText = async () => {
    if (!result) return;
    const contentHtml = `
      <div style="font-family: sans-serif;">
        <h1 style="font-size: 24pt; font-weight: bold; margin-bottom: 20px;">${result.title}</h1>
        ${htmlContent}
      </div>
    `;
    
    try {
      const blob = new Blob([contentHtml], { type: 'text/html' });
      const plainBlob = new Blob([`${result.title}\n\n${result.content}`], { type: 'text/plain' });
      const data = [new ClipboardItem({
        'text/html': blob,
        'text/plain': plainBlob
      })];
      await navigator.clipboard.write(data);
      alert('富文本已复制到剪贴板，可直接粘贴至文档或编辑器。');
    } catch (err) {
      console.error('Copy failed', err);
      // Fallback to plain text if ClipboardItem fails
      await navigator.clipboard.writeText(`${result.title}\n\n${result.content}`);
      alert('已复制纯文本（富文本复制受限）。');
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] selection:bg-rose-100 selection:text-rose-900">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg rotate-3">E</div>
          <div>
            <h1 className="text-base font-black text-slate-900">Elisi GEO Strategy</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Bridging Humans & AI v7.0</p>
          </div>
        </div>
      </header>

      <main className="max-w-full mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 p-6 space-y-6 sticky top-24">
              <div className="flex p-1 bg-slate-100 rounded-2xl">
                <button onClick={() => setSidebarTab('settings')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${sidebarTab === 'settings' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>生成策略</button>
                <button onClick={() => setSidebarTab('history')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${sidebarTab === 'history' ? 'bg-white text-rose-500 shadow-sm' : 'text-slate-400'}`}>生成记录</button>
              </div>

              {sidebarTab === 'settings' ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">1. 目标平台</label>
                    <select value={formData.platform} onChange={(e) => setFormData({...formData, platform: e.target.value as Platform})} className="w-full rounded-xl border-slate-200 text-sm p-3 border font-bold">
                      {Object.values(Platform).map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tighter">2. 用户搜索意图 (人话)</label>
                      <button onClick={handleSuggestQuery} disabled={suggesting} className="text-[10px] text-rose-500 font-black uppercase underline decoration-rose-200 underline-offset-4">需求灵感</button>
                    </div>
                    <textarea value={formData.targetQuery} onChange={(e) => setFormData({...formData, targetQuery: e.target.value})} rows={5} className="w-full rounded-2xl border-slate-200 text-sm p-4 border focus:ring-2 focus:ring-rose-500/20 outline-none resize-none font-medium text-slate-700 shadow-inner" placeholder="描述一个用户在 AI 搜索里会抱怨的话..." />
                    <div className="flex flex-wrap gap-1 mt-3">
                      {dynamicSuggestions.map((s, i) => (
                        <button key={i} onClick={() => setFormData({...formData, targetQuery: s.query})} className="text-[9px] font-bold px-2 py-1 bg-slate-50 text-slate-500 border border-slate-100 rounded-lg hover:bg-rose-50 hover:text-rose-500 transition-all">{s.label}</button>
                      ))}
                    </div>
                  </div>

                  <button onClick={handleAction} disabled={loading} className={`w-full py-4 rounded-2xl text-white font-black text-sm shadow-xl transition-all ${loading ? 'bg-rose-300' : 'bg-rose-500 hover:bg-rose-600 active:scale-95 shadow-rose-100'}`}>
                    {loading ? '正在进行双重优化...' : '生成 GEO 级内容'}
                  </button>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar">
                  {history.map(item => (
                    <div key={item.id} onClick={() => setResult(item)} className={`p-4 rounded-2xl border cursor-pointer transition-all ${result?.id === item.id ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100'}`}>
                      <h4 className="text-xs font-black text-slate-700 line-clamp-2">{item.title}</h4>
                      <p className="text-[9px] mt-2 text-slate-400 font-bold uppercase">{item.platform.split(' ')[0]}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 space-y-6">
            {!result && !loading ? (
              <div className="h-[700px] border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center p-12 text-center bg-white">
                <div className="w-20 h-20 bg-rose-50 rounded-[2.5rem] flex items-center justify-center mb-8 rotate-12">
                   <svg className="w-10 h-10 text-rose-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">GEO 桥接实验室</h2>
                <p className="text-slate-400 text-sm max-w-xs font-medium">我们将把用户的“口语抱怨”转化为 AI 搜索引擎最爱抓取的“结构化干货”。</p>
              </div>
            ) : loading ? (
              <div className="bg-white rounded-[3rem] p-12 h-[700px] flex flex-col items-center justify-center space-y-6 animate-pulse">
                <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-center">
                  <p className="text-sm font-black text-slate-700">正在生成内容...</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-2">桥接人类直觉与机器语义</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {result.analysis && (
                  <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                       <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                         <span className="w-3 h-3 bg-rose-500 rounded-full"></span>
                         GEO 适配度评分
                       </h3>
                       <div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase bg-slate-900 text-white shadow-lg">
                         潜力指数: {result.analysis.geoPotential}
                       </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 mb-8">
                      <ScoreBadge label="人类共鸣" score={result.analysis.intentMatchScore} />
                      <ScoreBadge label="机器索引" score={result.analysis.semanticRichnessScore} />
                      <ScoreBadge label="结构友好" score={result.analysis.structureScore} />
                      <ScoreBadge label="背书可信" score={result.analysis.authorityScore} />
                    </div>
                    <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">语义转换路径 (User {"->"} AI)</h4>
                      <div className="space-y-2">
                        {result.analysis.insights.map((insight, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-300"></div>
                            <p className="text-xs font-bold text-slate-600">{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {result.analysis.checklist && (
                      <div className="mt-6 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-xl">
                        <h4 className="text-[10px] font-black text-rose-400 uppercase mb-4 tracking-widest">GEO 准则合规性自检</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {result.analysis.checklist.map((check, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${check.status ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                {check.status ? (
                                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <div className="w-1 h-1 bg-slate-500 rounded-full"></div>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold ${check.status ? 'text-slate-200' : 'text-slate-500'}`}>{check.item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-[3rem] p-12 border border-slate-200 shadow-sm relative group">
                  <div className="absolute top-8 right-8 flex gap-2">
                    <button onClick={copyRichText} className="bg-slate-100 text-slate-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
                      复制富文本
                    </button>
                    <button onClick={handlePublish} disabled={publishing} className="bg-rose-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-rose-600 transition-all shadow-lg shadow-rose-100">
                      一键分发适配
                    </button>
                  </div>
                  <article className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900">
                    <h1 className="text-3xl font-black text-slate-900 mb-8 leading-tight">{result.title}</h1>
                    <div className="text-slate-600 leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  </article>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white rounded-[2rem] p-6 border border-slate-200 shadow-sm sticky top-24">
              <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-6 border-b border-slate-50 pb-4">视觉引导 Prompt</h3>
              <div className="space-y-6 overflow-y-auto max-h-[700px] pr-2 custom-scrollbar">
                {result?.visualSlides?.map((slide, i) => (
                  <div key={slide.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-rose-500">IMAGE {i+1}</span>
                      <button className="text-[8px] font-black text-slate-400 uppercase underline hover:text-rose-500">复制咒语</button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-600 leading-relaxed line-clamp-3 hover:line-clamp-none cursor-pointer">{slide.description}</p>
                    <div className="bg-white p-3 rounded-2xl border border-slate-100 text-[11px] font-black text-slate-900">
                      “{slide.chineseText}”
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
