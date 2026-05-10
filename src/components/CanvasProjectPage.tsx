import React, { useState, useRef } from 'react';
import { Network, Plus, Folder, Users, Search, Play, X, Image as ImageIcon, Upload, Settings, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { Asset } from '../types';

interface CanvasProjectPageProps {
  conversations: Record<string, any>;
  setCurrentConvId: (id: string | null) => void;
  createNewProject: (title: string, description: string, cover?: string) => void;
  updateProject: (id: string, updates: { title?: string; description?: string; cover?: string }) => void;
  deleteProject: (id: string) => void;
  setShowCanvasProjects: (show: boolean) => void;
  autoOpenProjectModal?: boolean;
  setAutoOpenProjectModal?: (val: boolean) => void;
  assets?: Asset[];
}

export function CanvasProjectPage({ 
  conversations, 
  setCurrentConvId, 
  createNewProject,
  updateProject,
  deleteProject,
  setShowCanvasProjects,
  autoOpenProjectModal,
  setAutoOpenProjectModal,
  assets = []
}: CanvasProjectPageProps) {
  const [activeTab, setActiveTab] = useState<'personal' | 'team' | 'demo'>('personal');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<any>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('新的星幕');
  const [newDesc, setNewDesc] = useState('新的星幕画布');
  const [newCover, setNewCover] = useState<string | null>(null);
  const [showAssets, setShowAssets] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (autoOpenProjectModal) {
      handleOpenModal();
      setAutoOpenProjectModal?.(false);
    }
  }, [autoOpenProjectModal]);

  const allProjects = Object.values(conversations).filter(c => c.func === 'canvasDrama').sort((a: any, b: any) => b.created - a.created);
  
  const personalProjects = allProjects.filter(p => !p.isTeam && !p.isDemo);
  const teamProjects = allProjects.filter(p => p.isTeam);
  const demoProjects = [
    { title: '默认星空', description: '功能完整的星空默认画布模板', isDemo: true, id: 'demo1' },
    { title: '互动剧展示', description: '多分支互动剧视频流模板', isDemo: true, id: 'demo2' }
  ];

  const handleSave = () => {
    if (editingProjectId) {
      updateProject(editingProjectId, { title: newTitle, description: newDesc, cover: newCover || undefined });
    } else {
      createNewProject(newTitle || '新的星幕', newDesc, newCover || undefined);
    }
    setShowModal(false);
    if (!editingProjectId) {
      setShowCanvasProjects(false);
    }
  };

  const handleOpenModal = (proj?: any) => {
    if (proj) {
      setEditingProjectId(proj.id);
      setNewTitle(proj.title);
      setNewDesc(proj.description || '');
      setNewCover(proj.cover || null);
    } else {
      setEditingProjectId(null);
      setNewTitle('新的星幕');
      setNewDesc('新的星幕画布');
      setNewCover(null);
    }
    setShowModal(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setNewCover(evt.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelect = (proj: any) => {
    if (proj.isDemo && proj.id.startsWith('demo')) {
      createNewProject(proj.title, proj.description);
    } else {
      setCurrentConvId(proj.id);
    }
    setShowCanvasProjects(false);
  };

  const renderProjects = (projects: any[]) => {
    const filtered = projects.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
    
    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
          <Folder className="w-12 h-12 mb-4 opacity-20" />
          <p>没有找到相关项目</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mt-4">
        {activeTab === 'personal' && !searchQuery && (
          <div 
            onClick={() => handleOpenModal()}
            className="aspect-[4/3] rounded-2xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-neutral-500 hover:text-blue-500 hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
              <Plus className="w-6 h-6" />
            </div>
            <span className="font-semibold text-sm">新建画布</span>
          </div>
        )}
        
        {filtered.map(proj => {
          const firstImage = proj.history?.find((h: any) => h.type === 'image')?.url;
          const bgImage = proj.cover || firstImage;
          
          return (
            <div 
              key={proj.id}
              className="aspect-[4/3] rounded-2xl bg-neutral-100 border border-neutral-200 flex flex-col cursor-pointer hover:shadow-xl transition-all group relative overflow-hidden"
              onClick={() => handleSelect(proj)}
            >
              {/* Card Cover (Full Bleed) */}
              <div className="absolute inset-0 z-0">
                {bgImage ? (
                  <img src={bgImage} alt="cover" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 text-neutral-400">
                    <Network className="w-12 h-12 opacity-20" />
                  </div>
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
              </div>

              {/* Action Buttons */}
              <div className="absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                {!proj.isDemo && (
                  <>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setProjectToDelete(proj);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-9 h-9 bg-red-500/20 hover:bg-red-500 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors group/trash"
                      title="删除项目"
                    >
                      <Trash2 className="w-4 h-4 cursor-pointer" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenModal(proj);
                      }}
                      className="w-9 h-9 bg-white/20 hover:bg-white/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors"
                      title="编辑项目"
                    >
                      <Settings className="w-4 h-4 cursor-pointer" />
                    </button>
                  </>
                )}
                <div className="w-9 h-9 bg-blue-500 hover:bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg transition-colors">
                  <Play className="w-4 h-4 ml-0.5" />
                </div>
              </div>

              {/* Content Overlay */}
              <div className="mt-auto p-5 relative z-10">
                <h3 className="font-bold text-white truncate tracking-wide text-[16px] drop-shadow-md">{proj.title}</h3>
                {proj.description && <p className="text-white/70 text-[11px] mt-1 line-clamp-1 drop-shadow-sm">{proj.description}</p>}
                <div className="text-[10px] text-white/50 mt-2 font-medium">
                  {proj.created ? new Date(proj.created).toLocaleString() : '系统模板'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 w-full h-full bg-[#f8f9fa] overflow-y-auto overflow-x-hidden flex flex-col items-center">
      <div className="w-full max-w-6xl px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neutral-900 to-neutral-600 tracking-tight flex items-center gap-3">
              <Network className="w-8 h-8 text-neutral-800" />
              星幕画布项目
            </h1>
            <p className="text-neutral-500 mt-2 text-sm">管理和创作您的全能AI剧本与画面工作流</p>
          </div>
          
          <div className="relative w-64 hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input 
              type="text"
              placeholder="搜索项目..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8 bg-white p-1.5 rounded-full border border-neutral-200/60 w-max shadow-sm">
          <button
            onClick={() => setActiveTab('personal')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2",
              activeTab === 'personal' ? "bg-neutral-900 text-white shadow-md" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            <Folder className="w-4 h-4" /> 个人项目
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2",
              activeTab === 'team' ? "bg-neutral-900 text-white shadow-md" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            <Users className="w-4 h-4" /> 团队项目
          </button>
          <button
            onClick={() => setActiveTab('demo')}
            className={cn(
              "px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2",
              activeTab === 'demo' ? "bg-neutral-900 text-white shadow-md" : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            <Play className="w-4 h-4" /> 演示作品
          </button>
        </div>

        {activeTab === 'personal' && renderProjects(personalProjects)}
        {activeTab === 'team' && renderProjects(teamProjects)}
        {activeTab === 'demo' && renderProjects(demoProjects)}
        
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col shadow-2xl relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
              <h2 className="text-xl font-bold">{editingProjectId ? '编辑项目' : '新建项目'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">项目名称</label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="例如：新的星幕"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">项目简介</label>
                <textarea 
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                  placeholder="项目简要描述..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1.5">项目封面</label>
                {!newCover ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setShowAssets(true)}
                      className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-blue-400 transition-colors text-neutral-600"
                    >
                      <ImageIcon className="w-6 h-6" />
                      <span className="text-xs font-medium">从资产库找图</span>
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-4 border border-dashed border-neutral-300 rounded-xl hover:bg-neutral-50 hover:border-blue-400 transition-colors text-neutral-600"
                    >
                      <Upload className="w-6 h-6" />
                      <span className="text-xs font-medium">本地上传</span>
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
                    <img src={newCover} alt="Cover Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                      <button 
                        onClick={() => setShowAssets(true)}
                        className="px-3 py-1.5 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-white text-xs font-medium transition-colors"
                      >
                        更换
                      </button>
                      <button 
                        onClick={() => setNewCover(null)}
                        className="px-3 py-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-colors"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                )}
                {showAssets && (
                   <div className="mt-4 border border-neutral-200 rounded-xl p-3 bg-neutral-50 max-h-60 overflow-y-auto">
                     <div className="flex items-center justify-between mb-2">
                       <span className="text-xs font-medium text-neutral-500">选择资产</span>
                       <button onClick={() => setShowAssets(false)} className="text-neutral-400 hover:text-neutral-700"><X className="w-4 h-4"/></button>
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                       {assets.filter(a => a.type === 'image').map(asset => (
                         <div 
                           key={asset.id} 
                           onClick={() => { setNewCover(asset.url); setShowAssets(false); }}
                           className="aspect-square rounded border border-neutral-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500"
                         >
                           <img src={asset.url} className="w-full h-full object-cover" />
                         </div>
                       ))}
                       {assets.filter(a => a.type === 'image').length === 0 && (
                         <div className="col-span-3 text-center py-4 text-xs text-neutral-400">资产库没有图片</div>
                       )}
                     </div>
                   </div>
                )}
                <p className="text-[11px] text-neutral-400 mt-2">
                  如果不上传封面，将默认使用画布内生成的第一张图片作为封面。
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={() => setShowModal(false)}
                className="px-6 py-2.5 rounded-xl font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
              >
                {editingProjectId ? '保存修改' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center text-red-500 mb-4">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">确认删除该项目？</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                项目 <span className="font-semibold text-neutral-900">"{projectToDelete?.title}"</span> 将被永久删除。请注意，删除后将无法恢复。
              </p>
            </div>
            
            <div className="p-4 bg-neutral-50 flex gap-3">
              <button 
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setProjectToDelete(null);
                }}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium text-neutral-600 hover:bg-neutral-200 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  if (projectToDelete) {
                    deleteProject(projectToDelete.id);
                    setShowDeleteConfirm(false);
                    setProjectToDelete(null);
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-xl font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
