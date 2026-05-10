import { Network, Languages, Plus, BookOpen, Wand2, PenTool, Book, Lightbulb, Clapperboard, Layers, Image as ImageIcon } from 'lucide-react';
import { FuncType } from '../types';
import { useState, useEffect } from 'react';

interface WelcomeScreenProps {
  currentFunc: FuncType;
  quickSend: (text: string) => void;
  currentDramaSubFunc?: string;
  setCurrentDramaSubFunc?: (val: string) => void;
  currentSeedanceSubFunc?: string;
  setCurrentSeedanceSubFunc?: (val: string) => void;
  children?: React.ReactNode;
  conversations?: Record<string, any>;
  setCurrentConvId?: (id: string | null) => void;
  createNewProject?: (title: string, description: string) => void;
  setCurrentFunc?: (func: FuncType) => void;
  setShowCanvasProjects?: (val: boolean) => void;
  setAutoOpenProjectModal?: (val: boolean) => void;
}

export function WelcomeScreen({ 
  currentFunc, 
  quickSend, 
  currentDramaSubFunc, 
  setCurrentDramaSubFunc, 
  currentSeedanceSubFunc, 
  setCurrentSeedanceSubFunc,
  children,
  conversations,
  setCurrentConvId,
  createNewProject,
  setCurrentFunc,
  setShowCanvasProjects,
  setAutoOpenProjectModal
}: WelcomeScreenProps) {
  const [adIndex, setAdIndex] = useState(0);
  
  useEffect(() => {
    if (currentFunc !== 'chat') return;
    const timer = setInterval(() => {
      setAdIndex((prev) => (prev + 1) % 2);
    }, 5000);
    return () => clearInterval(timer);
  }, [currentFunc]);

  if (currentFunc === 'chat') {
    const recentProjects = Object.values(conversations || {})
      .filter((c: any) => c.func === 'canvasDrama')
      .sort((a: any, b: any) => b.created - a.created)
      .slice(0, 3); 

    const showcaseItems = [
      { 
        id: 1, 
        title: '《星梦奇缘》', 
        subtitle: '动漫分镜设计',
        image: 'https://image.pollinations.ai/prompt/anime%20style%2C%20Star%20Sea%20City%20animation%2C%20beautiful%20starry%20night%20sky%20over%20a%20futuristic%20glowing%20city?width=800&height=500&nologo=true'
      },
      { 
        id: 2, 
        title: '《赛博纪元》', 
        subtitle: '电影级概念图',
        image: 'https://image.pollinations.ai/prompt/cyberpunk%20beauty%20female%20character%2C%20neon%20lights%2C%20futuristic%20city%20background%2C%20cinematic?width=800&height=500&nologo=true'
      },
      { 
        id: 3, 
        title: '《深空迷航》', 
        subtitle: '科幻剧情分镜',
        image: 'https://image.pollinations.ai/prompt/massive%20space%20monster%20colliding%20with%20a%20spaceship%2C%20deep%20space%2C%20epic%20sci-fi?width=800&height=500&nologo=true'
      }
    ];

    return (
      <div className="flex flex-col items-center justify-start w-full min-h-full py-8 text-center px-4 md:px-8">
        
        {/* Ad Carousel */}
        <div className="w-full max-w-4xl xl:max-w-5xl h-40 md:h-[220px] rounded-2xl overflow-hidden relative mb-8 group shadow-md border border-neutral-100 transition-all">
           {/* Ad 1 */}
           <div 
             className={`absolute inset-0 transition-opacity duration-1000 flex flex-col justify-center px-8 md:px-14 text-white cursor-pointer ${adIndex === 0 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
             style={{ 
               backgroundImage: `linear-gradient(to right, rgba(29, 78, 216, 0.7), rgba(67, 56, 202, 0.6), transparent), url('https://image.pollinations.ai/prompt/anime%20style%2C%20epic%20dynamic%20fighting%20scene%2C%20extreme%20perspective%2C%20intense%20action%2C%20high%20impact%2C%20vivid%20high%20saturation%2C%20masterpiece%2C%204k?width=1200&height=400&nologo=true')`,
               backgroundSize: 'cover',
               backgroundPosition: 'center',
             }}
             onClick={() => {
                setCurrentFunc?.('canvasDrama');
                if (recentProjects.length > 0) {
                  setCurrentConvId?.(recentProjects[0].id);
                } else {
                  setShowCanvasProjects?.(true);
                  setAutoOpenProjectModal?.(true);
                }
             }}
           >
             <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                  <Network className="w-6 h-6 md:w-7 md:h-7 text-white drop-shadow-md" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-wide drop-shadow-lg text-white">星幕画布</h2>
             </div>
             <p className="text-white/90 text-left text-sm md:text-base max-w-md leading-relaxed font-medium drop-shadow-md">全能AI剧本与画面创作工作流，融合动画分镜图，点击立刻进入沉浸式体验。</p>
           </div>
           
           {/* Ad 2 */}
           <div 
             className={`absolute inset-0 transition-opacity duration-1000 flex flex-col justify-center px-8 md:px-14 text-white cursor-pointer ${adIndex === 1 ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
             style={{ 
               backgroundImage: `linear-gradient(to right, rgba(4, 120, 87, 0.8), rgba(15, 118, 110, 0.7), transparent), url('https://image.pollinations.ai/prompt/vintage%20movie%20film%20reel%20and%20professional%20cinema%20camera%2C%20cinematic%20lighting%2C%20teal%20and%20orange%20color%20grading%2C%20high-end%20premium%20feel%2C%20sharp%20focus%2C%208k?width=1200&height=400&nologo=true')`,
               backgroundSize: 'cover',
               backgroundPosition: 'center',
             }}
             onClick={() => setCurrentFunc?.('seedance')}
           >
             <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-lg border border-white/20">
                  <Languages className="w-6 h-6 md:w-7 md:h-7 text-white drop-shadow-md" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-wide drop-shadow-lg text-white">Seedance提示词</h2>
             </div>
             <p className="text-white/90 text-left text-sm md:text-base max-w-md leading-relaxed font-medium drop-shadow-md">一键转换短剧视频提示词，融合经典电影胶片与摄影机质感，生成电影级运镜。</p>
           </div>
           
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2.5 z-20">
             <div className={`w-2 h-2 rounded-full transition-all duration-300 ${adIndex === 0 ? 'bg-white w-6' : 'bg-white/40 cursor-pointer'}`} onClick={() => setAdIndex(0)} />
             <div className={`w-2 h-2 rounded-full transition-all duration-300 ${adIndex === 1 ? 'bg-white w-6' : 'bg-white/40 cursor-pointer'}`} onClick={() => setAdIndex(1)} />
           </div>
        </div>

        {/* Input Area (Centered) */}
        <div className="w-full max-w-4xl xl:max-w-5xl z-10 relative">
          {children}
        </div>

        {/* Recent Projects */}
        <div className="w-full max-w-4xl xl:max-w-5xl mt-12 flex flex-col items-start px-2">
           <h3 className="text-sm font-bold text-neutral-800 mb-5 tracking-wide flex items-center gap-2">
             <Network className="w-4 h-4 text-blue-500" /> 
             最近星幕项目
           </h3>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
             <div 
               onClick={() => {
                  setCurrentFunc?.('canvasDrama');
                  setShowCanvasProjects?.(true);
                  setAutoOpenProjectModal?.(true);
                }}
               className="h-32 rounded-2xl border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center text-neutral-500 hover:text-blue-600 hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-all duration-300"
             >
               <div className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center mb-2">
                 <Plus className="w-5 h-5 text-neutral-700" />
               </div>
               <span className="text-[13px] font-semibold">新建画布</span>
             </div>
             {recentProjects.map((proj: any) => (
                <div 
                  key={proj.id}
                  onClick={() => {
                    setCurrentFunc?.('canvasDrama');
                    setCurrentConvId?.(proj.id);
                  }}
                  className="h-32 rounded-2xl border border-neutral-200 bg-white p-5 flex flex-col text-left cursor-pointer hover:border-blue-500 hover:shadow-md transition-all duration-300 group relative overflow-hidden"
                >
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50/50 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out z-0"></div>
                  <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-auto shrink-0 relative z-10">
                    <Network className="w-5 h-5" />
                  </div>
                  <div className="text-[14px] font-semibold text-neutral-800 truncate w-full mt-2 relative z-10 group-hover:text-blue-600 transition-colors">{proj.title}</div>
                  <div className="text-[12px] text-neutral-400 mt-1 relative z-10">{new Date(proj.created).toLocaleDateString()}</div>
                </div>
             ))}
           </div>
        </div>
        
        {/* User Showcase */}
        <div className="w-full max-w-4xl xl:max-w-5xl mt-12 flex flex-col items-start mb-12 px-2">
           <h3 className="text-sm font-bold text-neutral-800 mb-5 tracking-wide flex items-center gap-2">
             <ImageIcon className="w-4 h-4 text-emerald-500" />
             优秀作品分享
           </h3>
           <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
             {showcaseItems.map(item => (
               <div key={item.id} className="aspect-[16/10] bg-neutral-100 rounded-2xl overflow-hidden relative cursor-pointer group shadow-sm hover:shadow-lg transition-all duration-500 border border-neutral-200">
                  <div 
                    className="absolute inset-0 bg-cover bg-center group-hover:scale-110 transition-transform duration-700 ease-in-out"
                    style={{ backgroundImage: `url('${item.image}')` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-5 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                     <div className="text-white font-bold text-base md:text-lg text-left drop-shadow-md mb-1">{item.title}</div>
                     <div className="text-white/80 text-xs md:text-sm font-medium text-left truncate">{item.subtitle}</div>
                  </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    );
  }

  if (currentFunc === 'drama') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center w-full max-w-4xl mx-auto">
        <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 mb-6 shadow-sm">
          <BookOpen className="w-8 h-8" />
        </div>
        <div className="text-[24px] font-bold text-neutral-900 mb-2">大神剧本工作台</div>
        <div className="text-[15px] text-neutral-500 mb-10 max-w-[420px] leading-relaxed">
          选择一个功能，然后在下方输入框直接输入内容开始创作
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          <div onClick={() => setCurrentDramaSubFunc?.('1.优化剧本')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentDramaSubFunc === '1.优化剧本' ? 'border-orange-400 bg-orange-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
              <Wand2 className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">优化剧本</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">梳理现有剧本，增加镜头描述，优化格式</div>
          </div>
          <div onClick={() => setCurrentDramaSubFunc?.('2.剧本续写')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentDramaSubFunc === '2.剧本续写' ? 'border-orange-400 bg-orange-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-3">
              <PenTool className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">剧本续写</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">根据已有章节，续写后续剧情</div>
          </div>
          <div onClick={() => setCurrentDramaSubFunc?.('3.小说改剧本')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentDramaSubFunc === '3.小说改剧本' ? 'border-orange-400 bg-orange-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
              <Book className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">小说改剧本</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">将小说或文章改编为动态漫剧本</div>
          </div>
          <div onClick={() => setCurrentDramaSubFunc?.('4.原创剧本')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentDramaSubFunc === '4.原创剧本' ? 'border-orange-400 bg-orange-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-orange-300 hover:bg-orange-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center mb-3">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">原创剧本</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">根据您的要求，生成全新原创剧本</div>
          </div>
        </div>

        {/* Recent Drama Conversations */}
        {(() => {
          const recentDramas = Object.values(conversations || {})
            .filter((c: any) => c.func === 'drama' && c.messages && c.messages.length > 0)
            .sort((a: any, b: any) => b.created - a.created)
            .slice(0, 3);
            
          if (recentDramas.length === 0) return null;
          
          return (
            <div className="w-full mt-12 flex flex-col items-start px-2">
              <h3 className="text-sm font-bold text-neutral-800 mb-4 tracking-wide flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-500" />
                最近剧本创作
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {recentDramas.map((drama: any) => (
                  <div 
                    key={drama.id}
                    onClick={() => {
                      setCurrentConvId?.(drama.id);
                    }}
                    className="group bg-white border border-neutral-100 p-4 rounded-xl flex flex-col items-start text-left cursor-pointer hover:border-orange-300 hover:shadow-md transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-orange-50/30 rounded-full group-hover:scale-150 transition-transform duration-500 z-0" />
                    <div className="text-[13px] font-semibold text-neutral-800 truncate w-full mb-1 relative z-10 group-hover:text-orange-600 transition-colors uppercase tracking-tight">
                      {drama.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 relative z-10">
                      {new Date(drama.created).toLocaleDateString()} · {Math.ceil(drama.messages.length / 2)} 轮对话
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (currentFunc === 'seedance') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center w-full max-w-4xl mx-auto">
        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 mb-6 shadow-sm">
          <Languages className="w-8 h-8" />
        </div>
        <div className="text-[24px] font-bold text-neutral-900 mb-2">Seedance 提示词转换</div>
        <div className="text-[15px] text-neutral-500 mb-10 max-w-[480px] leading-relaxed">
          将剧本转换为适配 Seedance 2.0 的视频生成提示词，每段15秒，电影级运镜
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <div onClick={() => setCurrentSeedanceSubFunc?.('互动剧提示词')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentSeedanceSubFunc === '互动剧提示词' ? 'border-emerald-500 bg-emerald-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
              <Clapperboard className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">互动剧提示词</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">直接开始，粘贴剧本转换为Seedance 15秒短视频分镜提示词</div>
          </div>
          <div onClick={() => setCurrentSeedanceSubFunc?.('素材提取')} className={`p-5 border-2 rounded-2xl cursor-pointer transition-all duration-300 text-left ${currentSeedanceSubFunc === '素材提取' ? 'border-emerald-500 bg-emerald-50/50 shadow-md transform -translate-y-1' : 'border-neutral-100 hover:border-emerald-400 hover:bg-emerald-50/30 hover:shadow-sm'}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">素材提取</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">识别剧本素材，提取角色、道具、场景、阵营等设定图提示词</div>
          </div>
        </div>

        {/* Recent Seedance Conversations */}
        {(() => {
          const recentSeedances = Object.values(conversations || {})
            .filter((c: any) => c.func === 'seedance' && c.messages && c.messages.length > 0)
            .sort((a: any, b: any) => b.created - a.created)
            .slice(0, 3);
            
          if (recentSeedances.length === 0) return null;
          
          return (
            <div className="w-full mt-12 flex flex-col items-start px-2">
              <h3 className="text-sm font-bold text-neutral-800 mb-4 tracking-wide flex items-center gap-2">
                <Clapperboard className="w-4 h-4 text-emerald-500" />
                最近提示词转换
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {recentSeedances.map((seedance: any) => (
                  <div 
                    key={seedance.id}
                    onClick={() => {
                      setCurrentConvId?.(seedance.id);
                    }}
                    className="group bg-white border border-neutral-100 p-4 rounded-xl flex flex-col items-start text-left cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-emerald-50/30 rounded-full group-hover:scale-150 transition-transform duration-500 z-0" />
                    <div className="text-[13px] font-semibold text-neutral-800 truncate w-full mb-1 relative z-10 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                      {seedance.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 relative z-10">
                      {new Date(seedance.created).toLocaleDateString()} · {Math.ceil(seedance.messages.length / 2)} 轮对话
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  if (currentFunc === 'yellowImage') {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center w-full max-w-4xl mx-auto">
        <div className="w-16 h-16 bg-yellow-50 rounded-2xl flex items-center justify-center text-yellow-500 mb-6 shadow-sm border border-yellow-100">
          <ImageIcon className="w-8 h-8" />
        </div>
        <div className="text-[24px] font-bold text-neutral-900 mb-2">图片生成工具</div>
        <div className="text-[15px] text-neutral-500 mb-10 max-w-[420px] leading-relaxed">
          使用最先进的模型为您生成各种创意图片。
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <div onClick={() => quickSend('生成一张赛博朋克风格的未来城市风景图，带有霓虹灯和飞行汽车。')} className="p-5 border-2 border-yellow-100 rounded-2xl cursor-pointer transition-all duration-300 text-left hover:border-yellow-400 hover:bg-yellow-50/30 hover:shadow-md">
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">🌆 未来城市</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">赛博朋克风格的风景图推荐</div>
          </div>
          <div onClick={() => quickSend('生成一只穿着宇航服的小猫在月球上探索的可爱插画。')} className="p-5 border-2 border-yellow-100 rounded-2xl cursor-pointer transition-all duration-300 text-left hover:border-yellow-400 hover:bg-yellow-50/30 hover:shadow-md">
            <div className="text-[15px] font-bold text-neutral-800 mb-1.5">🐱 卡通插画</div>
            <div className="text-[13px] text-neutral-500 leading-relaxed">可爱有趣的动物或场景插图</div>
          </div>
        </div>

        {/* Recent Yellow Image Conversations */}
        {(() => {
          const recentImages = Object.values(conversations || {})
            .filter((c: any) => c.func === 'yellowImage' && c.messages && c.messages.length > 0)
            .sort((a: any, b: any) => b.created - a.created)
            .slice(0, 3);
            
          if (recentImages.length === 0) return null;
          
          return (
            <div className="w-full mt-12 flex flex-col items-start px-2">
              <h3 className="text-sm font-bold text-neutral-800 mb-4 tracking-wide flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-yellow-600" />
                最近绘图创作
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                {recentImages.map((image: any) => (
                  <div 
                    key={image.id}
                    onClick={() => {
                      setCurrentConvId?.(image.id);
                    }}
                    className="group bg-white border border-neutral-100 p-4 rounded-xl flex flex-col items-start text-left cursor-pointer hover:border-yellow-300 hover:shadow-md transition-all duration-300 relative overflow-hidden"
                  >
                    <div className="absolute -right-4 -top-4 w-16 h-16 bg-yellow-50/30 rounded-full group-hover:scale-150 transition-transform duration-500 z-0" />
                    <div className="text-[13px] font-semibold text-neutral-800 truncate w-full mb-1 relative z-10 group-hover:text-yellow-600 transition-colors uppercase tracking-tight">
                      {image.title}
                    </div>
                    <div className="text-[11px] text-neutral-400 relative z-10">
                      {new Date(image.created).toLocaleDateString()} · {Math.ceil(image.messages.length / 2)} 轮对话
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return null;
}
