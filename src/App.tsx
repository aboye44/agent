import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, RefreshCw, User } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';
import { SPEC_PARSER_PROMPT, parseSpecsFromResponse } from './utils/specParser';

type ChatMsg = {
  id?: string | number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
};

export default function App() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

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
    if (autoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      ::-webkit-scrollbar { width: 8px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
        border-radius: 10px; transition: background 0.2s;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
      }
      * { scrollbar-width: thin; scrollbar-color: #3b82f6 transparent; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    setAutoScroll(true);

    const userMessage: ChatMsg = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error('API key not found. Please add VITE_ANTHROPIC_API_KEY to your .env file.');
      }

      const client = new Anthropic({
        apiKey,
        dangerouslyAllowBrowser: true
      });

      // Check if this is a quote request
      const isQuoteRequest = /\b(quote|price|cost|how much)\b/i.test(currentInput);

      // Context depth
      const needsDeepContext = /\b(add|change|update|modify|also|too|and)\b/i.test(currentInput);
      const contextDepth = needsDeepContext ? 5 : 3;

      // Filter previous messages (drop thinking stubs)
      const validMessages = messages.filter(
        m => m.content && m.content !== '🔄 Calculating your quote...' && m.content.trim().length > 0
      );
      const history = (isQuoteRequest || needsDeepContext)
        ? validMessages.slice(-contextDepth)
        : [];

      // Build Anthropic message blocks (must be block format)
      const messageBlocks = [
        ...history.map(m => ({
          role: m.role,
          content: [{ type: 'text', text: m.content }]
        })),
        {
          role: 'user' as const,
          content: [{ type: 'text', text: currentInput }]
        }
      ];

      const maxTokens = 2000; // Much smaller - just for parsing

      // Insert a “thinking” stub that we’ll overwrite
      const assistantMessageId = Date.now();
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '🔄 Calculating your quote...',
          timestamp: new Date().toISOString()
        }
      ]);

      // If it's a quote request, use local calculation
      if (isQuoteRequest) {
        // Import calculation engine
        const { calculateQuote } = await import('./engine/quoteCalculator');
        const { formatQuote } = await import('./engine/quoteFormatter');

        // Use Claude ONLY to parse specs into JSON
        const stream = await client.beta.messages.stream({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: maxTokens,
          temperature: 0,
          betas: ['prompt-caching-2024-07-31'],
          system: [
          {
            type: 'text',
            text: SPEC_PARSER_PROMPT,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: messageBlocks
      });

      // Stream handlers
      let fullResponse = '';

      stream.on('text', (text: string) => {
        fullResponse += text;

        // Try to parse specs from response
        const specs = parseSpecsFromResponse(fullResponse);

        if (specs) {
          // We have complete specs! Calculate locally
          try {
            const result = calculateQuote(specs);
            const formattedQuote = formatQuote(result);

            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: formattedQuote }
                  : msg
              )
            );
          } catch (error) {
            console.error('Calculation error:', error);
            setMessages(prev =>
              prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: `⚠️ Error calculating quote: ${error instanceof Error ? error.message : 'Unknown error'}` }
                  : msg
              )
            );
          }
        } else {
          // No specs yet - Claude is asking for more info
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId
                ? { ...msg, content: fullResponse }
                : msg
            )
          );
        }
      });

      stream.on('error', (error: unknown) => {
        console.error('Stream error:', error);
        throw error;
      });

      await stream.finalMessage();
    } else {
      // Not a quote - use Claude for general conversation
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        temperature: 0.7,
        system: [{
          type: 'text',
          text: 'You are chatMPA, a friendly quoting assistant for MPA printing. Help users with their printing questions.',
        }],
        messages: messageBlocks
      });

      let fullResponse = '';

      stream.on('text', (text: string) => {
        fullResponse += text;
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessageId ? { ...msg, content: fullResponse } : msg
          )
        );
      });

      stream.on('error', (error: unknown) => {
        console.error('Stream error:', error);
        throw error;
      });

      await stream.finalMessage();
    }
    } catch (err: any) {
      console.error('Error:', err);
      console.error('Error details:', JSON.stringify(err, null, 2));
      const errorMessage: ChatMsg = {
        role: 'assistant',
        content: `⚠️ Error: ${err.message || err.error?.message || 'Unable to process your request. Please try again.'}`,
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-neutral-950 to-neutral-900">
      {/* Header */}
      <div className="border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full"></div>
              <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">chatMPA</h1>
              <p className="text-xs text-neutral-400">Instant Pricing Agent</p>
            </div>
          </div>
          <button
            onClick={clearHistory}
            className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-all"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        <div className="max-w-4xl mx-auto px-6 py-8">
          {messages.length === 0 && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="text-center max-w-2xl space-y-8">
                <div className="relative inline-block">
                  <div className="absolute inset-0 bg-blue-500/20 blur-3xl"></div>
                  <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-2xl">
                    <Sparkles className="w-12 h-12 text-white" strokeWidth={2} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl font-bold text-white">MPA Quoting Agent</h2>
                  <p className="text-lg text-neutral-400">
                    Get instant pricing for postcards, flyers, booklets & envelopes
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-8">
                  <button
                    onClick={() =>
                      setInput('quote 500 6x9 postcards 4/4 100# gloss cover')
                    }
                    className="group text-left px-6 py-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <span className="text-xl">📮</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">500 Postcards</div>
                        <div className="text-sm text-neutral-500">6×9, full color, gloss cover</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setInput('quote 10k #10 envelopes 1/0')}
                    className="group text-left px-6 py-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <span className="text-xl">✉️</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">10,000 Envelopes</div>
                        <div className="text-sm text-neutral-500">#10 standard, one-color</div>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() =>
                      setInput('quote 5k 16-page booklets 4/4 throughout')
                    }
                    className="group text-left px-6 py-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <span className="text-xl">📚</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">5,000 Booklets</div>
                        <div className="text-sm text-neutral-500">
                          16 pages, full color, saddle-stitched
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex gap-4 max-w-[85%] ${
                  msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                      : 'bg-neutral-800 border border-neutral-700'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" strokeWidth={2.5} />
                  ) : (
                    <Sparkles className="w-5 h-5 text-blue-400" strokeWidth={2.5} />
                  )}
                </div>

                {/* Message Content */}
                <div className="flex-1 space-y-2">
                  <div
                    className={`rounded-3xl px-6 py-4 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-100'
                    }`}
                  >
                    <div className="text-base leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>

                  {/* Copy button for AI messages */}
                  {msg.role === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(msg.content)}
                      className="ml-2 px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all flex items-center gap-1.5"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl sticky bottom-0">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="relative flex items-end gap-3 bg-neutral-900 rounded-3xl border border-neutral-800 p-2 focus-within:border-blue-500/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Quote 500 postcards, 10k envelopes, booklets..."
              className="flex-1 px-4 py-3 bg-transparent text-white placeholder-neutral-500 focus:outline-none resize-none text-base"
              rows={1}
              disabled={isLoading}
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="flex-shrink-0 w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-3 text-center">
            Try: "quote 1000 postcards 6x9" • "5k envelopes" • "500 booklets 16 pages"
          </p>
        </div>
      </div>
    </div>
  );
}
