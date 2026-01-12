import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, LogOut, Users, Calendar, Sparkles } from 'lucide-react';
import { AlumniEvent, AdminUser, User } from '../types';
import { getEvents, saveEvent, deleteEvent, getAdmins, addAdmin, removeAdmin } from '../services/storageService';
import { generateEventDescription } from '../services/geminiService';
import { Button } from './Button';
import { ROOT_ADMIN_EMAIL } from '../constants';

interface AdminPanelProps {
  user: User;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'events' | 'admins'>('events');
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  
  // Event Form State
  const [isEditing, setIsEditing] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Partial<AlumniEvent>>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Admin Management State
  const [newAdminEmail, setNewAdminEmail] = useState('');

  useEffect(() => {
    setEvents(getEvents());
    setAdmins(getAdmins());
  }, []);

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent.title || !currentEvent.date) return;

    const eventToSave: AlumniEvent = {
      id: currentEvent.id || `evt_${Date.now()}`,
      title: currentEvent.title || '',
      posterUrl: '', // 海報欄位留空，因已移除功能
      description: currentEvent.description || '',
      date: currentEvent.date || '',
      time: currentEvent.time || '',
      location: currentEvent.location || '',
      registerLink: currentEvent.registerLink || '#',
      createdAt: currentEvent.createdAt || Date.now(),
    };

    const updatedEvents = saveEvent(eventToSave);
    setEvents(updatedEvents);
    setShowEventModal(false);
    setCurrentEvent({});
    setIsEditing(false);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm('確定要刪除此活動嗎？')) {
      const updated = deleteEvent(id);
      setEvents(updated);
    }
  };

  const handleEditClick = (event: AlumniEvent) => {
    setCurrentEvent(event);
    setIsEditing(true);
    setShowEventModal(true);
  };

  const handleAddAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail) return;
    const updated = addAdmin(newAdminEmail, user.email);
    setAdmins(updated);
    setNewAdminEmail('');
  };

  const handleRemoveAdmin = (email: string) => {
    if (email === ROOT_ADMIN_EMAIL) return;
    if (confirm(`確定要移除 ${email} 的管理員權限嗎？`)) {
      try {
        const updated = removeAdmin(email);
        setAdmins(updated);
      } catch (e) {
        alert((e as Error).message);
      }
    }
  };

  const handleGenerateDescription = async () => {
    if (!currentEvent.title || !currentEvent.location || !currentEvent.date) {
      alert("請先填寫活動名稱、地點和日期。");
      return;
    }
    setIsGeneratingAI(true);
    const desc = await generateEventDescription(currentEvent.title, currentEvent.location, currentEvent.date);
    setCurrentEvent(prev => ({ ...prev, description: desc }));
    setIsGeneratingAI(false);
  };

  // 統一輸入框樣式：淺色背景，深色文字，清晰邊框
  const inputClass = "mt-1 block w-full rounded-md border border-gray-300 bg-white text-gray-900 p-2.5 shadow-sm focus:border-primary focus:ring-primary focus:bg-white transition-colors placeholder-gray-400";

  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">後台管理系統</h1>
            <p className="text-gray-500">歡迎, {user.email}</p>
          </div>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut className="w-4 h-4 mr-2" /> 登出
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'events' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center"><Calendar className="w-4 h-4 mr-2"/> 活動管理</div>
          </button>
          <button
            onClick={() => setActiveTab('admins')}
            className={`py-2 px-4 font-medium border-b-2 transition-colors ${activeTab === 'admins' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <div className="flex items-center"><Users className="w-4 h-4 mr-2"/> 管理員設定</div>
          </button>
        </div>

        {/* Events Content */}
        {activeTab === 'events' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button onClick={() => { setCurrentEvent({}); setIsEditing(false); setShowEventModal(true); }}>
                <Plus className="w-4 h-4 mr-2" /> 新增活動
              </Button>
            </div>

            <div className="bg-white shadow overflow-hidden rounded-md border border-gray-200">
              <ul className="divide-y divide-gray-200">
                {events.map((event) => (
                  <li key={event.id} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Removed Image Thumbnail */}
                      <div className="flex-shrink-0 bg-primary/10 rounded-full p-3">
                         <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-primary truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">{event.date} 於 {event.location}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => handleEditClick(event)} className="p-2 text-gray-400 hover:text-primary">
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleDeleteEvent(event.id)} className="p-2 text-gray-400 hover:text-red-600">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </li>
                ))}
                {events.length === 0 && <li className="p-8 text-center text-gray-500">尚無活動資料。</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Admins Content */}
        {activeTab === 'admins' && (
          <div>
             <div className="bg-blue-50 p-4 rounded-lg mb-6 border border-blue-100">
                <h3 className="font-semibold text-primary mb-2">新增管理員</h3>
                <form onSubmit={handleAddAdmin} className="flex gap-2">
                  <input 
                    type="email" 
                    required 
                    placeholder="輸入 Gmail 信箱" 
                    className="flex-1 rounded-md border-gray-300 bg-white p-2 focus:ring-primary focus:border-primary outline-none"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                  <Button type="submit">新增</Button>
                </form>
             </div>

             <div className="bg-white shadow overflow-hidden rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">新增者</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">動作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {admins.map((admin) => (
                      <tr key={admin.email}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {admin.email} 
                          {admin.email === ROOT_ADMIN_EMAIL && <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">主要管理員</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{admin.addedBy}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {admin.email !== ROOT_ADMIN_EMAIL && (
                            <button onClick={() => handleRemoveAdmin(admin.email)} className="text-red-600 hover:text-red-900">移除</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

        {/* Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">{isEditing ? '編輯活動' : '新增活動'}</h2>
                <button onClick={() => setShowEventModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
              </div>
              <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">活動名稱</label>
                    <input 
                      type="text" required 
                      className={inputClass}
                      value={currentEvent.title || ''}
                      onChange={e => setCurrentEvent({...currentEvent, title: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">日期</label>
                    <input 
                      type="date" required 
                      className={inputClass}
                      style={{ colorScheme: 'light' }}
                      value={currentEvent.date || ''}
                      onChange={e => setCurrentEvent({...currentEvent, date: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">時間</label>
                    <input 
                      type="time" required 
                      className={inputClass}
                      style={{ colorScheme: 'light' }}
                      value={currentEvent.time || ''}
                      onChange={e => setCurrentEvent({...currentEvent, time: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">地點</label>
                    <input 
                      type="text" required 
                      className={inputClass}
                      value={currentEvent.location || ''}
                      onChange={e => setCurrentEvent({...currentEvent, location: e.target.value})}
                    />
                  </div>
                </div>

                {/* Poster Input Section Removed */}

                <div>
                   <label className="block text-sm font-medium text-gray-700">報名連結 (Google Form 等)</label>
                   <input 
                      type="url" 
                      placeholder="https://..."
                      className={inputClass}
                      value={currentEvent.registerLink || ''}
                      onChange={e => setCurrentEvent({...currentEvent, registerLink: e.target.value})}
                   />
                </div>

                <div>
                   <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-medium text-gray-700">活動說明</label>
                      <button 
                        type="button"
                        onClick={handleGenerateDescription}
                        disabled={isGeneratingAI}
                        className="text-xs flex items-center text-purple-600 hover:text-purple-800 disabled:opacity-50"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        {isGeneratingAI ? '生成中...' : '使用 AI 自動生成說明'}
                      </button>
                   </div>
                   <textarea 
                      rows={4}
                      className={inputClass}
                      value={currentEvent.description || ''}
                      onChange={e => setCurrentEvent({...currentEvent, description: e.target.value})}
                   ></textarea>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-4">
                  <Button type="button" variant="ghost" onClick={() => setShowEventModal(false)}>取消</Button>
                  <Button type="submit">儲存活動</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};