import React from 'react';
import { Calendar, MapPin, Clock, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { AlumniEvent } from '../types';

interface EventCardProps {
  event: AlumniEvent;
}

export const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const dateObj = new Date(event.date);
  const isValidDate = !isNaN(dateObj.getTime());
  
  const year = isValidDate ? dateObj.getFullYear() : '';
  const month = isValidDate ? (dateObj.getMonth() + 1) : '';
  const day = isValidDate ? dateObj.getDate() : '';
  const weekday = isValidDate ? dateObj.toLocaleDateString('zh-TW', { weekday: 'long' }) : '';

  const hasLink = event.registerLink && event.registerLink !== '#' && event.registerLink.startsWith('http');

  // Simple formatting for description to handle newlines
  const formattedDesc = event.description.split('\n').map((str, index) => (
    <span key={index}>
      {str}
      <br />
    </span>
  ));

  return (
    <div className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300 group h-full">
      
      {/* Top Banner Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-primary to-blue-400 rounded-t-xl"></div>

      <div className="p-6 flex flex-col flex-grow">
        
        {/* Header: Date Badge & Title */}
        <div className="flex gap-4 mb-4">
            <div className="flex-shrink-0 flex flex-col items-center justify-center bg-gray-50 border border-gray-200 rounded-lg w-16 h-16 shadow-inner">
                <span className="text-xs font-bold text-gray-500">{month}月</span>
                <span className="text-2xl font-extrabold text-primary leading-none">{day}</span>
                <span className="text-[10px] text-gray-400 mt-1">{weekday}</span>
            </div>
            
            <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-secondary mb-1">{year} 年度活動</div>
                <h3 className="text-lg font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {event.title}
                </h3>
            </div>
        </div>

        {/* Info Rows */}
        <div className="space-y-2 mb-4 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
            <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-2 text-primary flex-shrink-0" />
                <span className="font-medium">{event.time}</span>
            </div>
            <div className="flex items-start text-sm text-gray-600">
                <MapPin className="w-4 h-4 mr-2 text-primary flex-shrink-0 mt-0.5" />
                <span className="line-clamp-1 font-medium">{event.location}</span>
            </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mb-4 w-full"></div>

        {/* Description */}
        <div className="flex-grow mb-6 relative">
             <div className="text-gray-600 text-sm leading-relaxed line-clamp-4 break-words">
                {event.description ? formattedDesc : "暫無詳細說明"}
             </div>
        </div>

        {/* Action Button */}
        <div className="mt-auto">
             {hasLink ? (
                 <a 
                    href={event.registerLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full bg-primary text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-blue-800 transition-colors shadow-sm group-hover:shadow-md"
                 >
                    前往報名/詳情 <ArrowRight className="w-4 h-4 ml-2" />
                 </a>
             ) : (
                 <div className="flex items-center justify-center w-full bg-gray-100 text-gray-400 text-sm font-semibold py-2.5 rounded-lg cursor-default">
                    <span className="flex items-center">
                       無報名連結
                    </span>
                 </div>
             )}
        </div>
      </div>
    </div>
  );
};