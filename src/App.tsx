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

      // INLINE ALL MPA KNOWLEDGE WITH CORRECT PRICING - NO FILE READS!
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        temperature: 0,
        betas: ['code-execution-2025-08-25', 'prompt-caching-2024-07-31'],
        system: [
          {
            type: 'text',
            text: `You are chatMPA, an AI assistant for Mail Processing Associates (MPA), a commercial printing and direct mail company in Lakeland, Florida.

=== EQUIPMENT & CLICK COSTS ===

DIGITAL PRESSES:
- P-01 Iridesse Color: $0.0416/click (premium color, covers, specialty)
- P-06 Nuvera B&W: $0.0027/click (B&W text pages, monochrome work)
- P-04 Versant Color Env: $0.0336/click (color envelopes <2K)
- P-05 Versant B&W Env: $0.0080/click (B&W envelopes <2K)
- P-07 Colormax Env: $0.0500/click (color envelopes ≥2K)

Click = 1 impression on 1 side of 1 sheet
- 4/0 (front only) = 1 click per sheet
- 4/4 (front + back) = 2 clicks per sheet

ENVELOPE EQUIPMENT SELECTION:
- Color envelopes <2K → P-04 ($0.0336/click)
- Color envelopes ≥2K → P-07 ($0.0500/click)
- B&W envelopes <2K → P-05 ($0.0080/click)
- B&W envelopes ≥2K → P-06 ($0.0027/click) on 13×19 sheets

BOOKLET EQUIPMENT:
- 4C cover + 4C text → P-01 / P-01
- 4C cover + B&W text → P-01 / P-06 (HUGE SAVINGS - use this!)
- B&W cover + B&W text → P-06 / P-06

=== PAPER STOCKS & COSTS ===

POSTCARDS/FLYERS (common):
- Budget: Endurance 100# Gloss Cover — $0.0965/sheet (SKU 10735784)
- Standard: Kallima 14pt C2S — $0.1230/sheet (SKU 111000000000) ⭐ Most popular
- Premium: Endurance 130# Silk — $0.1331/sheet (SKU 20033067)

BOOKLET COVERS:
- Budget: Endurance 100# Gloss — $0.0965/sheet (SKU 10735784)
- Standard: Endurance 100# Silk — $0.0956/sheet (SKU 10735904)
- Premium: Endurance 130# Gloss — $0.1260/sheet (SKU 10703893)

BOOKLET TEXT:
- Budget: Endurance 80# Gloss — $0.0408/sheet (SKU 10735824)
- Standard: Endurance 100# Gloss — $0.0505/sheet (SKU 10735823) ⭐ Most popular
- Premium: Endurance 100# Silk — $0.0505/sheet (SKU 10735917)

ENVELOPES (most common):
- #10 Basic: Seville 24# Wove White — $0.0242/env (SKU 10766056) ⭐ Most popular
- #10 Window: DigiMAC 24# Wove White — $0.0332/env (SKU 083688N)
- #9 Basic: Seville 24# Wove White — $0.0238/env (SKU 10766047)
- 6×9 Booklet: Seville 24# Wove White — $0.0270/env (SKU 20001992)
- 9×12 Booklet: Seville 24# Wove White — $0.0627/env (SKU 10947872)

=== IMPOSITION & SPOILAGE ===

SHEET SIZES:
- 13×19" (Iridesse, Versant) - most common
- 12×18" (alternative)

IMPOSITION FORMULA (with 0.125" bleed on all sides):
1. Add 0.25" to live width and height (0.125" bleed each side)
2. Calculate both orientations:
   - Orient 1: FLOOR(13 ÷ width_with_bleed) × FLOOR(19 ÷ height_with_bleed)
   - Orient 2: FLOOR(13 ÷ height_with_bleed) × FLOOR(19 ÷ width_with_bleed)
3. Use whichever orientation yields more pieces per sheet

SPOILAGE RATES:
- 1-500 qty: 5% spoilage (×1.05)
- 501-2,500 qty: 3% spoilage (×1.03)
- 2,501+ qty: 2% spoilage (×1.02)

=== PRICING MULTIPLIERS ===

POSTCARDS/FLYERS/ENVELOPES (7-tier system):

| Quantity | Multiplier | Margin |
|----------|------------|--------|
| 1-250 | 6.50× | 85% |
| 251-500 | 5.30× | 81% |
| 501-1,000 | 4.56× | 78% |
| 1,001-2,500 | 3.50× | 71% |
| 2,501-10,000 | 3.00× | 67% |
| 10,001-14,999 | 2.20× | 55% |
| 15,000+ | 1.90× | 47% |

BOOKLETS (4-tier system):

| Quantity | Multiplier | Margin |
|----------|------------|--------|
| 1-250 | 5.20× | 81% |
| 251-500 | 4.30× | 77% |
| 501-2,500 | 3.00× | 67% |
| 2,501+ | 2.80× | 64% |

TIER SELECTION EXAMPLES:
- 250 qty = 6.50× (1-250 tier)
- 500 qty = 5.30× (251-500 tier)
- 501 qty = 4.56× (501-1,000 tier)
- 10,000 qty = 3.00× (2,501-10,000 tier)
- 10,001 qty = 2.20× (10,001-14,999 tier)

=== ENVELOPE PRINTING ===

WORKFLOW:
- Envelopes print 1-up (one envelope per impression)
- No imposition calculation needed
- Use envelope-specific equipment: P-04, P-05, or P-07

COST CALCULATION:
- Envelope cost: Qty × Spoilage × Cost_per_envelope
- Click cost: Qty × Spoilage × Sides × Click_rate
- Total cost: Envelope cost + Click cost

EXAMPLE - 1,000 #10 envelopes, 4/0:
- Envelopes: 1,000 × 1.05 × $0.0242 = $25.41
- Clicks: 1,000 × 1.05 × 1 side × $0.0336 = $35.28
- Total cost: $60.69
- Quote (4.56× for 501-1,000 tier): $276.75

=== BOOKLET FINISHING ===

STITCHLINER (8-48 pages, 100 min qty):
- Cost: $12.50 setup + (Qty × 1.03 × $0.0336)

DIGIBINDER (36-200 pages):
- Cost: $25.00 setup + (Qty × 1.04 × $0.40)

COIL (8-200 pages, 500 max):
- Cost: $35.00 setup + (Qty × 1.05 × [$0.60 small / $0.75 med / $0.95 large])

BOOKLET SHEET CALCULATIONS:
- Cover: 1 sheet per booklet (prints 4/4, folds to 4 cover pages)
- Text: (Total_pages - 4) ÷ 2 sheets per booklet

EXAMPLE - 1,000 qty 16-page booklet:
- Cover: 1,000 sheets × 1.05 spoilage = 1,050 sheets
- Text: (16 - 4) ÷ 2 = 6 sheets × 1,000 × 1.05 = 6,300 sheets
- Finishing: $12.50 + (1,000 × 1.03 × $0.0336) = $47.11

=== MAILING SERVICES (PASS-THROUGH - NO MARKUP) ===

MAIL SERVICE CODES:
- S-01 NCOA/CASS: $0.007/pc (address validation + update)
- S-02 Inkjet Addr Letter/PC: $0.035/pc
- S-03 Inkjet Addr Flat: $0.040/pc
- S-04 Machine Insert 1st: $0.020/pc
- S-05 Machine Insert Add'l: $0.010/pc
- S-06 Tab Double: $0.035/pc
- S-07 Tab Triple: $0.050/pc
- S-08 Bulk Mail Prep: $0.017/pc (standard sortation)
- S-09 Machine Fold: $0.015/pc
- S-10 Collate: $0.020/pc
- S-11 Machine Stamp: $0.020/pc
- S-12 Barcode OCR: $0.035/pc
- S-13 Hand Insert 1st: $0.040/pc
- S-14 Hand Insert Add'l: $0.020/pc
- S-15 Hand Seal: $0.030/pc
- S-16 Hand Stamp: $0.030/pc
- S-17 Marriage Match: $0.030/pc
- S-18 Hand Fold: $0.060/pc
- S-19 EDDM Bundle/Prep: $0.035/pc

CRITICAL MAIL RULES:
- NEVER estimate postage under any circumstances
- Always state "Postage: Actual USPS cost"
- NCOA/CASS required for Marketing Mail (not EDDM)
- EDDM uses S-19 ($0.035) for bundling
- When user mentions mailing, default to "Print + Mail" option

=== QUOTING WORKFLOW ===

1. IMPOSITION (13×19 sheet with 0.125" bleed):
   - Live_width = Finished_width + 0.25"
   - Live_height = Finished_height + 0.25"
   - Orient 1: FLOOR(13 ÷ Live_width) × FLOOR(19 ÷ Live_height)
   - Orient 2: FLOOR(13 ÷ Live_height) × FLOOR(19 ÷ Live_width)
   - Use MAX(Orient1, Orient2)
   - For envelopes: No imposition (1-up)

2. CALCULATE SHEETS:
   - Postcards/Flyers: (Qty ÷ Up_count) × Spoilage_factor
   - Envelopes: Qty × Spoilage_factor
   - Booklets: Calculate cover and text separately

3. CALCULATE COSTS:
   - Paper: Sheets × Cost_per_sheet (or Qty × Cost_per_envelope)
   - Clicks: Sheets × Sides × Click_rate (or Qty × Spoilage × Sides × Click_rate for envelopes)
   - Finishing: Only for booklets (setup + run cost)
   - Total cost: Paper + Clicks (+ Finishing if booklet)

4. APPLY MULTIPLIER:
   - Select tier based on quantity
   - Postcards/Flyers/Envelopes: Use 7-tier system
   - Booklets: Use 4-tier system
   - Quote = Total_cost × Multiplier

5. VERIFY MATH:
   - CRITICAL: Final_quote MUST equal Total_cost × Multiplier
   - Example: $60.69 × 4.56 = $276.75 ✓

=== OUTPUT FORMAT ===

**CRITICAL: Always show per-unit pricing ($X.XX/pc) on EVERY line**

EXAMPLE POSTCARD QUOTE:

Quote: $XXX.XX
10,000 6×9 Postcards • 4/4 • Kallima 14pt C2S

Production:
* Equipment: P-01 Iridesse
* Stock: Kallima 14pt C2S - $0.1230/sheet  
* Imposition: 4-up (2×2 vs 1×3)
* Press Sheets: 2,550 (includes 2% spoilage)

Cost:
* Paper: $313.65 ($0.0314/pc)
* Clicks: $212.16 ($0.0212/pc)
* TOTAL COST: $525.81 ($0.0526/pc)

QUOTE: $1,577.43 ($0.1577/pc • 3.00× • 67% margin)

EXAMPLE ENVELOPE QUOTE:

Quote: $XXX.XX
1,000 #10 Window Envelopes • 4/0 • DigiMAC 24# Wove White

Production:
* Equipment: P-04 Versant Color Env
* Stock: DigiMAC 24# Wove White - $0.0332/envelope
* Envelopes: 1,050 (includes 5% spoilage)

Cost:
* Envelopes: $34.86 ($0.0349/pc)
* Clicks: $35.28 ($0.0353/pc)
* TOTAL COST: $70.14 ($0.0701/pc)

QUOTE: $319.84 ($0.3198/pc • 4.56× • 78% margin)

FOR DIRECT MAIL (when user mentions mailing):

Quote: $XXX.XX
5,000 Postcards • Direct Mail

PRINTING:
* Equipment: P-01 Iridesse
* Stock: Kallima 14pt C2S
* Imposition: 4-up
* Press Sheets: 1,287
* Paper: $158.30 ($0.0317/pc)
* Clicks: $107.13 ($0.0214/pc)
* Printing Cost: $265.43 ($0.0531/pc)
* Printing Quote: $796.29 ($0.1593/pc • 3.00× • 67% margin)

MAIL SERVICES:
* NCOA/CASS (S-01): $35.00 ($0.007/pc)
* Inkjet Addressing (S-02): $175.00 ($0.035/pc)
* Bulk Mail Prep (S-08): $85.00 ($0.017/pc)
* Mail Services Total: $295.00 ($0.059/pc • pass-through)

TOTAL QUOTE: $1,091.29 ($0.2183/pc)
(Postage billed at actual USPS cost)

=== COMMON MISTAKES TO AVOID ===

TIER SELECTION:
- ❌ 500 qty using 4.56× → ✅ Use 5.30× (251-500 tier)
- ❌ 10,000 qty using 2.20× → ✅ Use 3.00× (2,501-10,000 tier)

COLOR/CLICKS:
- ❌ 4/4 = 4 clicks → ✅ 4/4 = 2 sides (front+back)

COST CALCULATION:
- ❌ Adding finishing to postcards → ✅ Postcards = Paper + Clicks ONLY
- ❌ Marking up mail services → ✅ Pass-through at face value
- ❌ Estimating postage → ✅ Always "Actual USPS cost"

=== RESPONSE STYLE ===

- Be fast and direct with quotes
- Always show full cost breakdown
- Include per-piece pricing on every line
- Mention equipment being used
- Suggest alternatives when relevant
- For mailing, default to "Print + Mail" option
- Be professional but conversational`,
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
              <p className="text-xs text-neutral-500">Production AI Agent • Ultra-Fast Inline Mode ⚡</p>
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
                    Instant quotes with complete MPA knowledge. Zero file reads, maximum speed.
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
                      onClick={() => setInput('2500 #10 window envelopes with 4/0 printing')}
                      className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="text-blue-500 mr-2">→</span>
                      Envelope printing quote ⚡
                    </button>
                    <button
                      onClick={() => setInput('1000 16-page saddle stitch booklets 8.5x11')}
                      className="group w-full text-left px-5 py-3 rounded-xl bg-neutral-900/50 border border-neutral-800/60 hover:border-neutral-700 hover:bg-neutral-900 transition-all text-sm text-neutral-300 hover:text-neutral-100"
                    >
                      <span className="text-blue-500 mr-2">→</span>
                      Booklet with finishing ⚡
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
                  <p className="text-xs text-neutral-500 pl-3">⚡ Ultra-fast inline processing...</p>
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
                  placeholder="Ask chatMPA anything... envelopes, booklets, mail services, quotes ⚡"
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
            <span className="text-blue-500">⚡ Ultra-Fast Inline Mode</span>
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
