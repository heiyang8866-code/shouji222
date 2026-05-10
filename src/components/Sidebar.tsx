import { FastTextarea, FastInput } from './FastInput';
import React, { useState, useRef } from 'react';
import { MessageSquare, BookOpen, Languages, Plus, ChevronUp, Image as ImageIcon, X, Network, BookmarkPlus, PanelLeftClose, PanelLeftOpen, Settings, Upload, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { Conversation, FuncType, Asset } from '../types';
import { MODELS, IMAGE_MODELS } from '../constants';

const BrandLogo = () => (
  <div className="w-10 h-10 rounded-[10px] bg-[#FF5C28] flex items-center justify-center shrink-0 shadow-sm">
    <svg viewBox="0 0 100 100" className="w-[75%] h-[75%] text-white" fill="currentColor">
      <defs>
        <mask id="hole-mask">
          <rect width="100" height="100" fill="white" />
          <circle cx="38" cy="45" r="13" fill="black" />
          <path d="M 38 36 Q 38 45 29 45 Q 38 45 38 54 Q 38 45 47 45 Q 38 45 38 36 Z" fill="white" />
        </mask>
      </defs>
      
      <g mask="url(#hole-mask)">
        {/* Palm & Wrist */}
        <path d="M22 55 C 22 80 40 95 55 100 L 80 100 C 70 80 65 65 52 45 Z" />
        {/* Outer Circle (thumb/index) */}
        <circle cx="38" cy="45" r="22" />
        {/* Fingers */}
        <rect x="36" y="2" width="16" height="48" rx="8" transform="rotate(12 44 26)" />
        <rect x="52" y="12" width="16" height="44" rx="8" transform="rotate(25 60 34)" />
        <rect x="68" y="26" width="14" height="38" rx="7" transform="rotate(38 75 45)" />
      </g>
    </svg>
  </div>
);

interface SidebarProps {
  currentFunc: FuncType;
  setCurrentFunc: (func: FuncType, forceNew?: boolean) => void;
  conversations: Record<string, Conversation>;
  currentConvId: string | null;
  setCurrentConvId: (id: string | null) => void;
  deleteConversation: (id: string, e: React.MouseEvent) => void;
  renameConversation: (id: string, newTitle: string) => void;
  createNewChat: () => void;
  createNewProject?: (title: string, description: string, cover?: string) => void;
  currentModelId: string;
  setCurrentModelId: (id: string) => void;
  currentModelName: string;
  setCurrentModelName: (name: string) => void;
  apiKeys: Record<string, string>;
  setApiKeys: (keys: Record<string, string>) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  showCanvasProjects?: boolean;
  setShowCanvasProjects?: (show: boolean) => void;
  onOpenSettings?: () => void;
  assets?: Asset[];
  generatingConvs: Set<string>;
}

export const Sidebar = React.memo(function Sidebar({
  currentFunc,
  setCurrentFunc,
  conversations,
  currentConvId,
  setCurrentConvId,
  deleteConversation,
  renameConversation,
  createNewChat,
  createNewProject,
  currentModelId,
  setCurrentModelId,
  currentModelName,
  setCurrentModelName,
  apiKeys,
  setApiKeys,
  isOpen,
  setIsOpen,
  showCanvasProjects,
  setShowCanvasProjects,
  onOpenSettings,
  assets = [],
  generatingConvs
}: SidebarProps) {
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [newProjectCover, setNewProjectCover] = useState<string | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const editInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const handleSaveEdit = (id: string) => {
    if (editValue.trim()) {
      renameConversation(id, editValue.trim());
    }
    setEditingId(null);
  };

  const handleCreateProject = () => {
    if (newProjectTitle.trim() && createNewProject) {
      createNewProject(newProjectTitle.trim(), newProjectDesc.trim(), newProjectCover || undefined);
      setProjectModalOpen(false);
      setNewProjectTitle('');
      setNewProjectDesc('');
      setNewProjectCover(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setNewProjectCover(evt.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasDramaClick = () => {
    if (currentFunc === 'canvasDrama') {
      if (setShowCanvasProjects) setShowCanvasProjects(!showCanvasProjects);
    } else {
      setCurrentFunc('canvasDrama');
      if (setShowCanvasProjects) setShowCanvasProjects(false);
      const dramaProjects = Object.values(conversations)
        .filter((c) => c.func === 'canvasDrama')
        .sort((a, b) => b.created - a.created);
      
      if (currentConvId && conversations[currentConvId]?.func === 'canvasDrama') {
        return;
      }
  
      if (dramaProjects.length > 0) {
        setCurrentConvId(dramaProjects[0].id);
      } else {
        if (createNewProject) {
          setTimeout(() => {
            createNewProject('默认星空', '功能完整的星空默认画布模板');
          }, 0);
        } else if (setShowCanvasProjects) {
          setShowCanvasProjects(true);
        }
      }
    }
  };

  const { funcConvs, groups } = React.useMemo(() => {
    const sortedConvs = Object.entries(conversations)
      .filter(([, c]) => c.func === currentFunc && (c.messages?.length > 0 || c.func === 'canvasDrama'))
      .sort((a, b) => b[1].created - a[1].created);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterday = today - 86400000;
    const weekAgo = today - 7 * 86400000;

    const grps = { today: [] as any[], yesterday: [] as any[], week: [] as any[], older: [] as any[] };
    sortedConvs.forEach(([id, c]) => {
      if (c.created >= today) grps.today.push([id, c]);
      else if (c.created >= yesterday) grps.yesterday.push([id, c]);
      else if (c.created >= weekAgo) grps.week.push([id, c]);
      else grps.older.push([id, c]);
    });
    
    return { funcConvs: sortedConvs, groups: grps };
  }, [conversations, currentFunc]);

    const renderGroup = (label: string, items: any[]) => {
      if (items.length === 0) return null;
      return (
        <div key={label}>
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-2 pt-2 pb-1">
            {label}
          </div>
          {items.map(([id, c]) => (
            <div
              key={id}
              onClick={() => {
                if (editingId !== id) {
                  setCurrentConvId(id);
                  if (window.innerWidth < 768) setIsOpen(false);
                }
              }}
              className={cn(
                "group flex flex-col gap-1 px-2.5 py-2 rounded-md cursor-pointer transition-all relative overflow-hidden",
                currentConvId === id ? "bg-white shadow-sm font-medium" : "text-neutral-500 hover:bg-neutral-100"
              )}
            >
              <div className="flex items-center gap-2 text-[13px] w-full">
                {currentFunc === 'chat' && <MessageSquare className="w-3 h-3 opacity-50 shrink-0" />}
                {currentFunc === 'drama' && <BookOpen className="w-3 h-3 opacity-50 shrink-0" />}
                {currentFunc === 'seedance' && <Languages className="w-3 h-3 opacity-50 shrink-0" />}
                {currentFunc === 'canvasDrama' && <Network className="w-3 h-3 opacity-50 shrink-0" />}
                
                {editingId === id ? (
                  <input
                    ref={editInputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleSaveEdit(id)}
                    className="flex-1 bg-transparent border-b border-blue-500 outline-none text-neutral-900"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={cn(
                    "flex-1 overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-2",
                    currentConvId === id ? "text-neutral-900" : ""
                  )}>
                    {c.title}
                    {generatingConvs.has(id) && (
                      <span className="flex gap-0.5 shrink-0">
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
                      </span>
                    )}
                  </span>
                )}

                {!editingId && (
                  <div className={cn(
                    "flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 pl-2 shadow-[-12px_0_12px_var(--bg-color)]",
                    currentConvId === id ? "bg-white" : "bg-neutral-100"
                  )} style={{ '--bg-color': currentConvId === id ? 'white' : '#f5f5f5' } as any}>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditValue(c.title);
                        setEditingId(id);
                      }}
                      className="text-neutral-400 hover:text-blue-500 p-1 rounded hover:bg-neutral-200"
                      title="编辑备注"
                    >
                      <Pencil className="w-3 h-3" />
                    </span>
                    <span
                      onClick={(e) => deleteConversation(id, e)}
                      className="text-neutral-400 hover:text-red-500 p-1 rounded hover:bg-neutral-200"
                      title="删除记录"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-neutral-400 font-normal pl-5">
                {format(c.updated || c.created, 'yyyy-MM-dd HH:mm:ss')}
              </div>
            </div>
          ))}
        </div>
      );
    };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-[280px] bg-[#FCFCFC] border-r border-neutral-200 flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-xl md:shadow-none",
          isOpen ? "translate-x-0 md:ml-0" : "-translate-x-full md:ml-[-280px]"
        )}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                <BrandLogo />
                <div className="text-[17px] font-medium tracking-[0.15em] text-neutral-800 flex items-center font-sans">
                  繁星<span className="font-bold text-neutral-900 ml-[2px] tracking-widest leading-none mt-0.5">AI</span>
                </div>
              </div>
              <button
                onClick={onOpenSettings}
                className="p-1 px-1.5 rounded-md hover:bg-neutral-200 text-neutral-500 transition-colors cursor-pointer group"
                title="设置"
              >
                <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors hidden md:block"
              title="收起边栏"
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 transition-colors md:hidden"
              title="收起边栏"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-col py-2 gap-1.5">
            <button
              onClick={() => {
                setCurrentFunc('chat', true);
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'chat' && currentConvId === null
                  ? "bg-white border-neutral-200 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'chat' && currentConvId === null && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-neutral-900 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <MessageSquare className={cn("w-4 h-4", currentFunc === 'chat' && currentConvId === null ? "text-neutral-900" : "text-blue-500")} />
              </div>
              <span className="font-medium tracking-wide">新对话</span>
            </button>
            
            <button
              onClick={() => {
                setCurrentFunc('drama', true);
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'drama' && currentConvId === null
                  ? "bg-white border-neutral-200 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'drama' && currentConvId === null && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-neutral-900 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <BookOpen className={cn("w-4 h-4", currentFunc === 'drama' ? "text-neutral-900" : "text-orange-500")} />
              </div>
              <span className="font-medium tracking-wide">大神剧本</span>
            </button>
            
            <button
              onClick={() => {
                setCurrentFunc('seedance', true);
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'seedance' && currentConvId === null
                  ? "bg-white border-neutral-200 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'seedance' && currentConvId === null && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-neutral-900 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <Languages className={cn("w-4 h-4", currentFunc === 'seedance' ? "text-neutral-900" : "text-emerald-500")} />
              </div>
              <span className="font-medium tracking-wide">Seedance 提示词</span>
            </button>
            
            <button
              onClick={() => {
                setCurrentFunc('yellowImage', true);
                if (window.innerWidth < 768) setIsOpen(false);
              }}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'yellowImage' && currentConvId === null
                  ? "bg-white border-neutral-200 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'yellowImage' && currentConvId === null && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-neutral-900 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <ImageIcon className={cn("w-4 h-4", currentFunc === 'yellowImage' ? "text-neutral-900" : "text-yellow-500")} />
              </div>
              <span className="font-medium tracking-wide">黄色图片</span>
            </button>
            
            <button
              onClick={handleCanvasDramaClick}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'canvasDrama' 
                  ? "bg-white border-yellow-500/50 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'canvasDrama' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-yellow-500 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <Network className={cn("w-4 h-4", currentFunc === 'canvasDrama' ? "text-yellow-500" : "text-neutral-400")} />
              </div>
              <span className="font-medium tracking-wide font-bold text-red-500">星幕</span>
            </button>
            
            <button
              onClick={() => setCurrentFunc('assets')}
              className={cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border text-[14px] text-left w-full relative overflow-hidden",
                currentFunc === 'assets' 
                  ? "bg-white border-neutral-200 text-neutral-900 shadow-sm" 
                  : "bg-transparent border-transparent text-neutral-600 hover:bg-neutral-100"
              )}
            >
              {currentFunc === 'assets' && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 bg-neutral-900 rounded-r-full" />
              )}
              <div className="w-5 flex items-center justify-center shrink-0">
                <BookmarkPlus className={cn("w-4 h-4", currentFunc === 'assets' ? "text-neutral-900" : "text-emerald-500")} />
              </div>
              <span className="font-medium tracking-wide">资产</span>
            </button>
          </div>
        </div>

        {currentFunc === 'canvasDrama' ? (
          <button
            onClick={() => setProjectModalOpen(true)}
            className="mx-5 mt-2 p-2 rounded-md border border-dashed border-neutral-200 bg-transparent cursor-pointer text-[12px] text-neutral-500 transition-all flex items-center justify-center gap-1.5 hover:border-neutral-900 hover:text-neutral-900 hover:bg-neutral-50"
          >
            <Plus className="w-3 h-3" /> 新建项目
          </button>
        ) : (
          <button
            onClick={createNewChat}
            className="mx-5 mt-2 p-2 rounded-md border border-dashed border-neutral-200 bg-transparent cursor-pointer text-[12px] text-neutral-500 transition-all flex items-center justify-center gap-1.5 hover:border-neutral-900 hover:text-neutral-900 hover:bg-neutral-50"
          >
            <Plus className="w-3 h-3" /> 新建对话
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {funcConvs.length === 0 ? (
            <div className="text-center py-10 px-5 text-neutral-500 text-[13px]">
              <MessageSquare className="w-7 h-7 mx-auto mb-2.5 opacity-30" />
              <div>{currentFunc === 'canvasDrama' ? '暂无项目记录' : '暂无对话记录'}</div>
            </div>
          ) : (
            <>
              {renderGroup('今天', groups.today)}
              {renderGroup('昨天', groups.yesterday)}
              {renderGroup('近7天', groups.week)}
              {renderGroup('更早', groups.older)}
            </>
          )}
        </div>

      </aside>

      {/* New Project Modal */}
      {projectModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="font-semibold text-neutral-900">新建星幕项目</h3>
              <button 
                onClick={() => setProjectModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer p-1 rounded-md hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">项目名称</label>
                <FastInput 
                  type="text" 
                  value={newProjectTitle}
                  onChange={(e) => setNewProjectTitle(e.target.value)}
                  autoFocus
                  placeholder="如：都市赘婿复仇记"
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-inherit transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">项目简介 (可选)</label>
                <FastTextarea 
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="简单描述一下你的短剧想法..."
                  rows={3}
                  className="w-full px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 border-inherit transition-all resize-none"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-neutral-700">项目封面 (可选)</label>
                {!newProjectCover ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowAssets(true)}
                      className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-blue-400 transition-colors text-neutral-600 cursor-pointer"
                    >
                      <ImageIcon className="w-5 h-5" />
                      <span className="text-[11px] font-medium">从资产库找图</span>
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-3 border border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-blue-400 transition-colors text-neutral-600 cursor-pointer"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[11px] font-medium">本地上传</span>
                    </button>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleFileUpload} 
                    />
                  </div>
                ) : (
                  <div className="relative group rounded-xl overflow-hidden aspect-video border border-neutral-200 bg-black/5">
                    <img src={newProjectCover} alt="Cover Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                      <button 
                        onClick={() => setShowAssets(true)}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-white text-[11px] font-medium cursor-pointer transition-colors"
                      >
                        更换
                      </button>
                      <button 
                        onClick={() => setNewProjectCover(null)}
                        className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-[11px] font-medium cursor-pointer transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                )}
                {showAssets && (
                   <div className="mt-2 border border-neutral-200 rounded-xl p-2 bg-neutral-50 max-h-40 overflow-y-auto">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-[11px] font-medium text-neutral-500">选择资产</span>
                       <button onClick={() => setShowAssets(false)} className="text-neutral-400 hover:text-neutral-700 cursor-pointer"><X className="w-3.5 h-3.5"/></button>
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                       {assets.filter(a => a.type === 'image').map(asset => (
                         <div 
                           key={asset.id} 
                           onClick={() => { setNewProjectCover(asset.url); setShowAssets(false); }}
                           className="aspect-square rounded border border-neutral-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500"
                         >
                           <img src={asset.url} className="w-full h-full object-cover" />
                         </div>
                       ))}
                       {assets.filter(a => a.type === 'image').length === 0 && (
                         <div className="col-span-3 text-center py-4 text-[11px] text-neutral-400">没有可选的图片</div>
                       )}
                     </div>
                   </div>
                )}
                <p className="text-[10px] text-neutral-400 mt-1">
                  未上传则默认使用生成的第一张图片作为封面
                </p>
              </div>

            </div>
            <div className="px-5 py-4 bg-neutral-50 border-t border-neutral-100 flex justify-end gap-2">
              <button 
                onClick={() => setProjectModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-neutral-600 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                取消
              </button>
              <button 
                onClick={handleCreateProject}
                disabled={!newProjectTitle.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                创建项目
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});
