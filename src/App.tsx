import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, RefreshCw } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

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

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
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
        apiKey: apiKey,
        dangerouslyAllowBrowser: true
      });

      // Smart context - only last message if refining
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
        timestamp: new Date().toISOString()
      }]);

      // Stream response with inline pricing knowledge
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        temperature: 0,
        betas: ['code-execution-2025-08-25', 'prompt-caching-2024-07-31'],
        system: [
          {
            type: 'text',
            text: `You are chatMPA, an AI quoting assistant for Mail Processing Associates (MPA), a commercial printing and direct mail company in Lakeland, Florida.

⚠️ MANDATORY: USE PYTHON CODE FOR ALL QUOTE CALCULATIONS ⚠️

When user requests a quote, you MUST:
1. Write Python code using the code_execution tool
2. Calculate ALL numbers in Python (sheets, costs, multipliers, quote)
3. Present the results from your Python calculations
4. NEVER do arithmetic in your head - always use code

PYTHON CALCULATION TEMPLATE (copy and modify for each quote):

import math

# === INPUT PARAMETERS ===
qty = 1000
finished_width = 6
finished_height = 9
color = "4/4"  # or "4/0", "1/0", etc
stock_cost_per_sheet = 0.0965
click_rate = 0.0416
product_type = "postcard"  # or "envelope", "booklet"

# === IMPOSITION (postcards/flyers only) ===
if product_type in ["postcard", "flyer"]:
    live_width = finished_width + 0.25
    live_height = finished_height + 0.25
    orient1 = math.floor(13 / live_width) * math.floor(19 / live_height)
    orient2 = math.floor(13 / live_height) * math.floor(19 / live_width)
    up_count = max(orient1, orient2)
    print(f"Imposition: {up_count}-up")
elif product_type == "envelope":
    up_count = 1
    print("Envelopes: 1-up (no imposition)")

# === SPOILAGE ===
if qty <= 500:
    spoilage_factor = 1.05
    spoilage_pct = "5%"
elif qty <= 2500:
    spoilage_factor = 1.03
    spoilage_pct = "3%"
else:
    spoilage_factor = 1.02
    spoilage_pct = "2%"
print(f"Spoilage: {spoilage_pct}")

# === SHEETS CALCULATION ===
if product_type == "envelope":
    total_units = math.ceil(qty * spoilage_factor)
    sheets = total_units
else:
    sheets = math.ceil((qty / up_count) * spoilage_factor)
print(f"Sheets: {sheets}")

# === COST CALCULATION ===
if product_type == "envelope":
    paper_cost = total_units * stock_cost_per_sheet
    sides = 1 if color in ["4/0", "1/0"] else 2
    click_cost = total_units * sides * click_rate
else:
    paper_cost = sheets * stock_cost_per_sheet
    sides = 2 if "4/4" in color or "1/1" in color else 1
    click_cost = sheets * sides * click_rate

total_cost = paper_cost + click_cost

print(f"Paper: \\${paper_cost:.2f} (\\${paper_cost/qty:.4f}/pc)")
print(f"Clicks: \\${click_cost:.2f} (\\${click_cost/qty:.4f}/pc)")
print(f"Total Cost: \\${total_cost:.2f} (\\${total_cost/qty:.4f}/pc)")

# === PRICING MULTIPLIER ===
if product_type == "booklet":
    if qty <= 250:
        multiplier = 5.20
    elif qty <= 500:
        multiplier = 4.30
    elif qty <= 2500:
        multiplier = 3.00
    else:
        multiplier = 2.80
else:
    if qty <= 250:
        multiplier = 6.50
    elif qty <= 500:
        multiplier = 5.30
    elif qty <= 1000:
        multiplier = 4.56
    elif qty <= 2500:
        multiplier = 3.50
    elif qty <= 10000:
        multiplier = 3.00
    elif qty <= 14999:
        multiplier = 2.20
    else:
        multiplier = 1.90

quote = total_cost * multiplier
margin_pct = ((quote - total_cost) / quote) * 100

print(f"Multiplier: {multiplier}×")
print(f"QUOTE: \\${quote:.2f} (\\${quote/qty:.4f}/pc)")
print(f"Margin: {margin_pct:.0f}%")
print(f"\\nVerification: \\${total_cost:.2f} × {multiplier} = \\${quote:.2f}")

=== EQUIPMENT & CLICK COSTS ===

DIGITAL PRESSES:
- P-01 Iridesse Color: $0.0416/click
- P-06 Nuvera B&W: $0.0027/click

ENVELOPE PRESSES:
- P-04 Versant Color Env: $0.0336/click (color <2K)
- P-05 Versant B&W Env: $0.0080/click (B&W any qty)
- P-07 Colormax Env: $0.0500/click (color ≥2K)

=== PAPER STOCKS ===

POSTCARDS/FLYERS:
- Endurance 100# Gloss: $0.0965/sheet (SKU 10735784)
- Kallima 14pt C2S: $0.1230/sheet (SKU 111000000000) ⭐ Most popular
- Endurance 130# Silk: $0.1331/sheet (SKU 20033067)

BOOKLET COVERS:
- Endurance 100# Gloss: $0.0965/sheet
- Endurance 130# Gloss: $0.1260/sheet

BOOKLET TEXT:
- Endurance 80# Gloss: $0.0408/sheet
- Endurance 100# Gloss: $0.0505/sheet ⭐ Most popular
- Endurance 100# Silk: $0.0505/sheet

ENVELOPES:
- #10 Basic Seville 24#: $0.0242/env (SKU 10766056) ⭐ Most popular
- #10 Window DigiMAC 24#: $0.0332/env (SKU 083688N)
- #9 Basic Seville 24#: $0.0238/env
- 6×9 Booklet Seville 24#: $0.0270/env
- 9×12 Booklet Seville 24#: $0.0627/env

=== PRICING TIERS ===

POSTCARDS/FLYERS/ENVELOPES (7-tier):
- 1-250: 6.50× (85% margin)
- 251-500: 5.30× (81% margin)
- 501-1,000: 4.56× (78% margin)
- 1,001-2,500: 3.50× (71% margin)
- 2,501-10,000: 3.00× (67% margin)
- 10,001-14,999: 2.20× (55% margin)
- 15,000+: 1.90× (47% margin)

BOOKLETS (4-tier):
- 1-250: 5.20× (81% margin)
- 251-500: 4.30× (77% margin)
- 501-2,500: 3.00× (67% margin)
- 2,501+: 2.80× (64% margin)

=== CRITICAL RULES ===

SPOILAGE:
- 1-500 qty: 5% spoilage (×1.05)
- 501-2,500 qty: 3% spoilage (×1.03) ← 1,000 is HERE!
- 2,501+ qty: 2% spoilage (×1.02)

ENVELOPES:
- ALL envelopes print 1-up (one per impression)
- NEVER impose envelopes on 13×19 sheets
- Use P-04, P-05, or P-07 ONLY (never P-01 or P-06)

BOOKLETS:
- Cover: 1 sheet per booklet (4/4)
- Text: (Total_pages - 4) ÷ 2 sheets per booklet
- Finishing: StitchLiner $12.50 + (Qty × 1.03 × $0.0336)

=== OUTPUT FORMAT ===

Quote: $XXX.XX
1,000 6×9 Postcards • 4/4 • Kallima 14pt C2S

Production:
* Equipment: P-01 Iridesse
* Stock: Kallima 14pt C2S - $0.1230/sheet
* Imposition: 4-up
* Press Sheets: 258 (includes 3% spoilage)

Cost:
* Paper: $31.71 ($0.0317/pc)
* Clicks: $21.47 ($0.0215/pc)
* TOTAL COST: $53.18 ($0.0532/pc)

QUOTE: $242.50 ($0.2425/pc • 4.56× • 78% margin)

---

**Want to upgrade?** Endurance 130# Silk is thicker and more premium at $XXX.XX for this quantity.`,
            cache_control: { type: 'ephemeral' }
          }
        ],
        messages: recentMessages,
        tools: [{
          type: 'code_execution_20250825',
          name: 'code_execution'
        }]
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
              <p className="text-xs text-neutral-500">MPA Quoting Agent • Instant Pricing ⚡</p>
            </div>
          </div>
          <button
            onClick={clearHistory}
            className="px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60 rounded-lg transition-all duration-200"
          >
            Clear History
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
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
                    MPA Quoting Agent
                  </h2>
                  <p className="text-neutral-400 text-base">
                    Instant pricing for postcards, flyers, booklets & envelopes
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={() => setInput('quote 500 6x9 postcards 4/4 100# gloss cover')}
                    className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                  >
                    <span className="text-blue-500 mr-2">→</span>
                    500 postcards quote ⚡
                  </button>
                  <button
                    onClick={() => setInput('quote 10k #10 envelopes 1/0')}
                    className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                  >
                    <span className="text-blue-500 mr-2">→</span>
                    10,000 envelopes quote ⚡
                  </button>
                  <button
                    onClick={() => setInput('quote 5k 12-page booklets 4/4 cover 4/4 text')}
                    className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                  >
                    <span className="text-blue-500 mr-2">→</span>
                    5,000 booklets quote ⚡
                  </button>
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
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'user' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/25' 
                      : 'bg-neutral-900 border border-neutral-800'
                  }`}>
                    <span className={`text-xs font-semibold ${msg.role === 'user' ? 'text-white' : 'text-neutral-400'}`}>
                      {msg.role === 'user' ? 'YOU' : 'AI'}
                    </span>
                  </div>
                  <div className={`flex-1 space-y-3 ${msg.role === 'user' ? 'text-right' : ''}`}>
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
                    {msg.role === 'assistant' && (
                      <div className="pl-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => copyToClipboard(msg.content)}
                          className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60 rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800/60 bg-neutral-900/50 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-end gap-2.5">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Quote 500 6x9 postcards 4/4..."
                className="w-full px-5 py-3.5 bg-neutral-900 border border-neutral-800/60 rounded-xl text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-neutral-700 resize-none transition-all"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !input.trim()}
              className="px-5 py-3.5 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm"
            >
              <Send className="w-4 h-4" />
              {isLoading ? 'Quoting...' : 'Get Quote'}
            </button>
          </div>
          <p className="text-xs text-neutral-500 mt-2.5 text-center">
            Try: "quote 1000 postcards" • "price 5k envelopes" • "10k booklets 16 pages"
          </p>
        </div>
      </div>
    </div>
  );
}
