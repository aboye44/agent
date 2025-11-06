import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, RefreshCw, User } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

export default function App() {
  const [messages, setMessages] = useState([]);
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

  // Detect when user scrolls up manually
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  // Add custom scrollbar styles
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      /* Custom scrollbar for webkit browsers */
      ::-webkit-scrollbar {
        width: 8px;
      }
      
      ::-webkit-scrollbar-track {
        background: transparent;
      }
      
      ::-webkit-scrollbar-thumb {
        background: linear-gradient(180deg, #3b82f6 0%, #2563eb 100%);
        border-radius: 10px;
        transition: background 0.2s;
      }
      
      ::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%);
      }
      
      /* Custom scrollbar for Firefox */
      * {
        scrollbar-width: thin;
        scrollbar-color: #3b82f6 transparent;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    // Re-enable auto-scroll when user sends a new message
    setAutoScroll(true);

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

      // Smart context - include MORE messages for quotes to ensure spec tracking
      // This is CRITICAL - bot needs to see previous messages to extract specs like quantity
      const isQuoteRequest = /\b(quote|price|cost|how much)\b/i.test(currentInput);
      const needsContext = /\b(add|change|update|modify|also|too|and)\b/i.test(currentInput);
      
      let recentMessages: { role: 'user' | 'assistant'; content: string }[] = [];
      if (isQuoteRequest || needsContext) {
        // Include last 5 messages (not just 3) to capture ALL specs across conversation
        // Example: Msg1="quote 500 postcards" Msg2=(bot) Msg3="6x9" → need Msg1 context
        recentMessages = messages.slice(-5).map((msg: any) => ({ 
          role: msg.role, 
          content: msg.content 
        }));
      }

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

════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ CRITICAL RULE #1 - READ BEFORE EVERY RESPONSE ⚠️⚠️⚠️
════════════════════════════════════════════════════════════════

BEFORE responding to ANY message, complete this checklist:

☐ Step 1: Read ALL previous messages in this conversation
☐ Step 2: Extract these 4 specs from ALL messages combined:
   - QUANTITY: Look for "500", "10k", "1000", etc. → Found: _______
   - SIZE: Look for "6x9", "4×6", "8.5×11", etc. → Found: _______
   - COLOR: Look for "4/4", "4/0", "1/1", etc. → Found: _______
   - STOCK: Look for "14pt", "100# gloss", "kallima", etc. → Found: _______

☐ Step 3: Count how many specs you found:
   - If you found 4/4 specs → CALCULATE QUOTE IMMEDIATELY (skip to code)
   - If you found 3/4 specs → Ask ONLY for the 1 missing spec
   - If you found 2/4 specs → Ask ONLY for the 2 missing specs
   - If you found 0-1/4 specs → Ask for all missing specs

☐ Step 4: NEVER ask for a spec that was already provided in a previous message

EXAMPLE OF CORRECT BEHAVIOR:
Message 1 (user): "quote 500 postcards"
Your extraction: Quantity=500 ✓, Size=?, Color=?, Stock=?
Your response: Ask for size, color, stock

Message 2 (user): "6x9 4/4 14pt"  
Your extraction: Quantity=500 ✓ (from msg 1), Size=6x9 ✓, Color=4/4 ✓, Stock=14pt ✓
Your response: CALCULATE IMMEDIATELY (all 4 found)

════════════════════════════════════════════════════════════════

⚠️ CRITICAL: CHECK CONVERSATION HISTORY ⚠️
Before asking ANY question, check if the answer was already provided in the conversation history.
If the user says "I already told you X" or provides information you asked for, proceed immediately.

⚠️ MANDATORY: USE PYTHON CODE FOR ALL QUOTE CALCULATIONS ⚠️

When user requests a quote, you MUST:
1. Write Python code using the code_execution tool
2. Calculate ALL numbers in Python (sheets, costs, multipliers, quote)
3. Present the results from your Python calculations
4. NEVER do arithmetic in your head - always use code

⚠️ MANDATORY INTERNAL OUTPUT (NEVER OMIT) ⚠️
This app is INTERNAL. After every quote, ALWAYS output a "Cost (internal)" section with these exact lines:
- Paper: $X.XX ($Y.YY/pc)
- Clicks: $X.XX ($Y.YY/pc)
- Stitching: $X.XX ($Y.YY/pc)  [0 if not applicable]
- Overhead/QC: $X.XX           [0 if not applicable]
- TOTAL COST: $X.XX ($Y.YY/pc)
Do NOT hide internal costs. Do NOT replace with a summary.

⚠️ SPEC GATHERING RULES ⚠️

You need exactly 4 specs to calculate a quote:
1. QUANTITY - "500", "10k", "1000"
2. SIZE - "6×9", "4×6", "16 pages"
3. COLOR - "4/4", "4/0", "1/1"
4. STOCK - "14pt", "100# gloss", "kallima"

HOW TO GATHER SPECS:
1. Look at ALL messages (not just current message)
2. Extract any specs you find from the ENTIRE conversation
3. Only ask for specs you DON'T have yet
4. Calculate immediately when you have all 4

COMMON MISTAKE TO AVOID:
❌ User says "quote 500 postcards" → You ask "what size?" → User says "6x9" → You ask "what quantity?"
✅ User says "quote 500 postcards" → You ask "what size?" → User says "6x9" → You have qty=500 from earlier, so ask only for color & stock

⚠️ MAILING SERVICES: When user says "add mailing" or "mail it":
- AUTOMATICALLY add: S-01 ($0.007) + S-02 ($0.035) + S-08 ($0.017) = $0.059/pc
- NEVER ask questions - just add the services
- State: "Postage billed at actual USPS cost"

PYTHON CALCULATION TEMPLATE (copy and modify for each quote):

import math

# === INPUT PARAMETERS ===
qty = 1000
finished_width = 6
finished_height = 9
color = "4/4"  # or "4/0", "1/0", etc
stock_cost_per_sheet = 0.0965
click_rate = 0.0416
product_type = "postcard"  # or "envelope", "booklet", "letter"

# === BOOKLET EXAMPLE - CRITICAL: NO UP-COUNT! ===
qty = 1529
total_pages = 12  # USER SPECIFIED PAGE COUNT

# ⚠️ Booklets DO NOT use generic folding. NEVER apply folding to product_type=="booklet".
# Each 13×19 sheet = 4 BOOK PAGES (one spread per side)
# Formula: total_pages ÷ 4 = sheets_per_booklet
# Then: qty × sheets_per_booklet × spoilage = total_sheets

# Calculate sheets per booklet
sheets_per_booklet = total_pages / 4  # Example: 12 pages ÷ 4 = 3 sheets

# Spoilage ladder (ONE source of truth)
if qty <= 250:
    spoilage_factor = 1.05
elif qty <= 500:
    spoilage_factor = 1.04
elif qty <= 1000:
    spoilage_factor = 1.03
elif qty <= 2500:
    spoilage_factor = 1.025
else:
    spoilage_factor = 1.02

# Total sheets needed (NO up-count division!)
total_sheets = math.ceil(qty * sheets_per_booklet * spoilage_factor)

print(f"Pages: {total_pages}")
print(f"Sheets per booklet: {sheets_per_booklet}")
print(f"Total sheets: {qty} × {sheets_per_booklet} × {spoilage_factor} = {total_sheets}")

# Paper cost
stock_cost = 0.0408  # 80# Gloss Text
paper_cost = total_sheets * stock_cost

# Click cost - P-01 Iridesse for 4/4 (per-side), so 4/4 sheet = 2 sides × 0.0416 = 0.0832
sides = 2 if "4/4" in color or "1/1" in color else 1
click_cost = total_sheets * sides * click_rate

# Saddle Stitching - CORRECTED LABOR RATES
stitch_setup = 50.00
stitch_run_rate = 0.0625  # $75/hr ÷ 1,200 pcs/hr
stitching = stitch_setup + (qty * stitch_run_rate)

# Overhead/QC - MANDATORY FOR BOOKLETS
overhead = 100.00

# Booklets never use the generic folding block
needs_folding = False

# Total cost (booklet path)
total_cost = paper_cost + click_cost + stitching + overhead

print(f"Paper: ${paper_cost:.2f} (${paper_cost/qty:.4f}/pc)")
print(f"Clicks: ${click_cost:.2f} (${click_cost/qty:.4f}/pc)")
print(f"Saddle Stitching: ${stitching:.2f} (${stitching/qty:.4f}/pc)")
print(f"Overhead/QC: ${overhead:.2f}")
print(f"TOTAL COST: ${total_cost:.2f} (${total_cost/qty:.4f}/pc)")

# === IMPOSITION (postcards/flyers only) ===
if product_type in ["postcard", "flyer"]:
    live_width = finished_width + 0.25
    live_height = finished_height + 0.25
    orient1 = math.floor(13 / live_width) * math.floor(19 / live_height)
    orient2 = math.floor(13 / live_height) * math.floor(19 / live_width)
    up_count = max(orient1, orient2)
    print(f"Imposition: {up_count}-up")
elif product_type in ["envelope", "letter"]:
    up_count = 1
    print("No imposition for envelopes/letters")

# === FOLDING (for brochures only; NEVER for product_type=='booklet') ===
if product_type in ["postcard", "flyer"]:
    needs_folding = False  # default; set True only if user asks for a folded brochure explicitly

# === PRICING MULTIPLIER (UPDATED LADDERS) ===
if product_type == "booklet":
    if qty <= 250:
        multiplier = 4.00
    elif qty <= 500:
        multiplier = 3.00
    elif qty <= 1000:
        multiplier = 2.80
    elif qty <= 2500:
        multiplier = 2.60
    elif qty <= 10000:
        multiplier = 2.40
    else:
        multiplier = 2.20
elif product_type in ["postcard", "flyer"]:
    if qty <= 250:
        multiplier = 5.50
    elif qty <= 500:
        multiplier = 4.50
    elif qty <= 1000:
        multiplier = 3.80
    elif qty <= 2500:
        multiplier = 3.30
    elif qty <= 10000:
        multiplier = 3.00
    elif qty <= 15000:
        multiplier = 2.50
    else:
        multiplier = 2.20
elif product_type == "envelope":
    if qty <= 250:
        multiplier = 5.00
    elif qty <= 500:
        multiplier = 4.00
    elif qty <= 1000:
        multiplier = 3.50
    elif qty <= 5000:
        multiplier = 3.00
    else:
        multiplier = 2.50
elif product_type == "letter":
    if qty <= 250:
        multiplier = 4.50
    elif qty <= 1000:
        multiplier = 3.50
    elif qty <= 5000:
        multiplier = 3.00
    else:
        multiplier = 2.50
else:
    # Fallback for any unclassified product (close to postcards mid-tier)
    if qty <= 250:
        multiplier = 5.50
    elif qty <= 500:
        multiplier = 4.50
    elif qty <= 1000:
        multiplier = 3.80
    elif qty <= 2500:
        multiplier = 3.30
    elif qty <= 10000:
        multiplier = 3.00
    elif qty <= 15000:
        multiplier = 2.50
    else:
        multiplier = 2.20

quote = total_cost * multiplier
margin_pct = ((quote - total_cost) / quote) * 100

print(f"Multiplier: {multiplier}×")
print(f"QUOTE: ${quote:.2f} (${quote/qty:.4f}/pc)")
print(f"Margin: {margin_pct:.0f}%")
print(f"\\nVerification: ${total_cost:.2f} × {multiplier} = ${quote:.2f}")

=== EQUIPMENT & CLICK COSTS ===
DIGITAL PRESSES:
- P-01 Iridesse Color: $0.0416/click (per side; 4/4 sheet = $0.0832)
- P-06 Nuvera B&W: $0.0027/click (per side)

# (Stock database & other sections unchanged for brevity)

=== PRICING TIERS (UPDATED) ===
POSTCARDS/FLYERS/FLATS:
- 1–250: 5.50×
- 251–500: 4.50×
- 501–1,000: 3.80×
- 1,001–2,500: 3.30×
- 2,501–10,000: 3.00×
- 10,001–15,000: 2.50×
- 15,000+: 2.20×

ENVELOPES:
- 1–250: 5.00×
- 251–500: 4.00×
- 501–1,000: 3.50×
- 1,001–5,000: 3.00×
- 5,001+: 2.50×

BOOKLETS:
- 1–250: 4.00×
- 251–500: 3.00×
- 501–1,000: 2.80×
- 1,001–2,500: 2.60×
- 2,501–10,000: 2.40×
- 10,001+: 2.20×

LETTERS / SIMPLE SHEETS:
- 1–250: 4.50×
- 251–1,000: 3.50×
- 1,001–5,000: 3.00×
- 5,001+: 2.50×

# === OUTPUT FORMAT (MANDATORY INTERNAL COSTS) ===
# Always include this internal section after the price.
# Example layout:

# Quote: $XXX.XX
# NNN Product • Specs...
#
# Cost (internal):
# * Paper: $XX.XX ($Y.YY/pc)
# * Clicks: $XX.XX ($Y.YY/pc)
# * Stitching: $XX.XX ($Y.YY/pc)
# * Overhead/QC: $XX.XX
# * TOTAL COST: $XX.XX ($Y.YY/pc)

`,
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
      
      stream.on('text', (text: string) => {
        fullResponse += text;
        setMessages(prev => prev.map((msg: any) => 
          msg.id === assistantMessageId
            ? { ...msg, content: fullResponse }
            : msg
        ));
      });

      await stream.finalMessage();

    } catch (err: any) {
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
      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef} onScroll={handleScroll}>
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
                  <h2 className="text-4xl font-bold text-white">
                    MPA Quoting Agent
                  </h2>
                  <p className="text-lg text-neutral-400">
                    Get instant pricing for postcards, flyers, booklets & envelopes
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 mt-8">
                  <button
                    onClick={() => setInput('quote 500 6x9 postcards 4/4 100# gloss cover')}
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
                    onClick={() => setInput('quote 5k 16-page booklets 4/4 throughout')}
                    className="group text-left px-6 py-4 rounded-2xl bg-neutral-900/50 border border-neutral-800/60 hover:border-blue-500/50 hover:bg-neutral-900 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <span className="text-xl">📚</span>
                      </div>
                      <div>
                        <div className="text-white font-medium">5,000 Booklets</div>
                        <div className="text-sm text-neutral-500">16 pages, full color, saddle-stitched</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg: any, idx: number) => (
            <div
              key={msg.id || idx}
              className={`mb-6 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                    : 'bg-neutral-800 border border-neutral-700'
                }`}>
                  {msg.role === 'user' ? (
                    <User className="w-5 h-5 text-white" strokeWidth={2.5} />
                  ) : (
                    <Sparkles className="w-5 h-5 text-blue-400" strokeWidth={2.5} />
                  )}
                </div>
                
                {/* Message Content */}
                <div className="flex-1 space-y-2">
                  <div className={`rounded-3xl px-6 py-4 ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-neutral-900 border border-neutral-800 text-neutral-100'
                  }`}>
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
              style={{
                minHeight: '44px',
                maxHeight: '200px'
              }}
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
