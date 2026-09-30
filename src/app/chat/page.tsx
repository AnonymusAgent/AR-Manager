'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Send, Plus, Paperclip, Users, MessageSquare, Hash, FileText, Download, Image, File as FileIcon } from 'lucide-react';

interface Channel { id:string; name:string|null; channelType:string; department:string|null; displayName:string; members:{userId:string;name:string}[]; lastMessage:{content:string;createdAt:string}|null; unreadCount:number; }
interface Message { id:string; content:string; messageType:string; fileName:string|null; fileMimeType:string|null; relatedClaimId:string|null; senderId:string; senderName:string; createdAt:string; claimInfo:{claimNumber:string;patientName:string|null;status:string}|null; hasFile?:boolean; }
interface UserOption { id:string; firstName:string; lastName:string; role:string; }

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return FileIcon;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.includes('pdf')) return FileText;
  return FileIcon;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel|null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [newChatUser, setNewChatUser] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupMembers, setNewGroupMembers] = useState<string[]>([]);
  const [chatType, setChatType] = useState<'direct'|'group'>('direct');
  const [currentUserId, setCurrentUserId] = useState('');
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const prevMsgCountRef = useRef(0);
  const sseRef = useRef<EventSource|null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/channels');
      const data = await res.json();
      if (res.ok) setChannels(data.channels);
    } catch(e) { console.error(e); }
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await fetch(`/api/chat/channels/${channelId}/messages`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages);
        // Play notification sound for new messages
        if (data.messages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
          const lastMsg = data.messages[data.messages.length - 1];
          if (lastMsg && lastMsg.senderId !== currentUserId) {
            // Browser notification
            if (Notification.permission === 'granted') {
              new Notification(`${lastMsg.senderName}`, {
                body: lastMsg.messageType === 'file' ? `📎 Shared a file: ${lastMsg.fileName}` : lastMsg.content,
                icon: '/favicon.ico',
              });
            }
          }
        }
        prevMsgCountRef.current = data.messages.length;
      }
    } catch(e) { console.error(e); }
  }, [currentUserId]);

  useEffect(() => {
    fetchChannels();
    fetch('/api/auth/me').then(r=>r.json()).then(d=>setCurrentUserId(d.user?.id||'')).catch(console.error);
    fetch('/api/users?isActive=true').then(r=>r.json()).then(d=>setUsers(d.users||[])).catch(console.error);
    // Request notification permission
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [fetchChannels]);

  useEffect(() => {
    if (activeChannel) {
      prevMsgCountRef.current = 0;
      fetchMessages(activeChannel.id);

      // Close previous SSE connection
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

      // Open SSE stream for real-time messages
      const sse = new EventSource(`/api/chat/stream/${activeChannel.id}`);
      sseRef.current = sse;

      sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'messages' && payload.messages?.length > 0) {
            setMessages(prev => {
              const existingIds = new Set(prev.map(m => m.id));
              const newMsgs = payload.messages.filter((m: Message) => !existingIds.has(m.id));
              if (newMsgs.length > 0) {
                // Browser notification for messages from others
                for (const msg of newMsgs) {
                  if (msg.senderId !== currentUserId && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                    new Notification(msg.senderName, {
                      body: msg.messageType === 'file' ? `📎 ${msg.fileName}` : msg.content,
                      icon: '/favicon.ico',
                    });
                  }
                }
                return [...prev, ...newMsgs];
              }
              return prev;
            });
          }
        } catch {}
      };

      sse.onerror = () => {
        // SSE failed — fall back to polling
        sse.close();
        sseRef.current = null;
        if (!pollRef.current) {
          pollRef.current = setInterval(() => { fetchMessages(activeChannel.id); fetchChannels(); }, 3000);
        }
      };

      // Refresh channel list periodically for unread counts
      pollRef.current = setInterval(() => { fetchChannels(); }, 8000);
    }

    return () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeChannel, fetchMessages, fetchChannels, currentUserId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const totalUnread = channels.reduce((sum, ch) => sum + ch.unreadCount, 0);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChannel) return; setSending(true);
    try {
      const res = await fetch(`/api/chat/channels/${activeChannel.id}/messages`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content:newMessage}) });
      if (res.ok) { const data = await res.json(); setMessages(prev=>[...prev,data.message]); setNewMessage(''); prevMsgCountRef.current++; }
    } catch(e) { console.error(e); }
    finally { setSending(false); }
  };

  const handleFileUpload = async (file: File) => {
    if (!activeChannel) return;
    setUploading(true);
    const fd = new FormData(); fd.append('file', file); fd.append('content', `📎 ${file.name}`);
    try {
      const res = await fetch(`/api/chat/channels/${activeChannel.id}/messages`, { method:'POST', body:fd });
      if (res.ok) { const data = await res.json(); setMessages(prev=>[...prev,data.message]); prevMsgCountRef.current++; }
    } catch(e) { console.error(e); }
    finally { setUploading(false); }
  };

  const handleDownload = (messageId: string, fileName: string | null) => {
    const link = document.createElement('a');
    link.href = `/api/chat/files/${messageId}`;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateChannel = async () => {
    try {
      const body: Record<string, unknown> = { channelType: chatType };
      if (chatType === 'direct') { body.memberIds = [newChatUser]; }
      else { body.name = newGroupName; body.memberIds = newGroupMembers; body.channelType = 'group'; }
      const res = await fetch('/api/chat/channels', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        setShowNewChat(false); setNewChatUser(''); setNewGroupName(''); setNewGroupMembers([]);
        await fetchChannels();
        // Find the channel with full details
        const chRes = await fetch('/api/chat/channels');
        const chData = await chRes.json();
        const fullChannel = chData.channels?.find((c: Channel) => c.id === data.channel.id);
        setActiveChannel(fullChannel || data.channel);
      }
    } catch(e) { console.error(e); }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <AppLayout title="Team Chat">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" style={{height:'calc(100vh - 180px)'}}>
        <div className="flex h-full">
          {/* Channel Sidebar */}
          <div className="w-80 border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">Messages</h3>
                  {totalUnread > 0 && <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">{totalUnread}</span>}
                </div>
                <Button size="sm" onClick={()=>setShowNewChat(true)}><Plus className="w-4 h-4"/></Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {channels.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 text-slate-300"/>
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs text-slate-400 mt-1">Start a new chat!</p>
                </div>
              ) : channels.map(ch => (
                <button key={ch.id} onClick={()=>setActiveChannel(ch)}
                  className={`w-full p-3 text-left border-b border-slate-100 hover:bg-slate-50 transition-colors ${activeChannel?.id===ch.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {ch.channelType==='group' ? (
                        <div className="w-9 h-9 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center flex-shrink-0"><Hash className="w-4 h-4"/></div>
                      ) : (
                        <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">{ch.displayName?.[0]?.toUpperCase()||'?'}</div>
                      )}
                      <div className="min-w-0">
                        <p className={`text-sm truncate ${ch.unreadCount > 0 ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{ch.displayName||'Chat'}</p>
                        {ch.lastMessage && <p className={`text-xs truncate ${ch.unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>{ch.lastMessage.content}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {ch.lastMessage && <p className="text-xs text-slate-400">{new Date(ch.lastMessage.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</p>}
                      {ch.unreadCount > 0 && <span className="w-5 h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">{ch.unreadCount > 9 ? '9+' : ch.unreadCount}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Area */}
          <div className="flex-1 flex flex-col">
            {!activeChannel ? (
              <div className="flex-1 flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 text-slate-300"/>
                  <p className="text-lg font-medium">Select a conversation</p>
                  <p className="text-sm mt-1">or start a new one</p>
                </div>
              </div>
            ) : (<>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 bg-white">
                <div className="flex items-center gap-3">
                  {activeChannel.channelType==='group' ? (
                    <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center"><Hash className="w-5 h-5"/></div>
                  ) : (
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">{activeChannel.displayName?.[0]?.toUpperCase()||'?'}</div>
                  )}
                  <div>
                    <h3 className="font-semibold text-slate-900">{activeChannel.displayName||'Chat'}</h3>
                    <p className="text-xs text-slate-500">
                      {activeChannel.channelType==='group'
                        ? `${activeChannel.members.length} members • ${activeChannel.members.map(m=>m.name).join(', ')}`
                        : 'Direct message'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">No messages yet. Say hello! 👋</p>
                  </div>
                )}
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === currentUserId;
                  const showAvatar = idx === 0 || messages[idx - 1]?.senderId !== msg.senderId;
                  const Icon = getFileIcon(msg.fileMimeType);

                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${!showAvatar ? (isMe ? 'pr-11' : 'pl-11') : ''}`}>
                      {/* Avatar */}
                      {!isMe && showAvatar && (
                        <div className="w-8 h-8 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-xs font-medium mr-2 mt-1 flex-shrink-0">
                          {msg.senderName.split(' ').map(n=>n[0]).join('')}
                        </div>
                      )}

                      <div className={`max-w-[65%]`}>
                        {/* Sender name */}
                        {!isMe && showAvatar && (
                          <p className="text-xs font-medium text-slate-500 mb-1 ml-1">{msg.senderName}</p>
                        )}

                        <div className={`${isMe ? 'bg-blue-600 text-white' : 'bg-white text-slate-900 shadow-sm border border-slate-200'} rounded-2xl px-4 py-2.5`}>
                          {/* File message */}
                          {msg.messageType === 'file' && msg.fileName ? (
                            <div>
                              <div className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-blue-700/50' : 'bg-slate-50'}`}>
                                <div className={`p-2 rounded-lg ${isMe ? 'bg-blue-500' : 'bg-blue-100'}`}>
                                  <Icon className={`w-5 h-5 ${isMe ? 'text-white' : 'text-blue-600'}`}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-medium truncate ${isMe ? 'text-white' : 'text-slate-900'}`}>{msg.fileName}</p>
                                  <p className={`text-xs ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{msg.fileMimeType?.split('/')[1]?.toUpperCase() || 'FILE'}</p>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownload(msg.id, msg.fileName); }}
                                  className={`p-2 rounded-lg transition-colors ${isMe ? 'hover:bg-blue-500 text-white' : 'hover:bg-slate-200 text-slate-600'}`}
                                  title="Download file"
                                >
                                  <Download className="w-5 h-5"/>
                                </button>
                              </div>
                            </div>
                          ) : msg.messageType === 'claim' && msg.claimInfo ? (
                            /* Claim share */
                            <div className={`p-3 rounded-xl ${isMe ? 'bg-blue-700/50' : 'bg-blue-50 border border-blue-200'}`}>
                              <p className={`text-xs font-medium ${isMe ? 'text-blue-200' : 'text-blue-600'}`}>📋 Shared Claim</p>
                              <p className={`font-semibold text-sm mt-1 ${isMe ? 'text-white' : 'text-slate-900'}`}>{msg.claimInfo.claimNumber}</p>
                              {msg.claimInfo.patientName && <p className={`text-xs mt-0.5 ${isMe ? 'text-blue-200' : 'text-slate-500'}`}>{msg.claimInfo.patientName}</p>}
                            </div>
                          ) : (
                            /* Text message */
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          )}

                          {/* Timestamp */}
                          <p className={`text-xs mt-1.5 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                          </p>
                        </div>
                      </div>

                      {/* Sender avatar (right side) */}
                      {isMe && showAvatar && (
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium ml-2 mt-1 flex-shrink-0">
                          {msg.senderName.split(' ').map(n=>n[0]).join('')}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef}/>
              </div>

              {/* Uploading indicator */}
              {uploading && (
                <div className="px-4 py-2 bg-blue-50 border-t border-blue-100">
                  <div className="flex items-center gap-2 text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                    <span className="text-sm">Uploading file...</span>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t border-slate-200 bg-white">
                <div className="flex gap-2 items-end">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={e=>{if(e.target.files?.[0])handleFileUpload(e.target.files[0]); e.target.value='';}}/>
                  <button
                    onClick={()=>fileInputRef.current?.click()}
                    className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Attach file"
                  >
                    <Paperclip className="w-5 h-5"/>
                  </button>
                  <input
                    type="text" value={newMessage}
                    onChange={e=>setNewMessage(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();}}}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <Button onClick={handleSend} disabled={!newMessage.trim()} loading={sending} className="rounded-xl">
                    <Send className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
            </>)}
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      <Modal isOpen={showNewChat} onClose={()=>setShowNewChat(false)} title="New Conversation">
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={()=>setChatType('direct')} className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${chatType==='direct'?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
              <MessageSquare className="w-5 h-5 mx-auto mb-1"/><span className="text-sm font-medium">Direct Message</span>
            </button>
            <button onClick={()=>setChatType('group')} className={`flex-1 p-3 rounded-lg border-2 text-center transition-colors ${chatType==='group'?'border-blue-500 bg-blue-50':'border-slate-200 hover:border-slate-300'}`}>
              <Users className="w-5 h-5 mx-auto mb-1"/><span className="text-sm font-medium">Group Chat</span>
            </button>
          </div>
          {chatType === 'direct' ? (
            <Select label="Select User" value={newChatUser} onChange={e=>setNewChatUser(e.target.value)}
              options={[{value:'',label:'Choose a team member...'}, ...users.filter(u=>u.id!==currentUserId).map(u=>({value:u.id,label:`${u.firstName} ${u.lastName} (${u.role.replace(/_/g,' ')})`}))]}/>
          ) : (<>
            <Input label="Group Name" value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="e.g. Coding Team, Billing Dept"/>
            <div><label className="block text-sm font-medium text-slate-700 mb-2">Select Members</label>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">{users.filter(u=>u.id!==currentUserId).map(u=>(
                <label key={u.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                  <input type="checkbox" checked={newGroupMembers.includes(u.id)} onChange={e=>{ if(e.target.checked) setNewGroupMembers(prev=>[...prev,u.id]); else setNewGroupMembers(prev=>prev.filter(id=>id!==u.id)); }} className="rounded border-slate-300 text-blue-600"/>
                  <span className="text-sm flex-1">{u.firstName} {u.lastName}</span><Badge variant="default" size="sm">{u.role.replace(/_/g,' ')}</Badge>
                </label>
              ))}</div>
              {newGroupMembers.length > 0 && <p className="text-xs text-slate-500 mt-1">{newGroupMembers.length} member(s) selected</p>}
            </div>
          </>)}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={()=>setShowNewChat(false)}>Cancel</Button>
            <Button onClick={handleCreateChannel} disabled={chatType==='direct'?!newChatUser:(!newGroupName||newGroupMembers.length===0)}>Start Chat</Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
