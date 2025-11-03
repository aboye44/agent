import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, X, Sparkles, FileText, Settings, Calculator, CheckCircle2, Database, Mail, Package, Copy, Download, RefreshCw } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const skills = [
    { id: 'quote', name: 'Quote Job', icon: Calculator, color: 'blue' },
    { id: 'workorder', name: 'Work Order', icon: FileText, color: 'green' },
    { id: 'preflight', name: 'Preflight', icon: CheckCircle2, color: 'purple' },
    { id: 'maillist', name: 'Clean Mail List', icon: Database, color: 'orange' },
    { id: 'postage', name: 'Postage Estimate', icon: Mail, color: 'pink' },
    { id: 'vardata', name: 'Variable Data', icon: Package, color: 'teal' },
  ];

  useEffect(() => {
    const saved = localStorage.getItem('chatmpa-history');
    if (saved) {
      setMessages(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chatmpa-history', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!input.trim() && uploadedFiles.length === 0) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      files: uploadedFiles.map(f => ({ name: f.name, type: f.type })),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setUploadedFiles([]);
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

      if (!apiKey) {
        throw new Error('API key not found. Please add VITE_ANTHROPIC_API_KEY to your .env.local file.');
      }

      const client = new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Smart context detection - only use context if refining
      const needsContext = /\b(add|change|update|modify|also|too|and)\b/i.test(currentInput);
      
      const recentMessages = needsContext 
        ? messages.slice(-1).map(msg => ({ role: msg.role, content: msg.content }))
        : [];

      recentMessages.push({
        role: 'user',
        content: currentInput
      });

      const assistantMessageId = Date.now();
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        actions: ['copy', 'export']
      }]);

      // CRITICAL FIX: Inline all pricing data to skip slow file reads
      // This eliminates the 20+ second skill file read delay
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 3072,
        temperature: 0,
        betas: ['code-execution-2025-08-25', 'prompt-caching-2024-07-31'],
        system: [
          {
            type: 'text',
            text: `chatMPA - MPA commercial printing quote engine

EQUIPMENT & RATES:
P-01 Iridesse: $0.0416/click (color, covers)
P-06 Nuvera: $0.0027/click (B&W text)

PAPER STOCKS (common):
100# Gloss Cover: $0.0965/sheet
14pt Kallima C2S: $0.1230/sheet
100# Silk Text: $0.0505/sheet

PRICING TIERS:
1-250: 6.50× (85% margin)
251-500: 5.30× (81%)
501-1K: 4.56× (78%)
1,001-2,500: 3.50× (71%)
2,501-10K: 3.00× (67%)
10,001-15K: 2.20× (55%)
15K+: 1.90× (47%)

SPOILAGE:
1-500: 5% (×1.05)
501-2,500: 3% (×1.03)
2,501+: 2% (×1.02)

MAIL SERVICES (pass-through, no markup):
S-01 NCOA: $0.007/pc
S-02 Inkjet Address: $0.035/pc
S-08 Bulk Mail Prep: $0.017/pc
S-19 EDDM Prep: $0.035/pc
Postage: ALWAYS state "Actual USPS cost" - NEVER estimate

QUOTE WORKFLOW:
1. IMPOSITION (13×19 sheet):
   - Add 0.25" bleed: Live = Finished + 0.25"
   - Orient 1: FLOOR(13÷width) × FLOOR(19÷height)
   - Orient 2: FLOOR(13÷height) × FLOOR(19÷width)
   - Use MAX(orient1, orient2)

2. PRESS SHEETS:
   Sheets = Qty ÷ Up_count × Spoilage

3. COSTS:
   Paper = Sheets × Paper_cost
   Clicks = Sheets × Sides × Click_rate
   Total = Paper + Clicks

4. QUOTE:
   Quote = Total_cost × Multiplier
   
5. VERIFY: Quote = Cost × Multiplier (check math!)

COLOR NOTATION:
4/4 = full color both sides (2 sides, NOT 4!)
4/0 = color one side (1 side)
1/1 = B&W both sides (2 sides)

CRITICAL RULES:
- Show ALL math (imposition, sheets, costs)
- Verify multiplier matches quantity tier
- Mail services = Qty × Rate (no markup!)
- NEVER estimate postage
- Be concise but complete`,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: recentMessages
      });

      let fullResponse = '';
      
      stream.on('text', (text) => {
        fullResponse += text;
        
        setMessages(prev => prev.map(msg => 
          msg.id === assistantMessageId
            ? { ...msg, content: fullResponse }
            : msg
        ));
      });

      await stream.finalMessage();

    } catch (err) {
      console.error('Error:', err);
      const errorMessage = {
        role: 'assistant',
        content: `⚠️ Error: ${err.message || 'Unable to process your request. Please try again.'}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearHistory = () => {
    if (confirm('Clear all conversation history?')) {
      setMessages([]);
      localStorage.removeItem('chatmpa-history');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-950">
      {/* Header */}
      <div className="border-b border-neutral-800/60 bg-neutral-900/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-xl"></div>
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-base font-semibold text-neutral-100 tracking-tight">chatMPA</h1>
              <p className="text-xs text-neutral-500">Production AI Agent • Instant Mode</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={clearHistory}
              className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 rounded-lg transition-all duration-200"
            >
              Clear History
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
        <div className="max-w-5xl mx-auto">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-3xl space-y-8">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-500/10 blur-2xl rounded-2xl"></div>
                  <div className="relative w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-800 border border-neutral-800 flex items-center justify-center shadow-2xl">
                    <Sparkles className="w-9 h-9 text-blue-500" strokeWidth={1.5} />
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h2 className="text-3xl font-bold text-neutral-100 tracking-tight">
                    MPA Production AI Agent
                  </h2>
                  <p className="text-neutral-400 text-base leading-relaxed max-w-2xl mx-auto">
                    Instant quotes with accurate pricing. Zero file reads, maximum speed.
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-neutral-500 font-semibold tracking-wide uppercase">Available Skills</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {skills.map(skill => {
                      const Icon = skill.icon;
                      return (
                        <div key={skill.id} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 transition-all">
                          <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                            <Icon className="w-5 h-5 text-blue-500" />
                          </div>
                          <span className="text-xs font-medium text-neutral-300">{skill.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-4">
                  <p className="text-xs text-neutral-500 font-semibold tracking-wide uppercase">Try asking...</p>
                  <div className="space-y-2">
                    <button
                      onClick={() => setInput('Quote 10,000 6x9 postcards 4/4 100# gloss')}
                      className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="text-blue-500 mr-2">→</span>
                      Quote 10k 6x9 postcards ⚡
                    </button>
                    <button
                      onClick={() => setInput('5000 4x6 postcards full color work order')}
                      className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="text-blue-500 mr-2">→</span>
                      Work order for 5k postcards ⚡
                    </button>
                    <button
                      onClick={() => setInput('2500 flyers 8.5x11 with direct mail')}
                      className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="text-blue-500 mr-2">→</span>
                      Flyers with mail services ⚡
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`mb-8 ${msg.role === 'user' ? 'flex justify-end' : ''}`}
            >
              <div className={`max-w-4xl ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                <div className={`flex items-start gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform hover:scale-105 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25' 
                      : 'bg-neutral-900 border border-neutral-800'
                  }`}>
                    <span className={`text-xs font-semibold ${msg.role === 'user' ? 'text-white' : 'text-neutral-400'}`}>
                      {msg.role === 'user' ? 'YOU' : 'AI'}
                    </span>
                  </div>
                  <div className={`flex-1 space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
                    {msg.files && msg.files.length > 0 && (
                      <div className={`flex flex-wrap gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.files.map((file, i) => (
                          <div key={i} className="inline-flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-400">
                            <FileText className="w-3.5 h-3.5" />
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={`group relative ${
                      msg.role === 'user' 
                        ? 'inline-block bg-gradient-to-br from-blue-500 to-blue-600 px-5 py-3.5 rounded-2xl shadow-lg shadow-blue-500/20 text-white' 
                        : 'text-neutral-200'
                    }`} style={{ lineHeight: '1.7' }}>
                      {msg.role === 'assistant' && (
                        <div className="absolute -left-1 top-0 w-0.5 h-full bg-gradient-to-b from-blue-500/40 to-transparent rounded-full"></div>
                      )}
                      <div className={msg.role === 'assistant' ? 'pl-3' : ''}>
                        {msg.content.split('\n').map((line, i) => (
                          <p key={i} className={msg.role === 'user' ? 'mb-0' : 'mb-3 last:mb-0'}>
                            {line || '\u00A0'}
                          </p>
                        ))}
                      </div>
                    </div>
                    {msg.role === 'assistant' && msg.actions && (
                      <div className="pl-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {msg.actions.includes('copy') && (
                          <button
                            onClick={() => copyToClipboard(msg.content)}
                            className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all flex items-center gap-1.5"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                        )}
                        {msg.actions.includes('export') && (
                          <button className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            Export
                          </button>
                        )}
                        <button className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5" />
                          Regenerate
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="mb-8">
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-neutral-400">AI</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex gap-1.5 pt-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                  </div>
                  <p className="text-xs text-neutral-500 pl-3">⚡ Instant mode...</p>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-neutral-800/60 bg-neutral-900/50 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4">
          {uploadedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {uploadedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm text-neutral-300">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="text-neutral-500 hover:text-neutral-300">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div 
            className={`relative transition-all duration-200 ${isDragging ? 'scale-[0.98]' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {isDragging && (
              <div className="absolute inset-0 border-2 border-dashed border-blue-500/50 rounded-2xl bg-blue-500/5 z-10 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center">
                  <Upload className="w-7 h-7 text-blue-500 mx-auto mb-2" />
                  <p className="text-sm text-blue-400 font-medium">Drop files to upload</p>
                </div>
              </div>
            )}
            
            <div className="flex items-end gap-2.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.csv,.xlsx,image/*"
                multiple
                className="hidden"
              />
              
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-xl transition-all duration-200"
                disabled={isLoading}
              >
                <Upload className="w-5 h-5" />
              </button>
              
              <div className="flex-1 relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask chatMPA anything... (instant mode - no file reads!)"
                  className="w-full px-5 py-3.5 bg-neutral-900 border border-neutral-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-transparent resize-none text-neutral-200 placeholder-neutral-500 text-sm transition-all duration-200"
                  rows="3"
                  disabled={isLoading}
                />
              </div>
              
              <button
                onClick={handleSubmit}
                disabled={(!input.trim() && uploadedFiles.length === 0) || isLoading}
                className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:shadow-none hover:scale-105 active:scale-95 disabled:hover:scale-100"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-center gap-5 text-xs text-neutral-600">
            <span><kbd className="px-2 py-1 bg-neutral-800/60 border border-neutral-700 rounded font-mono text-neutral-500">Enter</kbd> send</span>
            <span><kbd className="px-2 py-1 bg-neutral-800/60 border border-neutral-700 rounded font-mono text-neutral-500">⇧ Enter</kbd> new line</span>
            <span className="text-blue-500">⚡ Instant Mode</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #525252;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #404040 transparent;
        }
      `}</style>
    </div>
  );
}
