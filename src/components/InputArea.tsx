import { FastTextarea, FastInput } from './FastInput';
import { ArrowUp, Square, ChevronUp, Image as ImageIcon, Monitor, Paperclip, X, Plus, Images, HardDrive, Sparkles } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { Asset, FuncType } from '../types';
import { MODELS, IMAGE_MODELS } from '../constants';

interface InputAreaProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  isImage?: boolean;
  currentImageRatio?: string;
  setCurrentImageRatio?: (val: string) => void;
  currentImageResolution?: string;
  setCurrentImageResolution?: (val: string) => void;
  currentImageQuality?: string;
  setCurrentImageQuality?: (val: string) => void;
  attachedImages: string[];
  setAttachedImages: React.Dispatch<React.SetStateAction<string[]>>;
  assets?: Asset[];
  currentModelId?: string;
  setCurrentModelId?: (id: string) => void;
  currentFunc?: FuncType;
}

export function InputArea({ 
  input, 
  setInput, 
  onSend, 
  onStop, 
  isGenerating, 
  isImage,
  currentImageRatio,
  setCurrentImageRatio,
  currentImageResolution,
  setCurrentImageResolution,
  currentImageQuality,
  setCurrentImageQuality,
  attachedImages,
  setAttachedImages,
  assets = [],
  currentModelId,
  setCurrentModelId,
  currentFunc
}: InputAreaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ratioOpen, setRatioOpen] = useState(false);
  const [resOpen, setResOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMenuOpen, setUploadMenuOpen] = useState(false);
  const [assetModalOpen, setAssetModalOpen] = useState(false);

  const isLLMFunc = currentFunc === 'chat' || currentFunc === 'drama' || currentFunc === 'seedance';
  const llmModels = MODELS;
  const imageModels = IMAGE_MODELS;

  const currentModelName = [...MODELS, ...IMAGE_MODELS].find(m => m.id === currentModelId)?.name || '选择模型';

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Check if the user is in the middle of a Chinese input session (Composition)
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const processFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && typeof event.target.result === 'string') {
          setAttachedImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...attachedImages];
    newImages.splice(index, 1);
    setAttachedImages(newImages);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const triggerLocalUpload = () => {
    setUploadMenuOpen(false);
    fileInputRef.current?.click();
  };

  const triggerLibraryUpload = () => {
    setUploadMenuOpen(false);
    setAssetModalOpen(true);
  };

  const handleSelectAsset = (url: string) => {
    setAttachedImages(prev => [...prev, url]);
    setAssetModalOpen(false);
  };

  const imageAssets = (assets || []).filter(a => a.type === 'image');

  return (
    <div 
      className="px-6 pb-6 shrink-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-[780px] mx-auto relative">
        <div className={cn(
          "flex flex-col border rounded-3xl bg-white transition-all shadow-sm focus-within:ring-2 focus-within:ring-neutral-900/5 relative", 
          isDragging ? "border-blue-500 bg-blue-50/50 scale-[1.01]" : "border-neutral-200 focus-within:border-neutral-900"
        )}>
          {isDragging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-3xl backdrop-blur-sm pointer-events-none">
              <span className="text-blue-500 font-medium flex items-center gap-2">
                <ImageIcon className="w-5 h-5" /> 释放鼠标上传图片
              </span>
            </div>
          )}
          
          {attachedImages.length > 0 && (
            <div className="flex gap-2 p-3 pb-0 flex-wrap">
              {attachedImages.map((img, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-md overflow-hidden border border-neutral-200 group">
                  <img src={img} alt="attached" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-none"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={cn("flex items-end flex-1 w-full", isImage ? "p-2 pb-0" : "")}>
            <div className="relative">
              <button
                onClick={() => setUploadMenuOpen(!uploadMenuOpen)}
                className="p-3 text-neutral-400 hover:text-neutral-600 transition-colors border-none bg-transparent cursor-pointer shrink-0"
                title="上传或选择图片"
              >
                <Plus className="w-5 h-5" />
              </button>
              {uploadMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUploadMenuOpen(false)} />
                  <div className="absolute bottom-full mb-2 left-2 w-36 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <button
                      onClick={triggerLocalUpload}
                      className="w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center gap-2 text-neutral-600"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                      本地图片
                    </button>
                    <button
                      onClick={triggerLibraryUpload}
                      className="w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center gap-2 text-neutral-600"
                    >
                      <Images className="w-3.5 h-3.5" />
                      从资产选择
                    </button>
                  </div>
                </>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              multiple 
              onChange={handleFileChange} 
            />

            <FastTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder={isImage ? "输入图片描述词 (如: 一只可爱的猫咪，超现实主义，8k分辨率...)" : "输入消息..."}
              className={cn("flex-1 border-none outline-none text-sm resize-none bg-transparent text-neutral-900 max-h-[140px] leading-relaxed placeholder:text-neutral-400 mt-1", isImage ? "py-2.5 px-2" : "py-3.5 px-2", attachedImages.length > 0 ? "pt-2" : "")}
            />
            {isGenerating ? (
              <button
                onClick={onStop}
                className={cn("border-none bg-red-500 text-white rounded-lg cursor-pointer flex items-center justify-center transition-all hover:bg-red-600 shrink-0", isImage ? "w-9 h-9 mb-1 mr-1" : "my-2 mr-2 w-9 h-9")}
              >
                <Square className="w-3.5 h-3.5 fill-current" />
              </button>
            ) : (
              <button
                onClick={onSend}
                disabled={!input.trim() && attachedImages.length === 0}
                className={cn("border-none bg-neutral-900 text-white rounded-lg cursor-pointer flex items-center justify-center transition-all hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400 disabled:cursor-not-allowed shrink-0", isImage ? "w-9 h-9 mb-1 mr-1" : "my-2 mr-2 w-9 h-9")}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>

          {isLLMFunc && (
            <div className="flex gap-2 items-center px-4 py-2 border-t border-neutral-100/50 bg-neutral-50/50 rounded-b-3xl">
              <div className="relative">
                <button
                  onClick={() => setModelOpen(!modelOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-none bg-white hover:bg-neutral-100 rounded-md shadow-sm border border-neutral-200/50 text-xs font-bold text-neutral-900 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-blue-500" />
                  {currentModelName}
                  <ChevronUp className="w-3 h-3 opacity-50" />
                </button>
                {modelOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-44 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                       {llmModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setCurrentModelId?.(m.id); setModelOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                            currentModelId === m.id ? "text-neutral-900 font-bold bg-neutral-50/50" : "text-neutral-500"
                          )}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {isImage && (
            <div className="flex gap-2 items-center flex-wrap px-4 py-2 border-t border-neutral-100/50 bg-neutral-50/50 rounded-b-3xl">
              {/* Model Select for Image */}
              <div className="relative">
                <button
                  onClick={() => { setModelOpen(!modelOpen); setRatioOpen(false); setResOpen(false); setQualityOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-none bg-white hover:bg-neutral-100 rounded-md shadow-sm border border-neutral-200/50 text-xs font-bold text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="w-3 h-3 text-yellow-500" />
                  {currentModelName}
                  <ChevronUp className="w-3 h-3 opacity-50" />
                </button>
                {modelOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-44 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                       {imageModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setCurrentModelId?.(m.id); setModelOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                            currentModelId === m.id ? "text-neutral-900 font-bold bg-neutral-50/50" : "text-neutral-500"
                          )}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Resolution Dropup */}
              <div className="relative">
                <button
                  onClick={() => { setResOpen(!resOpen); setRatioOpen(false); setQualityOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-none bg-white hover:bg-neutral-100 rounded-md shadow-sm border border-neutral-200/50 text-xs font-medium text-neutral-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Monitor className="w-3 h-3" />
                  {currentImageResolution}
                  <ChevronUp className="w-3 h-3 opacity-50" />
                </button>
                {resOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setResOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      {(currentModelId === "midjourney" || currentModelId === "niji" 
                        ? ["自适应"]
                        : ['1k', '2k', '4k']
                      ).map(res => (
                        <button
                          key={res}
                          onClick={() => { setCurrentImageResolution?.(res); setResOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                            currentImageResolution === res ? "text-neutral-900 font-medium bg-neutral-50/50" : "text-neutral-500"
                          )}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Quality Dropup */}
              {(currentModelId === 'gpt-image-2-all' || (currentModelId?.includes('image') && !currentModelId?.includes('image-preview'))) && (
                <div className="relative">
                  <button
                    onClick={() => { setQualityOpen(!qualityOpen); setRatioOpen(false); setResOpen(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border-none bg-white hover:bg-neutral-100 rounded-md shadow-sm border border-neutral-200/50 text-xs font-medium text-neutral-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span className="font-bold flex items-center justify-center">✨</span>
                    {currentModelId === 'gpt-image-2-all' 
                      ? (currentImageQuality === 'auto' ? '自动' : 
                         currentImageQuality === 'low' ? '画质: 低' : 
                         currentImageQuality === 'medium' ? '画质: 中' : '画质: 高')
                      : (currentImageQuality === 'standard' ? '标清' : '高清')}
                    <ChevronUp className="w-3 h-3 opacity-50" />
                  </button>
                  {qualityOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setQualityOpen(false)} />
                      <div className="absolute bottom-full mb-2 left-0 w-32 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        {currentModelId === 'gpt-image-2-all' 
                          ? ['auto', 'low', 'medium', 'high'].map(q => (
                              <button
                                key={q}
                                onClick={() => { setCurrentImageQuality?.(q); setQualityOpen(false); }}
                                className={cn(
                                  "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                                  currentImageQuality === q ? "text-neutral-900 font-medium bg-neutral-50/50" : "text-neutral-500"
                                )}
                              >
                                {q === 'auto' ? '自动' : q === 'low' ? '质量: 低' : q === 'medium' ? '质量: 中' : '质量: 高'}
                              </button>
                            ))
                          : ['standard', 'hd'].map(q => (
                              <button
                                key={q}
                                onClick={() => { setCurrentImageQuality?.(q); setQualityOpen(false); }}
                                className={cn(
                                  "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                                  currentImageQuality === q ? "text-neutral-900 font-medium bg-neutral-50/50" : "text-neutral-500"
                                )}
                              >
                                {q === 'standard' ? '标清' : '高清'}
                              </button>
                            ))
                        }
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Aspect Ratio Dropup */}
              <div className="relative">
                <button
                  onClick={() => { setRatioOpen(!ratioOpen); setResOpen(false); setQualityOpen(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 border-none bg-white hover:bg-neutral-100 rounded-md shadow-sm border border-neutral-200/50 text-xs font-medium text-neutral-600 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ImageIcon className="w-3 h-3" />
                  {currentImageRatio}
                  <ChevronUp className="w-3 h-3 opacity-50" />
                </button>
                {ratioOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setRatioOpen(false)} />
                    <div className="absolute bottom-full mb-2 left-0 w-28 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                      {(currentModelId === "midjourney" || currentModelId === "niji" 
                        ? ["1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3"]
                        : currentModelId === "gemini-3-pro-image-preview"
                        ? ["自适应", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9"]
                        : currentModelId === "gemini-3.1-flash-image-preview"
                        ? ["自适应", "1:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "8:1", "1:8", "4:1", "1:4", "21:9"]
                        : currentModelId === "gpt-image-2-all"
                        ? ["自适应", "1:1", "1:2", "2:1", "9:16", "16:9", "3:4", "4:3", "3:2", "2:3", "4:5", "5:4", "21:9", "9:21"]
                        : ["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"]
                      ).map(ratio => (
                        <button
                          key={ratio}
                          onClick={() => { setCurrentImageRatio?.(ratio); setRatioOpen(false); }}
                          className={cn(
                            "w-full text-left px-4 py-2 border-none text-xs cursor-pointer transition-colors hover:bg-neutral-50 flex items-center justify-between",
                            currentImageRatio === ratio ? "text-neutral-900 font-medium bg-neutral-50/50" : "text-neutral-500"
                          )}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Asset Selection Modal */}
          {assetModalOpen && (
            <div className="fixed inset-0 bg-black/40 z-[100] flex flex-col sm:items-center sm:justify-center animate-in fade-in duration-200">
              <div className="bg-white w-full h-full sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-2xl shadow-xl flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
                  <h3 className="font-semibold text-neutral-900 text-lg">从资产选择图片</h3>
                  <button onClick={() => setAssetModalOpen(false)} className="p-2 border-none bg-transparent hover:bg-neutral-100 rounded-full transition-colors cursor-pointer text-neutral-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {imageAssets.length === 0 ? (
                    <div className="text-center py-12 text-neutral-400">
                      <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p>资产中暂无图片，请先上传或生成图片</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {imageAssets.map(asset => (
                        <button
                          key={asset.id}
                          onClick={() => handleSelectAsset(asset.url)}
                          className="relative aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500 transition-colors group cursor-pointer bg-neutral-100 p-0"
                        >
                          <img src={asset.url} alt={asset.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                            <p className="text-[10px] text-white truncate text-left">{asset.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

