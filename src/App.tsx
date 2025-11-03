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

  const handleSubmit = async (currentInput = input) => {
    if (!currentInput.trim() && uploadedFiles.length === 0) return;

    setIsLoading(true);
    const userMessage = { role: 'user', content: currentInput };
    setMessages(prev => [...prev, userMessage]);
    setInput('');

    try {
      const client = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      // Build conversation history (last 10 messages)
      const recentMessages = [...messages, userMessage].slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // ===== DETECT IF THIS IS A MAIL LIST CLEANING REQUEST =====
      const isMailListRequest = (
        /clean|mail.?list|mailing.?list|address|standardize|process.?list/i.test(currentInput) &&
        uploadedFiles.some(f => f.name.match(/\.(csv|xlsx|xls)$/i))
      );

      // ===== BUILD CONTAINER CONFIG =====
      const containerConfig = {};
      
      if (isMailListRequest) {
        // Use the mail list processor skill when relevant
        containerConfig.skills = [
          {
            type: 'custom',  // Since you uploaded to Console, it's a custom skill
            skill_id: 'mpa-mail-list-processor',  // This is the skill name from SKILL.md
            version: 'latest'
          }
        ];
      }

      // ===== INLINE PRICING KNOWLEDGE (ALWAYS LOADED) =====
      const stream = await client.beta.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4000,
        temperature: 0,
        betas: ['code-execution-2025-08-25', 'prompt-caching-2024-07-31', 'skills-2025-10-02'],
        ...(Object.keys(containerConfig).length > 0 && { container: containerConfig }),
        system: [
          {
            type: 'text',
            text: `You are chatMPA, an AI assistant for Mail Processing Associates (MPA), a commercial printing and direct mail company in Lakeland, Florida.

CRITICAL MATH RULES (FOLLOW THESE EXACTLY):
1. For quantities 1-500: Use 5% spoilage (×1.05) - NOT 3%!
2. For quantities 501-2,500: Use 3% spoilage (×1.03)
3. For quantities 2,501+: Use 2% spoilage (×1.02)
4. ALWAYS round sheets UP to next whole number
5. **MULTIPLY cost by multiplier - NEVER DIVIDE!**
6. **Quote = Cost × Multiplier (Quote must be LARGER than Cost!)**
7. Show your math verification: "$X,XXX.XX × Y.YY = $Z,ZZZ.ZZ ✓"
8. **If Quote < Cost, you made an error - recalculate!**

CRITICAL POSTAGE RULES (NEVER VIOLATE):
1. NEVER ask "need these mailed?" or "want to add mailing?"
2. NEVER say "I can add postage" or similar phrases
3. NEVER calculate or estimate postage amounts
4. If user asks for postage: "Postage billed at actual USPS cost"
5. For print-only quotes: Only suggest stock upgrades, not mailing
6. When user says "mail it": Auto-add S-01 ($0.007) + S-02 ($0.035) + S-08 ($0.017)

CRITICAL ENVELOPE RULES (NEVER VIOLATE):
1. ALL envelopes print 1-up (one envelope per impression)
2. NEVER impose envelopes on 13×19 sheets
3. NEVER use P-01 or P-06 for envelope printing
4. Use P-04 (color <2K), P-07 (color ≥2K), or P-05 (B&W any qty)
5. Formula: Envelope_cost + (Qty × Spoilage × Sides × Click_rate)
6. NO imposition calculation for envelopes

=== EQUIPMENT & CLICK COSTS ===

DIGITAL PRESSES (for sheets):
- P-01 Iridesse Color: $0.0416/click (premium color, covers, specialty)
- P-06 Nuvera B&W: $0.0027/click (B&W text pages, monochrome work)

ENVELOPE PRESSES (for envelopes only):
- P-04 Versant Color Env: $0.0336/click (color envelopes <2K)
- P-05 Versant B&W Env: $0.0080/click (B&W envelopes, any qty)
- P-07 Colormax Env: $0.0500/click (color envelopes ≥2K)

Click = 1 impression on 1 side of 1 sheet
- 4/0 (front only) = 1 click per sheet
- 4/4 (front + back) = 2 clicks per sheet

ENVELOPE EQUIPMENT SELECTION:
- Color envelopes <2K → P-04 Versant Color Env ($0.0336/click)
- Color envelopes ≥2K → P-07 Colormax Env ($0.0500/click)
- B&W envelopes (any qty) → P-05 Versant B&W Env ($0.0080/click)
- ALL ENVELOPES: Print 1-up (one envelope per impression)
- NO IMPOSITION: Envelopes cannot be imposed on 13×19 sheets

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
- 250 qty = 6.50× (1-250 tier) with 5% spoilage
- 500 qty = 5.30× (251-500 tier) with 5% spoilage ← CRITICAL: 500 is BELOW 501!
- 501 qty = 4.56× (501-1,000 tier) with 3% spoilage
- 10,000 qty = 3.00× (2,501-10,000 tier) with 2% spoilage
- 10,001 qty = 2.20× (10,001-14,999 tier) with 2% spoilage

CRITICAL CALCULATION RULES:
1. ALWAYS verify spoilage tier BEFORE calculating sheets
2. ALWAYS round UP sheets to next whole number
3. ALWAYS verify: Final_quote = Total_cost × Multiplier (show this math!)
4. For 500 qty or less: MUST use 5% spoilage (×1.05)

WORKED EXAMPLE - 500 qty 6×9 postcards, 4/4, 100# Gloss Cover:
Step 1: Imposition = 4-up (verified)
Step 2: Spoilage = 5% because 500 ≤ 500 (NOT 3%!)
Step 3: Sheets = 500 ÷ 4 × 1.05 = 131.25 = 132 sheets (rounded up)
Step 4: Paper = 132 × $0.0965 = $12.74
Step 5: Clicks = 132 × 2 × $0.0416 = $10.98
Step 6: Total cost = $12.74 + $10.98 = $23.72
Step 7: Multiplier = 5.30× (251-500 tier because 500 is in 251-500 range)
Step 8: Quote = $23.72 × 5.30 = $125.72
VERIFY: $23.72 × 5.30 = $125.72 ✓

WORKED EXAMPLE - 10,000 qty #10 Regular envelopes, 1/0:
Step 1: NO imposition - envelopes print 1-up (one per impression)
Step 2: Spoilage = 2% because 10,000 ≥ 2,501
Step 3: Envelopes = 10,000 × 1.02 = 10,200 envelopes
Step 4: Envelope cost = 10,200 × $0.0242 = $246.84
Step 5: Equipment = P-05 Versant B&W Env ($0.0080/click)
Step 6: Clicks = 10,200 × 1 side × $0.0080 = $81.60
Step 7: Total cost = $246.84 + $81.60 = $328.44
Step 8: Multiplier = 2.20× (10,001-14,999 tier)
Step 9: Quote = $328.44 × 2.20 = $722.57 (MULTIPLY - quote > cost!)
VERIFY: $328.44 × 2.20 = $722.57 ✓

WORKED EXAMPLE - 5,000 qty 12-page booklets, 4/4 cover + 4/4 text:
Step 1: Cover = 5,000 × 1.02 spoilage = 5,100 sheets
Step 2: Text = (12-4)÷2 = 4 sheets × 5,000 × 1.02 = 20,400 sheets
Step 3: Cover paper = 5,100 × $0.0408 = $208.08
Step 4: Cover clicks = 5,100 × 2 × $0.0416 = $424.32
Step 5: Text paper = 20,400 × $0.0408 = $832.32
Step 6: Text clicks = 20,400 × 2 × $0.0416 = $1,697.28
Step 7: Finishing = $12.50 + (5,000 × 1.03 × $0.0336) = $185.70
Step 8: Total cost = $208.08 + $424.32 + $832.32 + $1,697.28 + $185.70 = $3,347.70
Step 9: Multiplier = 2.80× (2,501+ booklet tier)
Step 10: Quote = $3,347.70 × 2.80 = $9,373.56 (MULTIPLY - quote > cost!)
VERIFY: $3,347.70 × 2.80 = $9,373.56 ✓ Quote is greater than cost ✓

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
- NEVER ask about postage, NEVER calculate postage, NEVER estimate postage
- NEVER say "I can add postage" or similar phrases
- When user says "mail" or "mail it" → automatically add standard mail services
- Standard mail services: S-01 (NCOA/CASS $0.007) + S-02 (Inkjet $0.035) + S-08 (Bulk Prep $0.017)
- Always state "Postage: Actual USPS cost" with no dollar amount
- If user asks for postage estimate, respond: "Postage varies by list/sortation/entry point - billed at actual USPS cost"

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
   - **CRITICAL: MULTIPLY (not divide)** → Quote = Total_cost × Multiplier
   - **Quote must be LARGER than Cost** (if smaller, you divided - fix it!)
   - Example: $3,347 × 2.80 = $9,371 (NOT $3,347 ÷ 2.80!)

5. VERIFY MATH (MANDATORY):
   - Add up ALL cost components: Paper + Clicks + Finishing = Total
   - Show addition: "$492.15 + $424.32 + $1,030.20 + $1,697.28 + $185.70 = $3,829.65"
   - CRITICAL: Final_quote MUST equal Total_cost × Multiplier
   - Show multiplication: "$3,829.65 × 2.80 = $10,723.02 ✓"
   - **Verify Quote > Cost** (if Quote < Cost, you made an error!)
   - If numbers don't match, RECALCULATE before output
   - Double-check spoilage tier was correct for quantity
   - Use exact arithmetic - no rounding until final quote

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

CALCULATION ERRORS (CRITICAL):
- ❌ Dividing cost by multiplier → ✅ MULTIPLY cost by multiplier!
- ❌ Quote < Cost (losing money!) → ✅ Quote must ALWAYS be > Cost
- ❌ $3,347 ÷ 2.80 = $2,856 → ✅ $3,347 × 2.80 = $9,373
- ❌ Forgetting to verify Quote > Cost → ✅ Always check Quote is larger!

SPOILAGE ERRORS (MOST COMMON):
- ❌ 500 qty using 3% spoilage → ✅ Use 5% spoilage (500 is in 1-500 tier!)
- ❌ 250 qty using 3% spoilage → ✅ Use 5% spoilage (250 is in 1-500 tier!)
- ❌ Forgetting to round sheets up → ✅ Always CEIL() or round up sheets

TIER SELECTION:
- ❌ 500 qty using 4.56× → ✅ Use 5.30× (251-500 tier)
- ❌ 10,000 qty using 2.20× → ✅ Use 3.00× (2,501-10,000 tier)

COLOR/CLICKS:
- ❌ 4/4 = 4 clicks → ✅ 4/4 = 2 sides (front+back)

ENVELOPES (CRITICAL):
- ❌ Imposing envelopes on 13×19 sheets → ✅ Envelopes ALWAYS print 1-up
- ❌ Using P-01 or P-06 for envelopes → ✅ Use P-04, P-05, or P-07 ONLY
- ❌ Calculating imposition for envelopes → ✅ NO imposition, direct 1-up printing
- ❌ 10K B&W env on P-06 at $0.0027/click → ✅ Use P-05 at $0.0080/click

COST CALCULATION:
- ❌ Adding finishing to postcards → ✅ Postcards = Paper + Clicks ONLY
- ❌ Marking up mail services → ✅ Pass-through at face value
- ❌ Estimating postage → ✅ Always "Actual USPS cost"
- ❌ Asking "need these mailed?" on print jobs → ✅ Only offer stock upgrades
- ❌ Saying "I can add postage" → ✅ NEVER mention adding postage

=== RESPONSE STYLE ===

- Be fast and direct with quotes
- Always show full cost breakdown
- Include per-piece pricing on every line
- Mention equipment being used
- Suggest alternatives when relevant (upgrade stock options)
- For print-only: Offer stock upgrades, never mention mailing
- For mailing: Automatically include standard services (NCOA/CASS + Inkjet + Bulk Prep)
- Be professional but conversational
- NEVER mention postage unless user asks, then say "billed at actual USPS cost"`,
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
        setMessages(prev => {
          const newMessages = [...prev];
          if (newMessages[newMessages.length - 1]?.role === 'assistant') {
            newMessages[newMessages.length - 1].content = fullResponse;
          } else {
            newMessages.push({ role: 'assistant', content: fullResponse });
          }
          return newMessages;
        });
      });

      await stream.done();
      
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
      setUploadedFiles([]);
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem('chatmpa-history');
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-2 rounded-xl shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                chatMPA
              </h1>
              <p className="text-xs text-slate-500">AI Assistant • Mail Processing Associates</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={clearHistory}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Clear history"
            >
              <RefreshCw className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Skills Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {skills.map((skill) => (
              <button
                key={skill.id}
                onClick={() => setInput(`Help me ${skill.name.toLowerCase()}`)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg border-2 
                  transition-all whitespace-nowrap hover:scale-105 hover:shadow-md
                  ${skill.color === 'blue' ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' : ''}
                  ${skill.color === 'green' ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : ''}
                  ${skill.color === 'purple' ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100' : ''}
                  ${skill.color === 'orange' ? 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100' : ''}
                  ${skill.color === 'pink' ? 'border-pink-200 bg-pink-50 text-pink-700 hover:bg-pink-100' : ''}
                  ${skill.color === 'teal' ? 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100' : ''}
                `}
              >
                <skill.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{skill.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl mb-4">
                <Sparkles className="w-12 h-12 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">
                Welcome to chatMPA
              </h2>
              <p className="text-slate-600 mb-6">
                Your AI-powered printing & direct mail assistant
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <Calculator className="w-8 h-8 text-blue-600 mb-2" />
                  <h3 className="font-semibold text-slate-800 mb-1">Quick Quotes</h3>
                  <p className="text-sm text-slate-600">Instant pricing for postcards, flyers, booklets & envelopes</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <Database className="w-8 h-8 text-orange-600 mb-2" />
                  <h3 className="font-semibold text-slate-800 mb-1">Clean Lists</h3>
                  <p className="text-sm text-slate-600">Standardize mailing lists for BCC Bulk Mailer</p>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                  <Mail className="w-8 h-8 text-pink-600 mb-2" />
                  <h3 className="font-semibold text-slate-800 mb-1">Direct Mail</h3>
                  <p className="text-sm text-slate-600">Full-service pricing with mail prep & addressing</p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white'
                      : 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  }`}
                >
                  <div className="prose prose-sm max-w-none">
                    {message.content.split('\n').map((line, i) => (
                      <p key={i} className={message.role === 'user' ? 'text-white' : ''}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* File Upload Area */}
      {uploadedFiles.length > 0 && (
        <div className="px-4 py-2 bg-white border-t border-slate-200">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-900">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="hover:bg-blue-100 rounded p-1"
                >
                  <X className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div
        className="bg-white border-t border-slate-200 px-4 py-4"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-5xl mx-auto">
          <div className={`
            flex gap-2 p-3 rounded-2xl border-2 transition-all
            ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-white'}
          `}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              multiple
              accept=".csv,.xlsx,.xls,.pdf,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <Upload className="w-5 h-5 text-slate-600" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
              placeholder="Quote 500 postcards 6x9 4/4..."
              className="flex-1 px-4 py-2 bg-transparent border-none focus:outline-none text-slate-800 placeholder-slate-400"
              disabled={isLoading}
            />
            <button
              onClick={() => handleSubmit()}
              disabled={isLoading || (!input.trim() && uploadedFiles.length === 0)}
              className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">
            Try: "quote 500 6x9 postcards" • "clean this mail list" • "price 10k envelopes"
          </p>
        </div>
      </div>
    </div>
  );
}
