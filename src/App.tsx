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

# === SPOILAGE (aligned with pricing tiers) ===
if qty <= 250:
    spoilage_factor = 1.05
    spoilage_pct = "5%"
elif qty <= 500:
    spoilage_factor = 1.04
    spoilage_pct = "4%"
elif qty <= 1000:
    spoilage_factor = 1.03
    spoilage_pct = "3%"
elif qty <= 2500:
    spoilage_factor = 1.025
    spoilage_pct = "2.5%"
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

print(f"Paper: \${paper_cost:.2f} (\${paper_cost/qty:.4f}/pc)")
print(f"Clicks: \${click_cost:.2f} (\${click_cost/qty:.4f}/pc)")

# === FOLDING (for brochures) ===
# Add folding if product requires it (trifold, bifold, etc.)
needs_folding = False  # Set to True for brochures
if needs_folding:
    if qty <= 1000:
        fold_rate = 0.025
        fold_setup = 20
    elif qty <= 5000:
        fold_rate = 0.020
        fold_setup = 25
    elif qty <= 10000:
        fold_rate = 0.015
        fold_setup = 30
    else:
        fold_rate = 0.012
        fold_setup = 35
    
    folding_cost = fold_setup + (qty * fold_rate)
    total_cost += folding_cost
    print(f"Folding: \${folding_cost:.2f} (\${folding_cost/qty:.4f}/pc)")

print(f"Total Cost: \${total_cost:.2f} (\${total_cost/qty:.4f}/pc)")

# === PRICING MULTIPLIER ===
if product_type == "booklet":
    if qty <= 250:
        multiplier = 5.20
    elif qty <= 500:
        multiplier = 4.30
    elif qty <= 1000:
        multiplier = 3.50
    elif qty <= 2500:
        multiplier = 3.20
    elif qty <= 10000:
        multiplier = 2.80
    else:
        multiplier = 2.50
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

# === SHOP MINIMUM ===
shop_minimum = 75.00
if quote < shop_minimum:
    quote = shop_minimum
    print(f"⚠️ Shop minimum applied: \${shop_minimum:.2f}")

margin_pct = ((quote - total_cost) / quote) * 100

print(f"Multiplier: {multiplier}×")
print(f"QUOTE: \${quote:.2f} (\${quote/qty:.4f}/pc)")
print(f"Margin: {margin_pct:.0f}%")
print(f"\nVerification: \${total_cost:.2f} × {multiplier} = \${quote:.2f}")

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

BOOKLETS (6-tier - more complex than postcards):
- 1-250: 5.20× (81% margin)
- 251-500: 4.30× (77% margin)
- 501-1,000: 3.50× (71% margin)
- 1,001-2,500: 3.20× (69% margin)
- 2,501-10,000: 2.80× (64% margin)
- 10,001+: 2.50× (60% margin)

BOOKLET FINISHING COSTS (based on October 2025 competitive analysis):
- Setup: $25.00 (StitchLiner makeready)
- Run cost per booklet (includes labor + wire + 3% spoilage):
  * 8-16 pages: $0.015/booklet (5,500 books/hr)
  * 17-32 pages: $0.020/booklet (5,000 books/hr)
  * 33-64 pages: $0.028/booklet (4,200 books/hr)
  * 65-96 pages: $0.038/booklet (3,500 books/hr)
- Formula: $25 + (Qty × 1.03 × per_book_rate)

BOOKLET FINISHING EXAMPLE (1000 × 16-page):
finishing_cost = 25 + (1000 × 1.03 × 0.015) = $40.45

=== FOLDING COSTS (MBO High-Speed Automated Folder) ===

WHEN TO APPLY FOLDING:
- Any product described as "brochure", "trifold", "bifold", or "fold"
- Flyers that need folding (e.g., "fold to 8.5×11")
- NEVER apply to booklets (saddle-stitching already includes the fold)

MBO FOLDER RATES (based on volume):
- 1-1,000: $0.025/pc + $20 setup
- 1,001-5,000: $0.020/pc + $25 setup  
- 5,001-10,000: $0.015/pc + $30 setup
- 10,001+: $0.012/pc + $35 setup

FOLDING CALCULATION EXAMPLE (5,000 trifold brochures):
fold_setup = 25
fold_rate = 0.020
folding_cost = 25 + (5000 × 0.020) = $125.00 ($0.025/pc including setup)

IMPORTANT: Add folding cost to total_cost BEFORE applying multiplier

=== DESIGN SERVICES ===

DESIGN RATE: $75/hour

When user mentions design work or needs a custom design:
- Ask clarifying questions: complexity, number of revisions, source materials
- Estimate hours based on scope:
  * Simple postcard/flyer layout: 1-2 hours ($75-150)
  * Multi-page booklet with custom graphics: 3-6 hours ($225-450)
  * Complex catalog or magazine: 8-15 hours ($600-1,125)
- Add design cost separately to printing quote
- State: "Design services billed at $75/hour"

DESIGN QUOTE EXAMPLE:
"For a custom 16-page booklet design, I estimate 4-5 hours of design work:
* Design Services: $300-375 (4-5 hrs @ $75/hr)
* Printing: [printing quote]
* TOTAL: [design + printing]"

=== MAILING SERVICES (PASS-THROUGH - NO MARKUP) ===

CRITICAL MAILING RULES:
1. When user says "add mailing" or "mail it" → AUTOMATICALLY add standard services
2. NEVER ask questions about mailing - just add services
3. NEVER calculate or estimate postage amounts
4. Always state: "Postage billed at actual USPS cost"

STANDARD MAILING SERVICES (always include these three):
- S-01 NCOA/CASS: $0.007/pc (address validation + updates)
- S-02 Inkjet Addressing: $0.035/pc (print addresses on pieces)
- S-08 Bulk Mail Prep: $0.017/pc (sortation + USPS drop-off)
- TOTAL: $0.059/pc

MAILING QUOTE EXAMPLE (500 postcards):

PRINTING:
* Quote: $125.72 ($0.2514/pc)

MAIL SERVICES:
* NCOA/CASS (S-01): $3.50 ($0.007/pc)
* Inkjet Addressing (S-02): $17.50 ($0.035/pc)  
* Bulk Mail Prep (S-08): $8.50 ($0.017/pc)
* Mail Services Total: $29.50 ($0.059/pc)

TOTAL: $155.22 ($0.3104/pc)
Postage: Billed at actual USPS cost

=== CRITICAL RULES ===

SPOILAGE (NOW ALIGNED WITH PRICING):
- 1-250 qty: 5% spoilage (×1.05)
- 251-500 qty: 4% spoilage (×1.04)
- 501-1,000 qty: 3% spoilage (×1.03)
- 1,001-2,500 qty: 2.5% spoilage (×1.025)
- 2,501+ qty: 2% spoilage (×1.02)

SHOP MINIMUM:
- ALL quotes must be at least $75.00
- If calculated quote < $75, set quote = $75 and note: "Shop minimum applied"

ENVELOPES:
- ALL envelopes print 1-up (one per impression)
- NEVER impose envelopes on 13×19 sheets
- Use P-04, P-05, or P-07 ONLY (never P-01 or P-06)

BOOKLETS:
- Cover: 1 sheet per booklet (4/4)
- Text: (Total_pages - 4) ÷ 2 sheets per booklet
- Finishing: Use page-count-specific rates from table above

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
* Folding: $125.00 ($0.0250/pc) [if brochure/trifold/bifold]
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
      <div className="flex-1 overflow-y-auto">
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
          
          {messages.map((msg, idx) => (
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
                  <span className="text-sm font-bold text-white">
                    {msg.role === 'user' ? 'Y' : 'AI'}
                  </span>
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
