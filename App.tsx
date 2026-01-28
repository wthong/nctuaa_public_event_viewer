import React, { useState, useEffect } from 'react';
import { getEvents, syncEventsFromSheet } from './services/storageService';
import { AlumniEvent } from './types';
import { ArrowRight, Loader2, CalendarCheck, RefreshCw, MapPin, Clock, Calendar, Info } from 'lucide-react';

const App: React.FC = () => {
  const [events, setEvents] = useState<AlumniEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [logoError, setLogoError] = useState(false);

  // Fallback Logo (SVG Data URI) - 在 /logo.png 讀取失敗時顯示
  const fallbackLogo = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='50' fill='white'/%3E%3Ccircle cx='50' cy='50' r='46' fill='none' stroke='%23B38F00' stroke-width='2'/%3E%3Ctext x='50' y='70' font-family='sans-serif' font-weight='bold' font-size='50' fill='%23003366' text-anchor='middle'%3E%E4%BA%A4%E5%A4%A7%3C/text%3E%3C/svg%3E`;

  // Fetch and Sync events
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        // Soft sync on load: checks if < 10 mins ago, if so, uses cache
        await syncEventsFromSheet(false); 
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setEvents(getEvents());
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Force sync on button click: ignores 10 min cache
      await syncEventsFromSheet(true);
      setEvents(getEvents());
    } catch (e) {
      console.error("Refresh error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format date with weekday
  const formatDateWithWeekday = (dateStr: string) => {
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return dateStr;
    const weekday = dateObj.toLocaleDateString('zh-TW', { weekday: 'short' });
    return (
      <span>
        {dateStr} <span className="text-gray-400 text-sm ml-1">({weekday})</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="bg-primary text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
               {/* 
                 Logo 邏輯：
                 1. 優先嘗試顯示 '/logo.png'
                 2. 如果 onError 觸發 (找不到檔案)，則切換顯示 fallbackLogo (SVG)
               */}
               <img 
                 src={logoError ? fallbackLogo : "/logo.png"}
                 onError={() => setLogoError(true)}
                 alt="交通大學台北校友會 Logo" 
                 className="h-10 w-10 mr-3 bg-white rounded-full p-0.5 shadow-sm object-contain"
               />
               <span className="text-xl font-bold tracking-tight"><a href="https://taipei.nctuaa.org/">台北校友會</a></span>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            
            {/* Hero Section */}
            <div className="text-center mb-10 space-y-4">
              <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl tracking-tight">
                近期活動 <span className="text-secondary hover:text-yellow-600 transition-colors"><a href="https://calendar.google.com/calendar/embed?src=4d2df36446bbb6be7a4ab1a774e82f2c963325f325743b716fb9429ba39c2961%40group.calendar.google.com&ctz=Asia%2FTaipei" target="_blank" className="underline decoration-2 decoration-secondary/50 hover:decoration-secondary">一覽表</a></span>
              </h1>
              
              <div className="flex justify-center pt-2">
                <button
                  onClick={handleRefresh}
                  disabled={isLoading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? '同步中...' : '強制更新'}
                </button>
              </div>
            </div>

            {/* Event Content */}
            {isLoading && events.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20">
                 <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                 <p className="text-gray-500">正在同步日曆資料...</p>
               </div>
            ) : (
              <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
                
                {/* --- Desktop View: Table (Hidden on Mobile) --- */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-left">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-[160px]">
                          <div className="flex items-center"><Calendar className="w-4 h-4 mr-1.5"/> 日期</div>
                        </th>
                        <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-[140px]">
                          <div className="flex items-center"><Clock className="w-4 h-4 mr-1.5"/> 時間</div>
                        </th>
                        <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">
                          活動主題
                        </th>
                        <th scope="col" className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-[140px]">
                          <div className="flex items-center"><MapPin className="w-4 h-4 mr-1.5"/> 地點</div>
                        </th>
                        <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap w-[140px]">
                          報名
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((event) => {
                         const hasLink = event.registerLink && event.registerLink !== '#' && event.registerLink.startsWith('http');
                         return (
                          <tr key={event.id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-primary">
                              {formatDateWithWeekday(event.date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                              {event.time}
                            </td>
                            
                            {/* Title with Hover Tooltip */}
                            <td className="px-6 py-4 relative group">
                              <div className="inline-flex items-center">
                                <span className="text-sm font-bold text-gray-900 border-b border-dotted border-gray-400 cursor-help group-hover:text-primary transition-colors">
                                  {event.title}
                                </span>
                              </div>
                              
                              {/* Tooltip Content */}
                              {event.description && (
                                <div className="absolute left-6 top-3/4 z-50 w-80 p-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 pointer-events-none">
                                  <div className="flex items-center text-secondary mb-2 border-b border-gray-100 pb-1">
                                    <Info className="w-3 h-3 mr-1.5" />
                                    <span className="text-xs font-bold uppercase">活動詳情</span>
                                  </div>
                                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">
                                    {event.description}
                                  </p>
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 truncate max-w-[120px]" title={event.location}>
                                {event.location}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                              {hasLink ? (
                                <a 
                                  href={event.registerLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-full text-white bg-secondary hover:bg-yellow-600 transition-colors shadow-sm w-full"
                                >
                                  立即報名
                                </a>
                              ) : (
                                <span className="text-gray-300 text-xs">暫無連結</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* --- Mobile View: List (Visible only on Mobile) --- */}
                <div className="md:hidden divide-y divide-gray-200">
                   {events.map((event) => {
                     const hasLink = event.registerLink && event.registerLink !== '#' && event.registerLink.startsWith('http');
                     return (
                       <div key={event.id} className="p-5 flex flex-col gap-3 hover:bg-gray-50 transition-colors">
                         {/* Header: Date & Time */}
                         <div className="flex justify-between items-center">
                            <div className="flex items-center text-primary font-semibold text-sm bg-blue-50 px-2 py-1 rounded">
                              <Calendar className="w-3.5 h-3.5 mr-1.5" />
                              {formatDateWithWeekday(event.date)}
                            </div>
                            <div className="flex items-center text-gray-500 text-xs font-medium">
                              <Clock className="w-3.5 h-3.5 mr-1" />
                              {event.time}
                            </div>
                         </div>

                         {/* Body: Title */}
                         <div>
                           <h3 className="text-lg font-bold text-gray-900 leading-snug">{event.title}</h3>
                           {event.description && (
                             <p className="text-sm text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                               {event.description.replace(/\n/g, ' ')}
                             </p>
                           )}
                         </div>

                         {/* Footer: Location & Action */}
                         <div className="flex items-end justify-between pt-2 border-t border-gray-100 mt-1">
                           <div className="flex items-center text-sm text-gray-600 flex-1 min-w-0 mr-4">
                             <MapPin className="w-4 h-4 mr-1.5 flex-shrink-0 text-secondary" />
                             <span className="truncate">{event.location}</span>
                           </div>
                           
                           <div className="flex-shrink-0">
                             {hasLink ? (
                               <a 
                                  href={event.registerLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-xs font-bold rounded-full text-white bg-secondary hover:bg-yellow-600 transition-colors shadow-sm"
                                >
                                  立即報名 <ArrowRight className="w-3 h-3 ml-1" />
                                </a>
                             ) : (
                               <span className="text-xs text-gray-300 font-medium py-2 inline-block">無報名連結</span>
                             )}
                           </div>
                         </div>
                       </div>
                     );
                   })}
                </div>

              </div>
            )}

            {!isLoading && events.length === 0 && (
               <div className="text-center py-24 bg-white rounded-xl shadow-sm border border-gray-100 mt-6">
                 <CalendarCheck className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                 <h3 className="text-lg font-medium text-gray-900">目前暫無活動</h3>
                 <p className="text-gray-400 mt-2">請稍後再回來查看最新的活動安排。</p>
               </div>
            )}
          </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-400 text-sm">&copy; {new Date().getFullYear()} 交通大學台北校友會. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0 text-sm text-gray-500">
            <a href="#" className="hover:text-primary">聯絡我們</a>
            <a href="#" className="hover:text-primary">隱私權政策</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;