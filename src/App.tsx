import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Copy, RefreshCw, User } from 'lucide-react';
import Anthropic from '@anthropic-ai/sdk';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

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
  const handleScroll = (e) => {
    const container = e.target;
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

⚠️ MANDATORY SPECIFICATION CONFIRMATION - NO EXCEPTIONS ⚠️

BEFORE calculating ANY quote, you MUST confirm:
1. PRINT COLOR (if not specified by user)
2. PAPER STOCK (if not specified by user)

NEVER auto-assume defaults. NEVER calculate until BOTH are confirmed.

CONFIRMATION PROCESS:

STEP 1 - Check what user provided:
- Did they specify color? (e.g., "4/4", "4/0", "1/1")
- Did they specify stock? (e.g., "14pt", "100# gloss", "Kallima")

STEP 2 - Ask about COLOR (if missing):
Present options based on product type:

POSTCARDS/FLYERS:
"What printing do you need?
• 4/4 (full color both sides) ⭐ Most common
• 4/0 (color front, blank back)
• 4/1 (color front, black back)"

LETTERS:
"What printing do you need?
• 4/0 (color front) ⭐ Most common
• 1/0 (black & white)"

ENVELOPES:
"What printing do you need?
• 1/0 (black only) ⭐ Most common
• 4/0 (color front)
• 4/4 (color both sides)"

BOOKLETS:
"What printing do you need?
• 4/4 cover + 1/1 text (color cover, B&W text) ⭐ Most common
• 4/4 throughout (full color cover and text)"

STEP 3 - Wait for user response on color

STEP 4 - Ask about STOCK (if missing):
Present 2-3 relevant options WITH PRICES for THIS specific job:

POSTCARDS/FLYERS:
"Perfect! Stock options for [qty] [size] postcards ([color]):

⭐ MOST POPULAR: Kallima 14pt C2S
• Premium thickness, excellent durability
• Quote: $XXX.XX ($X.XX/pc)

BUDGET: Endurance 100# Gloss Cover
• Standard postcard stock, great quality
• Quote: $XXX.XX ($X.XX/pc)

PREMIUM: Endurance 130# Silk Cover
• Thickest option, luxury feel
• Quote: $XXX.XX ($X.XX/pc)

Which would you prefer?"

LETTERS:
"Perfect! Paper options for [qty] letters ([color]):

⭐ STANDARD: Williamsburg 60# Smooth White
• Standard office paper, pre-cut 8.5×11
• Quote: $XXX.XX ($X.XX/pc)

PREMIUM: Endurance 100# Gloss Text
• Heavier, glossy finish
• Quote: $XXX.XX ($X.XX/pc)

LUXURY: Classic Linen 24# Solar White
• Textured premium letterhead stock
• Quote: $XXX.XX ($X.XX/pc)

Which would you prefer?"

ENVELOPES:
"Perfect! Envelope options for [qty] #10 envelopes ([color]):

⭐ STANDARD: Seville 24# White
• Standard business envelope
• Quote: $XXX.XX ($X.XX/pc)

WINDOW: DigiMAC 24# Window
• Left window for addresses
• Quote: $XXX.XX ($X.XX/pc)

Which would you prefer?"

BOOKLETS (COVER):
"Perfect! Cover stock options for [qty] [page]-page booklets ([color]):

⭐ STANDARD: Endurance 100# Gloss Cover
• Standard booklet cover
• Quote: $XXX.XX ($X.XX/booklet)

PREMIUM: Endurance 130# Silk Cover
• Thicker, luxury feel
• Quote: $XXX.XX ($X.XX/booklet)

Which would you prefer?"

BOOKLETS (TEXT) - Only ask if user specified color text:
"And for the interior pages:

⭐ STANDARD: Endurance 100# Gloss Text
• Standard booklet interior
• Cost included in quote above

BUDGET: Endurance 80# Gloss Text
• Lighter weight, saves $XX
• Quote: $XXX.XX ($X.XX/booklet)

Which would you prefer?"

STEP 5 - Wait for user response on stock

STEP 6 - NOW calculate the final detailed quote using Python

CRITICAL REMINDERS:
- NEVER say "using Python" or "I'll use code" - just say "I'll quote [product] for you"
- NEVER calculate a quote without confirming color AND stock
- ALWAYS present stock options WITH calculated prices for THIS job
- WAIT for user confirmation before proceeding
- If user provides complete specs upfront (color + stock), proceed directly to quote

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
elif product_type == "letter":
    up_count = 1
    print("Letters: 1-up (pre-cut 8.5×11)")

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
if product_type in ["envelope", "letter"]:
    total_units = math.ceil(qty * spoilage_factor)
    sheets = total_units
else:
    sheets = math.ceil((qty / up_count) * spoilage_factor)
print(f"Sheets: {sheets}")

# === COST CALCULATION ===
if product_type in ["envelope", "letter"]:
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
- P-01 Iridesse Color: $0.0416/click (for 4/0, 4/1, 4/4)
- P-06 Nuvera B&W: $0.0027/click (for 1/0, 1/1)

ENVELOPE PRESSES:
- P-04 Versant Color Env: $0.0336/click (color <2K)
- P-05 Versant B&W Env: $0.0080/click (B&W any qty)
- P-07 Colormax Env: $0.0500/click (color ≥2K)

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
   
3. The system KNOWS about cheaper 11×17 2-up options (SKU 66020 @ $0.00445/letter, SKU 66022 @ $0.01225/letter)
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
SKU 105343: CoverIt 16pt Leatherette Black @ $0.01227 (8.5×11, binding)

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

SPECIALTY STOCKS:
Poly/Synthetic:
SKU 65177: Kernowprint 14mil Matte Poly @ $1.12 (12×18)
SKU 65175: Kernowprint 10mil Matte Poly @ $0.86 (12×18)
SKU 105314: CoverIt 5mil Clear Gloss @ $0.01149 (8.5×11, binding)
SKU 105466: CoverIt 10mil Clear Gloss @ $0.03185 (11×17, binding)

Index/Tag:
SKU 63219: Springhill 110# Index @ $0.07225 (11×17)
SKU 73606: Springhill 125# Tag Manila @ $0.32189 (24×36)
SKU 054090N: Excel 7.5pt Carbonless Tag @ $0.08935 (8.5×11)

Carbonless:
SKU 051304N: Excel 2pt White/Pink @ $0.03544 (8.5×11)

Boxes:
SKU 320510: Kraft Box 12.25×9.25×12.5 @ $0.0217
SKU RD4933: Grey Box 4.75×3.5×2 @ $0.11245
SKU RD4932: Mist Grey Box 7×3.5 @ $0.11684

Film:
SKU 1.10026E+11: D&K 3mil Laminating Film @ $207.58 (12" roll)

=== PAPER SELECTION RULES ===

⚠️ STOCK CONVERSION TABLE (Points ↔ Pound Weight):
When user requests by POINT thickness, convert to POUND WEIGHT equivalent:

COVER STOCK CONVERSIONS:
- 10pt cover = 80# cover (we stock: Endurance 80# Gloss @ $0.0951)
- **12pt cover = 100# cover** ✅ WE STOCK THIS (Endurance 100# Gloss @ $0.0965 OR Kallima 14pt @ $0.123)
- 14pt cover = 120# cover (we stock: Kallima 14pt C2S @ $0.123 - most popular!)
- 16pt cover = 130# cover (we stock: Endurance 130# Silk @ $0.1331)

TEXT STOCK CONVERSIONS:
- 60# text = standard text weight (we stock: Endurance 80# @ $0.0408)
- 80# text = 80# text (exact match - Endurance 80# Gloss @ $0.0408)
- 100# text = 100# text (exact match - Endurance 100# Gloss @ $0.0505)

WHEN USER REQUESTS BY POINTS:
1. Check conversion table above
2. If exact equivalent exists in stock → USE IT (no disclaimer needed)
3. Only if no equivalent exists → offer estimated/alternative options

EXAMPLE:
User: "quote 1000 postcards 12pt gloss"
System thinks: "12pt = 100# cover = Endurance 100# Gloss @ $0.0965 ✅ WE HAVE THIS!"
System responds: [Calculate quote normally with 100# Gloss @ $0.0965]
System notes: "Using Endurance 100# Gloss Cover (12pt equivalent)"

FOR LETTERS (8.5×11):
→ DEFAULT: SKU 63352 (Williamsburg 60# @ $0.0125) unless user explicitly requests premium
→ HONOR explicit requests for premium stocks (e.g., "100# gloss text")

FOR POSTCARDS/FLYERS:
→ Default: SKU 1.10594E+11 (Kallima 14pt @ $0.123) - most popular
→ Budget: SKU 10735784 (Endurance 100# Gloss @ $0.0965)
→ Premium: SKU 20033067 (Endurance 130# Silk @ $0.1331)

FOR BOOKLET COVERS:
→ Default: SKU 10735784 (Endurance 100# Gloss @ $0.0965)

FOR BOOKLET TEXT:
→ Default: SKU 10735823 (Endurance 100# Gloss @ $0.0505)
→ Budget: SKU 10735824 (Endurance 80# Gloss @ $0.0408)

FOR ENVELOPES:
→ #10 standard: SKU 10766056 (Seville 24# @ $0.0242)
→ #10 window: SKU 083688N (DigiMAC 24# @ $0.03316)
→ 6×9 booklet: SKU 20001992 (Seville 24# @ $0.027)

=== PRICING TIERS ===

POSTCARDS/FLYERS/ENVELOPES/LETTERS (7-tier):
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

=== FOLDING COSTS ===

WHEN TO APPLY FOLDING:
- Any product described as "brochure", "trifold", "bifold", or "fold"
- Flyers that need folding (e.g., "fold to 8.5×11")
- NEVER apply to booklets (saddle-stitching already includes the fold)

MBO FOLDER RATES (based on volume):
- 1-1,000: $0.025/pc + $20 setup
- 1,001-5,000: $0.020/pc + $25 setup  
- 5,001-10,000: $0.015/pc + $30 setup
- 10,001+: $0.012/pc + $35 setup

=== DESIGN SERVICES ===

DESIGN RATE: $75/hour

=== MAILING SERVICES (PASS-THROUGH - NO MARKUP) ===

COMPLETE SERVICE MENU:
- S-01 NCOA/CASS: $0.007/pc ($10 minimum)
- S-02 Inkjet Addressing (Letter/Postcard): $0.035/pc
- S-03 Inkjet Addressing (Flat): $0.04/pc
- S-04 Machine Inserting (1st piece): $0.02/pc
- S-05 Machine Inserting (Each additional): $0.01/pc
- S-06 Tabbing (Double Tab): $0.035/pc
- S-07 Tabbing (Triple Tab): $0.05/pc
- S-08 Bulk Mail Prep & Traying: $0.017/pc
- S-09 Machine Folding: $0.015/pc ($15 minimum)
- S-10 Collating: $0.02/pc ($15 minimum)
- S-11 Machine Stamping: $0.02/pc
- S-12 Barcode (OCR Processing): $0.035/pc
- S-13 Hand Inserting (1st piece): $0.04/pc
- S-14 Hand Inserting (Each additional): $0.02/pc
- S-15 Hand Sealing: $0.03/pc
- S-16 Hand Stamping: $0.03/pc
- S-17 Marriage Matching (per match): $0.03/pc
- S-18 Hand Folding: $0.06/pc ($20 minimum)

INTELLIGENT MAILING BY PRODUCT TYPE:

**POSTCARDS:**
- S-01: $0.007/pc
- S-02: $0.035/pc (Letter/Postcard addressing)
- S-08: $0.017/pc
TOTAL: $0.059/pc

**FLYERS/BROCHURES (Self-mailers):**
- S-01: $0.007/pc
- S-03: $0.04/pc (Flat addressing)
- S-06: $0.035/pc (Double tab - standard)
- S-08: $0.017/pc
TOTAL: $0.099/pc

**LETTERS (In #10 envelopes):**
Machine insert (standard):
- S-01: $0.007/pc
- S-02: $0.035/pc
- S-04: $0.02/pc (1st piece)
- S-05: $0.01/pc per additional insert
- S-08: $0.017/pc
TOTAL: $0.079/pc (1 sheet) or $0.089/pc (2 sheets)

=== CRITICAL RULES ===

⚠️ HANDLING UNAVAILABLE STOCKS:
FIRST: Check the STOCK CONVERSION TABLE above
- If user requests "12pt gloss" → That's 100# gloss → WE HAVE IT! Use $0.0965
- If user requests "14pt cover" → That's our Kallima 14pt → WE HAVE IT! Use $0.123
- If user requests "16pt cover" → That's 130# cover → WE HAVE IT! Use $0.1331

ONLY IF no conversion equivalent exists, then:

STEP 1 - ALERT & OFFER OPTIONS:
Present user with 3 choices:
A) Use an ESTIMATED cost (interpolated from similar stocks we carry)
B) Switch to a stocked alternative (provide specific options with prices)
C) Adjust specifications

STEP 2 - IF USER CHOOSES ESTIMATED COST:
Calculate interpolated cost based on similar stocks:

Example for 11pt cover (NOT in conversion table):
- We stock: 10pt (80# @ $0.0951)
- We stock: 12pt (100# @ $0.0965)
- Estimated 11pt cost: Average = ($0.0951 + $0.0965) ÷ 2 × 1.10 buffer = ~$0.10/sheet

Provide quote with CLEAR DISCLAIMER:
"⚠️ ESTIMATED QUOTE - 11pt cover is not a standard thickness.
This quote uses an estimated paper cost of $X.XX/sheet based on similar stocks.
Final pricing will be confirmed once we source the specific stock you need."

INTERPOLATION FORMULA:
For weights between stocked options:
- Identify closest lighter stock (cost_light)
- Identify closest heavier stock (cost_heavy)
- Estimate = (cost_light + cost_heavy) ÷ 2
- Add 10% buffer for sourcing: estimate × 1.10

EXAMPLE RESPONSE FOR 12PT REQUEST:
"⚠️ We don't stock 12pt gloss cover in our regular inventory.

I can provide you with:

Option A: ESTIMATED quote using 12pt
• I'll interpolate the paper cost between our 100# gloss (~10pt) and 14pt stocks
• Quote will be flagged as estimated pending stock sourcing confirmation
• Would you like me to calculate this?

Option B: Quote using our stocked alternatives
• Kallima 14pt C2S @ $0.123/sheet (heavier, most popular)
• Endurance 100# Gloss @ $0.0965/sheet (lighter, economical)

Which would you prefer?"

STOCKS WE DO NOT CARRY (but CAN estimate):
- 12pt cover (any finish) - estimate between 100# gloss and 14pt
- 10pt cover (any finish) - estimate from 100# gloss
- 90# text - estimate between 80# and 100#
- Any specific weight/thickness not in database

WAIT for user confirmation before proceeding with EITHER estimated OR alternative stock quote.

SPOILAGE (ALIGNED WITH PRICING):
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
* TOTAL COST: $53.18 ($0.0532/pc)

QUOTE: $242.50 ($0.2425/pc • 4.56× • 78% margin)`,
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
