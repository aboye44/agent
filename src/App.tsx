import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, RefreshCw, User } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

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

      // Context depth
      const isQuoteRequest = /\b(quote|price|cost|how much)\b/i.test(currentInput);
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

      // Adaptive token limit
      const isComplex =
        /\b(booklet|fold|EDDM|mailing|mail it|throughout|debug)\b/i.test(currentInput) ||
        currentInput.length > 100 ||
        needsDeepContext;
      const maxTokens = isComplex ? 8000 : 5000;

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

      // STREAM CALL — proper block messages, system, and tool auto
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature: 0,
        betas: ['code-execution-2025-08-25', 'prompt-caching-2024-07-31'],
        tool_choice: { type: 'auto' },
        tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],

        // Pass the user's latest raw text into Python as job_text (so EDDM/mailing detection works)
        system: [
          {
            type: 'text',
            text:
`# Inject latest user message so Python can detect mailing intent (EDDM/Addressed)
job_text = """${currentInput.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$').replace(/"/g, '\\"')}"""
# QUIET MODE by default unless 'debug' appears in user text`,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text:
`You are chatMPA, an AI quoting assistant for Mail Processing Associates (MPA), a commercial printing and direct mail company in Lakeland, Florida.

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

⚠️ MANDATORY: USE PYTHON CODE FOR ALL QUOTE CALCULATIONS ⚠️

When user requests a quote, you MUST:
1. Write Python code using the code_execution tool
2. Calculate ALL numbers in Python (sheets, costs, multipliers, quote)
3. Present the results from your Python calculations
4. NEVER do arithmetic in your head - always use code

⚠️ QUIET MODE (DEFAULT) ⚠️

By default, output ONLY the essential sections:
- Production (equipment, stock, imposition, sheets)
- Cost (internal) - paper, clicks, stitching, overhead, TOTAL COST
- QUOTE (price, multiplier, margin)
- Mail Services (if applicable)
- TOTAL (Printing + Mail Services, if applicable)
- QA SUMMARY

DO NOT print intermediate calculations, reasoning, or verbose explanations UNLESS:
- User types "debug" in their message
- There is an error or warning to communicate

If "debug" is detected in user message:
- Print all intermediate calculations
- Show step-by-step reasoning
- Include detailed breakdowns

Otherwise: Stay concise and focused on final output sections only.

════════════════════════════════════════════════════════════════
⚠️⚠️⚠️ UNIFIED PRINT/MAIL ESTIMATION LOGIC ⚠️⚠️⚠️
════════════════════════════════════════════════════════════════

A) DEVICE RULES (press assignment) - MANDATORY ENFORCEMENT

Color flats & booklets (postcards, flyers, brochures, covers/interiors):
→ Use P-01 Iridesse at $0.0416/side

B/W work (letters, B/W interiors, forms):
→ Use P-06 Nuvera at $0.0027/side

ALL envelopes (any color/B&W):
→ Use Versant ONLY
→ Color (4/4, 4/0): P-04 Versant @ $0.0336/side
→ B/W (1/0, 1/1): P-05 Versant @ $0.0080/side

⚠️ CRITICAL ROUTING GUARD:
If non-envelope flats/booklets route to Versant → throw error
If envelopes route to Iridesse/Nuvera → throw error
Error text: "❌ ERROR: Invalid press routing – envelope-only device rule violated."

Equipment note:
P-07 Colormax Env: Not used at MPA (disabled)

B) FLYER DEFAULT STOCK (auto-apply when stock unspecified)

When product type is "flyer", "brochure", or "sheet" AND user does NOT specify a stock:
→ Default to: Endurance 100# Gloss Text (13×19) @ $0.0505/press sheet
→ Calculate imposition as 2-up with 0.25″ bleed allowance on 13×19 working area

C) CANONICAL SPOILAGE PATH - APPLY EXACTLY ONCE

Implement ONE spoilage function called ONCE per quote:

def compute_press_sheets(product_type, qty, up_count=None, pages=None):
    """
    Returns: (press_sheets, spoilage_pct, spoilage_factor)
    Applies spoilage ONCE based on raw sheets calculation.
    
    Raw sheets:
      - flats (postcard/flyer/brochure): ceil(qty / up_count)
      - booklets: qty * (1 + (pages - 4) / 4)
      - letters/envelopes: qty if up_count is None else ceil(qty / up_count)
    
    Spoilage tiers by qty:
      ≤250: 5%, ≤500: 4%, ≤1000: 3%, ≤2500: 2.5%, >2500: 2%
    """
    global spoilage_applied
    
    if spoilage_applied:
        raise Exception("❌ ERROR: Duplicate spoilage path attempted. Spoilage must be applied exactly once.")
    
    # Calculate raw sheets
    if product_type in ["postcard", "flyer", "brochure"]:
        raw_sheets = math.ceil(qty / up_count)
    elif product_type == "booklet":
        sheets_per_booklet = 1 + (pages - 4) / 4
        raw_sheets = qty * sheets_per_booklet
    elif product_type in ["letter", "envelope"]:
        if up_count is not None and up_count > 1:
            raw_sheets = math.ceil(qty / up_count)
        else:
            raw_sheets = qty
    else:
        raw_sheets = qty
    
    # Apply spoilage ONCE
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
    
    press_sheets = math.ceil(raw_sheets * spoilage_factor)
    spoilage_applied = True
    
    return press_sheets, spoilage_pct, spoilage_factor

D) LETTERS PAPER PATH (choose path, then compute once)

For product_type == "letter" (or 8.5×11 detection):

STEP 1 - Choose paper path BEFORE calling compute_press_sheets:
- Default: pre-cut 8.5×11 @ $0.0125/sheet, effective_up = 1
- If qty ≥ 8000: Compare paper totals (NO spoilage yet)
  - If 11×17 2-up + $60 cheaper: effective_up = 2, per_sheet = $0.00889, cutting = $60
  - Else: stay with pre-cut

STEP 2 - Call compute_press_sheets ONCE with chosen effective_up
STEP 3 - Calculate costs and print path

E) BOOKLET FINISHING REALISM (require pages; add makeready)

When product_type == "booklet":
- REQUIRE total_pages (error if missing)
- Sheets per booklet = 1 + ((total_pages - 4) / 4)
- Add +50 cover makeready sheets
- Finishing: $50 setup + $0.0625/booklet run + $100 overhead
- Volume discount: 0% / 10% / 15% / 20% at <1K / 1K-5K / 5K-10K / 10K+
- NEVER apply folding to stitched booklets

F) ENVELOPES TWO-SIDED CLICKS

sides = 2 if ("4/4" in color or "1/1" in color) else 1
click_cost = press_sheets * sides * click_rate

G) EDDM OVERRIDE (bundling only @ $0.035/pc)

Detect EDDM via: "EDDM", "Every Door", "saturation routes"
If EDDM:
- Suppress S-01, S-02, S-03, S-08
- Output: EDDM Bundling & Paperwork at $0.035/pc + postage note
- Warn if "EDDM with addresses"

H) OFFSET ADVISORY FLAG

Flag when static (no VDP) and:
- Flyers 8.5×11 (4/0 or 4/4) qty ≥ 30K
- Postcards 6.25×9 4/4 qty ≥ 50K  
- Booklets qty ≥ 5K

Print: "💡 Recommendation: Consider offset or trade printing—digital price shown."

I) PROFIT FLOORS (simplified) + QA

Enforce ONLY:
- Postcards/Flyers/Brochures: GM% ≥ 30%
- Booklets: GM% ≥ 35%

NO services-heavy logic.

QA SUMMARY (mandatory, 6 checks):
1. Device routing correct
2. Spoilage applied once
3. Paper cost calculated
4. Click cost calculated
5. GM% meets floor
6. Shop minimum met ($75)

If ANY fail → explicit error, no quote.

════════════════════════════════════════════════════════════════

⚠️ MAILING SERVICES ⚠️

Always show full printing section FIRST, then append mail services:

**EDDM:** $0.035/pc bundling + postage note
**Addressed Mail:**
- Postcards: $0.059/pc
- Self-mailers: $0.109/pc
- Letters: $0.079/pc (1 insert) + $0.01/pc per extra

Print: TOTAL (Printing + [Mail Services/EDDM Bundling]): $X,XXX.XX`,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text:
`════════════════════════════════════════════════════════════════
REFERENCE: STOCK DATABASE & EQUIPMENT
════════════════════════════════════════════════════════════════

=== EQUIPMENT & CLICK COSTS ===

DIGITAL PRESSES:
- P-01 Iridesse Color: $0.0416/click (for 4/0, 4/1, 4/4)
- P-06 Nuvera B&W: $0.0027/click (for 1/0, 1/1)

ENVELOPE PRESSES:
- P-04 Versant Color Env: $0.0336/click (color envelopes)
- P-05 Versant B&W Env: $0.0080/click (B&W envelopes)
- P-07 Colormax Env: Not used at MPA (disabled)

=== COMPLETE MPA STOCK DATABASE (All 99 SKUs) ===

# LETTER/COPY PAPER SELECTION LOGIC
When quoting letters (8.5×11), follow this decision tree:

1. IF user explicitly specifies a stock (e.g., "100# gloss text", "Endurance 100# gloss", "premium paper"):
   → HONOR their request - use the specified stock
   → Some letters require premium paper (letterhead, marketing, certificates)
   → Example: "letters on 100# gloss text" → Use SKU 10735823 @ $0.0505
   
2. IF user gives generic request (e.g., "letters 4/0", "letters on white paper", "60# white text"):
   → DEFAULT to: Williamsburg 60# Smooth Offset @ $0.0125/sheet (SKU 63352)
   → Pre-cut to 8.5×11 (no waste, no cutting labor)
   → Best total cost for standard letter printing
   
3. The system KNOWS about cheaper 11×17 2-up options (SKU 66020 @ $0.00889/letter, SKU 66022 @ $0.0245/letter)
   BUT these require ~$60 in cutting labor which makes them MORE expensive than pre-cut Williamsburg
   
4. Text stocks (80#-100# gloss/silk) are valid for BOTH:
   - Booklet interiors (standard use)
   - Premium letters (when explicitly requested)

LETTER PAPER STOCKS:
SKU 63352: Williamsburg 60# Smooth @ $0.0125 (8.5×11) ⭐ DEFAULT
SKU 10003756: Williamsburg 60# Smooth @ $0.0126 (8.5×11) 
SKU 67041: Lettermark 24# Bond @ $0.01253 (8.5×11)
SKU 66020: Report Premium 20# @ $0.00889 (11×17, yields 2 letters, +$60 cutting)
SKU 66022: Report Premium 24# @ $0.0245 (11×17, yields 2 letters, +$60 cutting)
SKU 10003562: Hammermill 20# Salmon @ $0.01368 (8.5×11)
SKU 10003566: Hammermill 20# Lilac @ $0.01368 (8.5×11)
SKU 67494: Lettermark 60# Canary @ $0.01524 (8.5×11)
SKU 67491: Lettermark 60# Blue @ $0.01545 (8.5×11)
SKU 60782: Classic Linen 24# Solar White @ $0.03927 (8.5×11, premium letterhead)
SKU 60700: Classic Linen 24# Haviland Blue @ $0.04605 (8.5×11, premium letterhead)

TEXT STOCKS (for booklet interiors):
SKU 10735824: Endurance 80# Gloss @ $0.0408 (13×19)
SKU 10735823: Endurance 100# Gloss @ $0.0505 (13×19) ⭐ MOST POPULAR
SKU 10735917: Endurance 100# Silk @ $0.0505 (13×19)
SKU 10735918: Endurance 80# Silk @ $0.0408 (13×19)
SKU 10724354: Accent 70# Smooth @ $0.03998 (12×18, budget option)
SKU 68554: Accent 80# Smooth @ $0.04569 (12×18)
SKU 10735718: Endurance 100# Gloss @ $0.0537 (28×40, 4-up)
SKU 10735849: Endurance 100# Silk @ $0.083775 (24×36, 2-up)
SKU 10735863: Endurance 80# Silk @ $0.0435 (28×40, 4-up)
SKU 10728504: Accent 100# Smooth @ $0.069095 (28×40, 4-up)
SKU 10735732: Endurance 70# Gloss @ $0.06445 (19×25)
SKU 10439589: Flo 100# Dull @ $0.090575 (25×38, 2-up)
SKU 64768: Classic Crest 80# Solar White @ $0.14912 (12×18, premium)
SKU 33110: Classic Crest 70# Natural White @ $0.53186 (23×35, premium)
SKU 10755110: Starbrite 70# Smooth @ $0.06542 (23×35, 2-up)

COVER STOCKS (postcards/booklet covers):
SKU 10735784: Endurance 100# Gloss @ $0.0965 (19×13) ⭐ DEFAULT booklet cover
SKU 1.10594E+11: Kallima 14pt C2S @ $0.123 (19×13) ⭐ MOST POPULAR postcard
SKU 20033067: Endurance 130# Silk @ $0.1331 (28×40, 4-up, premium thick)
SKU 10911756: Endurance 80# Silk @ $0.0772 (19×13)
SKU 10735904: Endurance 100# Silk @ $0.0956 (26×40, 4-up)
SKU 68574: Accent 100# Smooth @ $0.1232 (19×13)
SKU 10724395: Accent 100# Smooth @ $0.1285 (19×13)
SKU 68573: Accent 80# Smooth @ $0.0951 (19×13)
SKU 68666: Accent 120# Smooth @ $0.1787 (19×13, extra thick)
SKU 45712: Cougar 100# Smooth @ $0.15595 (19×13)
SKU 45662: Cougar 100# Smooth @ $0.613 (26×40)
SKU 45671: Cougar 100# Natural @ $0.6181 (26×40)
SKU 45670: Cougar 130# Smooth @ $1.1314 (26×40)
SKU 45848: Cougar 130# Natural @ $1.0843 (26×40)
SKU 60233: Classic Crest 100# Solar White @ $0.36155 (18×12, premium)
SKU 13050: Cougar 80# Natural @ $0.2431 (25×38)
SKU 10002315: Springhill 67# Cream @ $0.05596 (11×17)
SKU 100543434: Exact 90# Yellow @ $0.05482 (11×17)
SKU 67508: Lettermark 60# Gray @ $0.03282 (11×17)
SKU 41928: Classic Linen 80# Solar White @ $1.18235 (26×40, premium)

ENVELOPES:
#10 Standard:
SKU 10766056: Seville 24# @ $0.0242 ⭐ DEFAULT
SKU 11142578: Seville 24# Hi Brite @ $0.0242
SKU 083440N: MAC 24# @ $0.02321
SKU 083620N: MAC 24# Tint @ $0.03855
SKU 88320: Capitol Bond 24# Cockle @ $0.10498 (premium)

#10 Window:
SKU 083688N: DigiMAC 24# Window @ $0.03316 ⭐ DEFAULT window
SKU 083672N: Unknown 24# Right Window @ $0.0384
SKU 083452N: MAC 24# Window Peel & Seal @ $0.066
SKU 082410N: MAC 24# #9 Window @ $0.0302

#10 Peel & Seal:
SKU 083450N: MAC 24# Peel & Seal @ $0.0585
SKU 82633: Manta 24# Peel & Seal @ $0.05783

#10 Double Window:
SKU 10691497: Printmaster 24# @ $0.05155

#9 Standard:
SKU 10766047: Seville 24# @ $0.02384 ⭐ DEFAULT
SKU 11142595: Seville 24# Hi Brite @ $0.0242
SKU 082200N: MAC 24# @ $0.02384

Other Sizes:
SKU 081460N: MAC 24# #6.75 Remittance @ $0.03977
SKU 0841455N: MAC 24# #6.75 @ $0.02479
SKU 081511N: MAC 24# #6.75 Side Seam @ $0.02479
SKU 081840N: MAC 24# #7 @ $0.04746
SKU 081850N: MAC 24# #7.75 @ $0.04396

Booklet Envelopes:
SKU 20001992: Seville 24# 6×9 @ $0.027 ⭐ DEFAULT
SKU 081289N: MAC 24# 6×9.5 @ $0.04208
SKU 081580N: MAC 28# 6×9 @ $0.03856
SKU 088792N: Unknown 24# 6×9 Window @ $0.05216
SKU 081776N: Unknown 24# 6×9.5 Window @ $0.05199
SKU 10947872: Seville 24# 9×12 @ $0.0627

Catalog Envelopes:
SKU 087268N: MAC 28# 9×12 Peel & Seal @ $0.1231
SKU 083149N: DigiMAC 28# 9×12 Window @ $0.12007

Announcement Envelopes:
SKU 087427N: Waverly Hall 70# A-7 @ $0.06312
SKU 087426N: Waverly Hall 70# A-6 @ $0.05741
SKU 087424N: Waverly Hall 70# A-2 @ $0.05307
SKU 087436N: Waverly Hall 70# A-9 @ $0.11046
SKU 087430N: Waverly Hall 70# #4 Baronial @ $0.05503
SKU 087548N: Waverly Hall 70# A-7 Soft Ivory @ $0.06692

=== STOCK CONVERSION TABLE (Points ↔ Pound Weight) ===

COVER STOCK CONVERSIONS:
- 10pt cover = 80# cover (Endurance 80# Gloss @ $0.0951)
- 12pt cover = 100# cover (Endurance 100# Gloss @ $0.0965 OR Kallima 14pt @ $0.123)
- 14pt cover = 120# cover (Kallima 14pt C2S @ $0.123)
- 16pt cover = 130# cover (Endurance 130# Silk @ $0.1331)

TEXT STOCK CONVERSIONS:
- 60# text = standard (Endurance 80# @ $0.0408)
- 80# text = Endurance 80# Gloss @ $0.0408
- 100# text = Endurance 100# Gloss @ $0.0505

=== PAPER SELECTION DEFAULTS ===

LETTERS (8.5×11): SKU 63352 (Williamsburg 60# @ $0.0125)
POSTCARDS/FLYERS: SKU 1.10594E+11 (Kallima 14pt @ $0.123)
BOOKLET COVERS: SKU 10735784 (Endurance 100# Gloss @ $0.0965)
BOOKLET TEXT: SKU 10735823 (Endurance 100# Gloss @ $0.0505)
ENVELOPES #10: SKU 10766056 (Seville 24# @ $0.0242)

=== PRICING TIERS ===

POSTCARDS/FLYERS (7-tier):
1-250: 5.50×, 251-500: 4.50×, 501-1K: 3.80×, 1K-2.5K: 3.30×, 2.5K-10K: 3.00×, 10K-15K: 2.50×, 15K+: 2.20×

ENVELOPES (5-tier):
1-250: 5.00×, 251-500: 4.00×, 501-1K: 3.50×, 1K-5K: 3.00×, 5K+: 2.50×

BOOKLETS (6-tier):
1-250: 4.00×, 251-500: 3.00×, 501-1K: 2.80×, 1K-2.5K: 2.60×, 2.5K-10K: 2.40×, 10K+: 2.20×

LETTERS (4-tier):
1-250: 4.50×, 251-1K: 3.50×, 1K-5K: 3.00×, 5K+: 2.50×

SHOP MINIMUM: $75.00`,
            cache_control: { type: 'ephemeral' }
          },
          {
            type: 'text',
            text:
`════════════════════════════════════════════════════════════════
PYTHON CALCULATION TEMPLATE
════════════════════════════════════════════════════════════════

import math

# job_text already injected by system as the latest user message
spoilage_applied = False
debug_mode = "debug" in job_text.lower() if isinstance(job_text, str) else False

def compute_press_sheets(product_type, qty, up_count=None, pages=None):
    global spoilage_applied
    if spoilage_applied:
        raise Exception("❌ ERROR: Duplicate spoilage path attempted.")
    if product_type in ["postcard", "flyer", "brochure"]:
        raw_sheets = math.ceil(qty / up_count)
    elif product_type == "booklet":
        sheets_per_booklet = 1 + (pages - 4) / 4
        raw_sheets = qty * sheets_per_booklet
    elif product_type in ["letter", "envelope"]:
        if up_count is not None and up_count > 1:
            raw_sheets = math.ceil(qty / up_count)
        else:
            raw_sheets = qty
    else:
        raw_sheets = qty

    if qty <= 250:
        spoilage_factor, spoilage_pct = 1.05, "5%"
    elif qty <= 500:
        spoilage_factor, spoilage_pct = 1.04, "4%"
    elif qty <= 1000:
        spoilage_factor, spoilage_pct = 1.03, "3%"
    elif qty <= 2500:
        spoilage_factor, spoilage_pct = 1.025, "2.5%"
    else:
        spoilage_factor, spoilage_pct = 1.02, "2%"

    press_sheets = math.ceil(raw_sheets * spoilage_factor)
    spoilage_applied = True
    return press_sheets, spoilage_pct, spoilage_factor

# === REQUIRED INPUTS (Claude: parse from conversation) ===
# Provide sane defaults; overwrite from parsed specs
qty = 1000
finished_width = 6
finished_height = 9
color = "4/4"
product_type = "postcard"
total_pages = None  # must be provided for booklets

# Infer simple flags
is_envelope = product_type == "envelope"
is_booklet = product_type == "booklet"
is_letter = product_type == "letter" or (finished_width == 8.5 and finished_height == 11)
is_flyer = product_type in ["flyer", "brochure", "sheet"]

# DEVICE ROUTING
if is_envelope:
    if "4/4" in color or "4/0" in color:
        press, click_rate = "P-04 Versant Color", 0.0336
    elif "1/1" in color or "1/0" in color:
        press, click_rate = "P-05 Versant B&W", 0.0080
    else:
        press, click_rate = "P-05 Versant B&W", 0.0080
elif "1/0" in color or "1/1" in color:
    press, click_rate = "P-06 Nuvera B&W", 0.0027
else:
    press, click_rate = "P-01 Iridesse Color", 0.0416

# STOCK DEFAULT FOR FLYERS (13×19 100# gloss text)
if is_flyer and "stock_cost_per_sheet" not in globals():
    stock_cost_per_sheet = 0.0505
    stock_name = "Endurance 100# Gloss Text (13×19)"

# IMPOSITION
if product_type in ["postcard", "flyer", "brochure"]:
    live_width = finished_width + 0.25
    live_height = finished_height + 0.25
    orient1 = math.floor(13 / live_width) * math.floor(19 / live_height)
    orient2 = math.floor(13 / live_height) * math.floor(19 / live_width)
    up_count = max(orient1, orient2)
elif product_type == "envelope":
    up_count = 1

# LETTERS PAPER PATH
if is_letter:
    effective_up = 1
    per_sheet_cost = 0.0125
    cutting_cost = 0
    paper_path = "pre-cut 8.5×11"
    if qty >= 8000:
        precut_total = qty * 0.0125
        twoup_total = math.ceil(qty / 2) * 0.00889 + 60
        if twoup_total < precut_total:
            effective_up = 2
            per_sheet_cost = 0.00889
            cutting_cost = 60
            paper_path = "11×17 2-up + cut ($60)"
    press_sheets, spoilage_pct, spoilage_factor = compute_press_sheets("letter", qty, effective_up)

# BOOKLETS (require pages)
if is_booklet:
    if total_pages is None:
        raise Exception("❌ Missing spec: total pages (including cover)")
    sheets_per_booklet = 1 + (total_pages - 4) / 4
    if sheets_per_booklet != int(sheets_per_booklet):
        raise Exception("❌ Invalid page count: " + str(total_pages))
    press_sheets, spoilage_pct, spoilage_factor = compute_press_sheets("booklet", qty, pages=total_pages)
    cover_sheets = math.ceil(qty * 1 * spoilage_factor)
    interior_sheets = math.ceil(qty * ((total_pages - 4) / 4) * spoilage_factor)
    cover_sheets_with_makeready = cover_sheets + 50

# NON-LETTER/BOOKLET SPOILAGE
if not is_letter and not is_booklet:
    press_sheets, spoilage_pct, spoilage_factor = compute_press_sheets(
        product_type=product_type,
        qty=qty,
        up_count=up_count if product_type in ["postcard", "flyer", "brochure"] else None
    )

# COSTS
if is_booklet:
    stock_cost_cover = 0.0965
    stock_cost_text = 0.0505
    paper_cost = (cover_sheets_with_makeready * stock_cost_cover) + (interior_sheets * stock_cost_text)
    cover_sides = 2 if "4/4" in color else 1
    interior_sides = 2 if "4/4" in color else 1
    click_cost = (cover_sheets_with_makeready * cover_sides * click_rate) + (interior_sheets * interior_sides * click_rate)
    stitch_setup = 50.00
    stitch_run_rate = 0.0625
    overhead = 100.00
    base_finishing = stitch_setup + (qty * stitch_run_rate) + overhead
    if qty >= 10000: discount = 0.20
    elif qty >= 5000: discount = 0.15
    elif qty >= 1000: discount = 0.10
    else: discount = 0.00
    finishing_cost = base_finishing * (1 - discount)
    total_cost = paper_cost + click_cost + finishing_cost

elif is_envelope:
    stock_cost_per_sheet = 0.0242
    paper_cost = press_sheets * stock_cost_per_sheet
    sides = 2 if ("4/4" in color or "1/1" in color) else 1
    click_cost = press_sheets * sides * click_rate
    total_cost = paper_cost + click_cost

elif is_letter:
    paper_cost = (press_sheets * per_sheet_cost) + cutting_cost
    sides = 1 if ("4/0" in color or "1/0" in color) else 2
    click_cost = press_sheets * sides * click_rate
    total_cost = paper_cost + click_cost

else:
    paper_cost = press_sheets * stock_cost_per_sheet
    sides = 2 if ("4/4" in color or "1/1" in color) else 1
    click_cost = press_sheets * sides * click_rate
    total_cost = paper_cost + click_cost

# MULTIPLIER
if product_type == "booklet":
    if qty <= 250: multiplier = 4.00
    elif qty <= 500: multiplier = 3.00
    elif qty <= 1000: multiplier = 2.80
    elif qty <= 2500: multiplier = 2.60
    elif qty <= 10000: multiplier = 2.40
    else: multiplier = 2.20
elif product_type in ["postcard", "flyer", "brochure"]:
    if qty <= 250: multiplier = 5.50
    elif qty <= 500: multiplier = 4.50
    elif qty <= 1000: multiplier = 3.80
    elif qty <= 2500: multiplier = 3.30
    elif qty <= 10000: multiplier = 3.00
    elif qty <= 15000: multiplier = 2.50
    else: multiplier = 2.20
#elif product_type == "envelope":
#  (if you need envelope-specific tiers, keep as above or reuse)
elif product_type == "envelope":
    if qty <= 250: multiplier = 5.00
    elif qty <= 500: multiplier = 4.00
    elif qty <= 1000: multiplier = 3.50
    elif qty <= 5000: multiplier = 3.00
    else: multiplier = 2.50
elif product_type == "letter":
    if qty <= 250: multiplier = 4.50
    elif qty <= 1000: multiplier = 3.50
    elif qty <= 5000: multiplier = 3.00
    else: multiplier = 2.50
else:
    if qty <= 250: multiplier = 5.50
    elif qty <= 500: multiplier = 4.50
    elif qty <= 1000: multiplier = 3.80
    elif qty <= 2500: multiplier = 3.30
    elif qty <= 10000: multiplier = 3.00
    elif qty <= 15000: multiplier = 2.50
    else: multiplier = 2.20

quote = total_cost * multiplier

# SHOP MINIMUM
shop_minimum = 75.00
if quote < shop_minimum:
    quote = shop_minimum

margin_pct = ((quote - total_cost) / quote) * 100

# ALWAYS PRINT FINAL SECTIONS (Quiet mode keeps it concise)
print("Quote: $" + format(quote, '.2f'))
print("\\nProduction:")
print("* Equipment: " + press)
if 'stock_name' in globals():
    print("* Stock: " + stock_name)
if product_type in ["postcard", "flyer", "brochure"]:
    print("* Imposition: " + str(up_count) + "-up")
print("* Press Sheets: " + str(press_sheets) + " (includes " + spoilage_pct + " spoilage)")

print("\\nCost (internal):")
print("* Paper: $" + format(paper_cost, '.2f') + " ($" + format(paper_cost/qty, '.4f') + "/pc)")
print("* Clicks: $" + format(click_cost, '.2f') + " ($" + format(click_cost/qty, '.4f') + "/pc)")
if is_booklet:
    print("* Stitching: $" + format(finishing_cost, '.2f') + " ($" + format(finishing_cost/qty, '.4f') + "/pc)")
    print("* Overhead/QC: $100.00")
else:
    print("* Stitching: $0.00 ($0.0000/pc)")
    print("* Overhead/QC: $0.00")
print("* TOTAL COST: $" + format(total_cost, '.2f') + " ($" + format(total_cost/qty, '.4f') + "/pc)")

print("\\nQUOTE: $" + format(quote, '.2f') + " ($" + format(quote/qty, '.4f') + "/pc • " + str(multiplier) + "× • " + str(int(margin_pct)) + "% margin)")

# MAIL SERVICES OUTPUT
job_text_l = job_text.lower() if isinstance(job_text, str) else ""
wants_mailing = any(k in job_text_l for k in [" mail", "with mailing", "add mailing", "mail it", "mailing"])
is_eddm = any(k in job_text_l for k in ["eddm", "every door", "saturation route", "saturation"])

mailing_services_total = 0.0
mailing_section = ""

if wants_mailing:
    if is_eddm:
        bundling = qty * 0.035
        mailing_services_total += bundling
        mailing_section += "\\nMail Services (EDDM):\\n"
        mailing_section += "• EDDM Bundling & Paperwork: " + format(qty, ',') + " × $0.035 = $" + format(bundling, '.2f') + "\\n"
        mailing_section += "• Postage: USPS EDDM postage billed at actuals (not calculated)\\n"
    else:
        if product_type in ["postcard"]:
            svc = qty * 0.059
            mailing_services_total += svc
            mailing_section += "\\nMail Services (Addressed):\\n"
            mailing_section += "• NCOA/CASS + Addressing + Bulk Prep: " + format(qty, ',') + " × $0.059 = $" + format(svc, '.2f') + "\\n"
            mailing_section += "• Postage billed at actual USPS cost (not calculated)\\n"
        elif product_type in ["flyer", "brochure"]:
            svc = qty * 0.109
            mailing_services_total += svc
            mailing_section += "\\nMail Services (Self-mailer):\\n"
            mailing_section += "• Addressing + Double Tab + Flats Prep: " + format(qty, ',') + " × $0.109 = $" + format(svc, '.2f') + "\\n"
            mailing_section += "• Postage billed at actual USPS cost (not calculated)\\n"
        elif product_type == "letter" or is_letter:
            num_inserts = 1
            base = 0.079 if num_inserts == 1 else 0.079 + 0.01 * (num_inserts - 1)
            svc = qty * base
            mailing_services_total += svc
            mailing_section += "\\nMail Services (Letters):\\n"
            mailing_section += "• NCOA + Address + Machine Insert (" + str(num_inserts) + " piece): " + format(qty, ',') + " × $" + format(base, '.3f') + " = $" + format(svc, '.2f') + "\\n"
            mailing_section += "• Postage billed at actual USPS cost (not calculated)\\n"

if mailing_services_total > 0:
    print(mailing_section)
    total_due = quote + mailing_services_total
    label = "EDDM Bundling" if is_eddm else "Mail Services"
    print("TOTAL (Printing + " + label + "): $" + format(total_due, ',.2f'))

if "eddm" in job_text_l and ("address" in job_text_l or "addresses" in job_text_l):
    print("\\n⚠️ EDDM campaigns are non-addressed saturation mail. For addressed mail, select Marketing Mail or First-Class instead.")

# OFFSET ADVISORY FLAG
is_static = True
if is_static:
    if product_type in ["flyer", "brochure"] and finished_width == 8.5 and finished_height == 11:
        if ("4/0" in color or "4/4" in color) and qty >= 30000:
            print("\\n💡 Recommendation: Consider offset or trade printing—digital price shown.")
    elif product_type == "postcard" and finished_width == 6.25 and finished_height == 9:
        if "4/4" in color and qty >= 50000:
            print("\\n💡 Recommendation: Consider offset or trade printing—digital price shown.")
    elif product_type == "booklet" and qty >= 5000:
        print("\\n💡 Recommendation: Consider offset or trade printing—digital price shown.")

# PROFIT FLOORS
gm_floor_met = True
if product_type in ["postcard", "flyer", "brochure"]:
    if margin_pct < 30:
        print("\\n⚠️ WARNING: GM below 30% floor for postcards/flyers")
        gm_floor_met = False
elif product_type == "booklet":
    if margin_pct < 35:
        print("\\n⚠️ WARNING: GM below 35% floor for booklets")
        gm_floor_met = False

# QA SUMMARY (6 checks)
qa_checks_total = 6
qa_checks_passed = 0
device_ok = True
if is_envelope:
    if press not in ["P-04 Versant Color", "P-05 Versant B&W"]:
        device_ok = False
        print("\\n❌ QA FAIL: Envelope routed to non-Versant device")
else:
    if "Versant" in press:
        device_ok = False
        print("\\n❌ QA FAIL: Non-envelope routed to Versant")
if device_ok: qa_checks_passed += 1
if spoilage_applied: qa_checks_passed += 1
else: print("\\n❌ QA FAIL: Spoilage not applied")
if paper_cost > 0: qa_checks_passed += 1
else: print("\\n❌ QA FAIL: Paper cost is zero")
if click_cost > 0: qa_checks_passed += 1
else: print("\\n❌ QA FAIL: Click cost is zero")
if gm_floor_met: qa_checks_passed += 1
if quote >= shop_minimum: qa_checks_passed += 1
else: print("\\n❌ QA FAIL: Quote below shop minimum")

print("\\n═══════════════════════════════════════════")
print("QA SUMMARY")
print("═══════════════════════════════════════════")
print("• Device: " + press)
print("• Spoilage: " + spoilage_pct)
print("• Press Sheets: " + str(press_sheets))
print("• Paper: $" + format(paper_cost, '.2f'))
print("• Clicks: $" + format(click_cost, '.2f'))
if is_booklet:
    print("• Finishing: $" + format(finishing_cost, '.2f'))
else:
    print("• Finishing: $0.00")
print("• GM%: " + str(int(margin_pct)) + "%")
print("• Checks Passed: " + str(qa_checks_passed) + "/" + str(qa_checks_total))
print("═══════════════════════════════════════════")

if qa_checks_passed < qa_checks_total:
    print("\\n❌ QA FAILED - Quote cannot be issued with failed checks")
    raise Exception("QA checks failed - see above for details")`,
            cache_control: { type: 'ephemeral' }
          }
        ],

        messages: messageBlocks
      });

      // Stream handlers
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

      const finalMessage: any = await stream.finalMessage();

      if (finalMessage && finalMessage.content && finalMessage.content.length > 0) {
        // Extract all content: text blocks AND code execution output
        let completeText = '';

        for (const block of finalMessage.content) {
          if (block.type === 'text') {
            completeText += block.text;
          } else if ((block.type === 'tool_use' || block.type === 'server_tool_use') &&
                     (block.name === 'code_execution' || block.name === 'bash_code_execution')) {
            // Code execution output can be in different properties
            const output = block.output || block.result || block.text || '';
            if (output) {
              completeText += '\n\n' + output;
            }
          }
        }

        // Always update with the complete final text
        if (completeText) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessageId ? { ...msg, content: completeText } : msg
            )
          );
        }
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
