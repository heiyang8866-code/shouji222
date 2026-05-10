import { Menu, PanelLeftOpen } from 'lucide-react';
import { FuncType, Message, Asset } from '../types';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';
import { InputArea } from './InputArea';
import React, { useEffect, useRef } from 'react';

interface ChatAreaProps {
  currentFunc: FuncType;
  setCurrentFunc: (func: FuncType) => void;
  currentDramaSubFunc: string;
  setCurrentDramaSubFunc: (val: string) => void;
  currentSeedanceSubFunc: string;
  setCurrentSeedanceSubFunc: (val: string) => void;
  currentImageRatio?: string;
  setCurrentImageRatio?: (val: string) => void;
  currentImageResolution?: string;
  setCurrentImageResolution?: (val: string) => void;
  currentImageQuality?: string;
  setCurrentImageQuality?: (val: string) => void;
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  onRegenerate: () => void;
  quickSend: (text: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onSaveAsset?: (url: string, type: 'image' | 'audio') => void;
  attachedImages: string[];
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  assets?: Asset[];
  currentModelId?: string;
  setCurrentModelId?: (id: string) => void;
  conversations?: Record<string, any>;
  setCurrentConvId?: (id: string | null) => void;
  createNewProject?: (title: string, description: string) => void;
  setShowCanvasProjects?: (val: boolean) => void;
  setAutoOpenProjectModal?: (val: boolean) => void;
}

export const ChatArea = React.memo(function ChatArea({
  currentFunc,
  setCurrentFunc,
  currentDramaSubFunc,
  setCurrentDramaSubFunc,
  currentSeedanceSubFunc,
  setCurrentSeedanceSubFunc,
  currentImageRatio,
  setCurrentImageRatio,
  currentImageResolution,
  setCurrentImageResolution,
  currentImageQuality,
  setCurrentImageQuality,
  messages,
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  onRegenerate,
  quickSend,
  sidebarOpen,
  setSidebarOpen,
  onSaveAsset,
  attachedImages,
  setAttachedImages,
  assets,
  currentModelId,
  setCurrentModelId,
  conversations,
  setCurrentConvId,
  createNewProject,
  setShowCanvasProjects,
  setAutoOpenProjectModal
}: ChatAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && messages.length > 0) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const handleEditMsg = React.useCallback((msg: Message) => {
    let cleanedContent = msg.content || '';
    if (currentFunc === 'yellowImage') {
      cleanedContent = cleanedContent.replace(/【要求：比例 .*?】\s*/, '');
    }
    setInput(cleanedContent);
    if (msg.images) {
      setAttachedImages(msg.images);
    }
  }, [currentFunc, setInput, setAttachedImages]);

  const titles = {
    chat: { title: '新对话', subtitle: '通用智能助手，随时为您解答' },
    drama: { title: '大神剧本', subtitle: '动态漫剧本创作工作流' },
    seedance: { title: 'Seedance 提示词', subtitle: '将剧本转换为Seedance视频提示词' },
    yellowImage: { title: '黄色图片', subtitle: '输入文本生成您的专属图片' },
  };

  const renderInputArea = () => (
    <InputArea
      input={input}
      setInput={setInput}
      onSend={onSend}
      onStop={onStop}
      isGenerating={isGenerating}
      isImage={currentFunc === 'yellowImage'}
      currentImageRatio={currentImageRatio}
      setCurrentImageRatio={setCurrentImageRatio}
      currentImageResolution={currentImageResolution}
      setCurrentImageResolution={setCurrentImageResolution}
      currentImageQuality={currentImageQuality}
      setCurrentImageQuality={setCurrentImageQuality}
      attachedImages={attachedImages}
      setAttachedImages={setAttachedImages}
      assets={assets}
      currentModelId={currentModelId}
      setCurrentModelId={setCurrentModelId}
      currentFunc={currentFunc}
    />
  );

  return (
    <main className="flex-1 flex flex-col bg-white min-w-0 h-full text-neutral-900">
      <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1 -ml-1 border-none bg-transparent text-neutral-900 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="hidden md:block p-1.5 -ml-2 rounded-md hover:bg-neutral-100 text-neutral-500 transition-colors cursor-pointer"
              title="展开边栏"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="text-[15px] font-semibold text-neutral-900">
              {titles[currentFunc].title}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {titles[currentFunc].subtitle}
            </div>
          </div>
        </div>
        
        {currentFunc === 'drama' && messages.length === 0 && (
          <div className="flex bg-neutral-100 p-1 rounded-lg">
            {['1.优化剧本', '2.剧本续写', '3.小说改剧本', '4.原创剧本'].map((opt) => (
              <button
                key={opt}
                onClick={() => setCurrentDramaSubFunc(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  currentDramaSubFunc === opt
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {opt.substring(2)}
              </button>
            ))}
          </div>
        )}
        
        {currentFunc === 'seedance' && messages.length === 0 && (
          <div className="flex bg-neutral-100 p-1 rounded-lg">
            {['互动剧提示词', '素材提取'].map((opt) => (
              <button
                key={opt}
                onClick={() => setCurrentSeedanceSubFunc(opt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  currentSeedanceSubFunc === opt
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin flex flex-col">
        {messages.length === 0 ? (
          <div className={currentFunc === 'chat' ? "w-full pb-8" : "w-full mx-auto px-6 pt-8 pb-24"}>
            <WelcomeScreen 
              currentFunc={currentFunc} 
              quickSend={quickSend} 
              currentDramaSubFunc={currentDramaSubFunc}
              setCurrentDramaSubFunc={setCurrentDramaSubFunc}
              currentSeedanceSubFunc={currentSeedanceSubFunc}
              setCurrentSeedanceSubFunc={setCurrentSeedanceSubFunc}
              conversations={conversations}
              setCurrentConvId={setCurrentConvId}
              createNewProject={createNewProject}
              setCurrentFunc={setCurrentFunc}
              setShowCanvasProjects={setShowCanvasProjects}
              setAutoOpenProjectModal={setAutoOpenProjectModal}
            >
              {currentFunc === 'chat' && renderInputArea()}
            </WelcomeScreen>
          </div>
        ) : (
          <div className="max-w-[840px] xl:max-w-[960px] mx-auto px-6 pt-6 pb-24 w-full">
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                message={msg}
                isLast={idx === messages.length - 1}
                isGenerating={isGenerating}
                onRegenerate={onRegenerate}
                onSaveAsset={onSaveAsset}
                onEdit={handleEditMsg}
              />
            ))}
            {isGenerating && messages[messages.length - 1]?.role === 'user' && (
              <div className="flex gap-3 mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300 assistant">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0 mt-0.5 bg-neutral-100 text-neutral-900">
                  ✦
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-neutral-500 mb-1">繁星AI</div>
                  <div className="py-1">
                    <div className="flex gap-1 py-2">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {(messages.length > 0 || currentFunc !== 'chat') && renderInputArea()}
    </main>
  );
});
