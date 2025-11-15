# Dream Text Processing Flow

## Complete Flow: What Happens to Dream Text at Each Stage

```
┌─────────────────────────────────────────────────────────────────┐
│ STAGE 1: USER SUBMISSION                                        │
└─────────────────────────────────────────────────────────────────┘
📍 Location: Mobile App → API Endpoint
📝 Input: Raw dream text from user
🔧 Action: 
   - User types dream content
   - Submits via CreateDreamScreen
   - Sent to: POST /functions/v1/create-dream-post

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 2: API ENDPOINT RECEIVES                                  │
└─────────────────────────────────────────────────────────────────┘
📍 Location: supabase/functions/create-dream-post/index.ts (line 53)
📝 Input: Raw dream text in request body
🔧 Action:
   - Parse JSON request body
   - Extract: content, dreamType, clarity, scope, etc.
   - Trim whitespace: content.trim() (line 103)
   - Validate required fields (line 70)
   - Validate clarity range 1-10 (line 84)

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 3: DREAM POST SERVICE INITIALIZATION                      │
└─────────────────────────────────────────────────────────────────┘
📍 Location: DreamPostService.createDreamPost() (line 43)
📝 Input: Trimmed dream text
🔧 Action:
   - Initialize services (moderation, matching, interpretation)
   - Validate request structure (line 48)

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 4: CONTENT MODERATION                                     │
└─────────────────────────────────────────────────────────────────┘
📍 Location: ModerationPipeline.moderateContent() (line 57)
📝 Input: Dream text content
🔧 Action:
   - Check for toxic/inappropriate content
   - Validate content length
   - Check for spam patterns
   - Result: approved/rejected
   ⚠️ If rejected → Stop, return error

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 5: AI EXTRACTION (SYMBOLS & EMOTIONS)                     │
└─────────────────────────────────────────────────────────────────┘
📍 Location: AIDreamExtractionService.extractDreamElements() (line 86)
📝 Input: Dream text content
🔧 Action:
   - Send dream text to OpenAI (gpt-4o-mini)
   - AI analyzes text and extracts:
     * Symbols (e.g., "bleeding", "pain", "abdomen")
     * Emotions (e.g., "fear", "anxiety", "shock")
     * Themes (e.g., "physical trauma", "vulnerability")
     * Dream type validation
     * Intensity score
   - Returns structured JSON with extracted data
   - Fallback: Pattern matching if AI fails

📊 Output:
   - processedSymbols: ["bleeding", "pain", "internal_organs", ...]
   - processedEmotions: ["fear", "anxiety", "shock", ...]

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 6: DREAM MATCHING (V2)                                    │
└─────────────────────────────────────────────────────────────────┘
📍 Location: DreamMatcherV2.findSimilarDreams() (line 140)
📝 Input: 
   - Dream text content
   - Extracted symbols
   - Extracted emotions
   - Dream type, clarity
🔧 Action:
   - Extract keywords from dream text (4+ chars, no stop words)
   - Query database for dreams in same scope
   - Match using:
     * Shared symbols (threshold: 4+)
     * Shared emotions (threshold: 4+)
     * Shared keywords (threshold: 6+)
     * Combined scoring (threshold: 3.0+)
   - Calculate match count and confidence

📊 Output:
   - similarDreams: Array of matched dreams
   - matchCount: Number of matches found
   - totalInScope: Total dreams in scope

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 7: PERCENTILE & TIER CALCULATION                          │
└─────────────────────────────────────────────────────────────────┘
📍 Location: PercentileService.calculateDreamPercentile() (line 166)
📝 Input: Dream post + match results
🔧 Action:
   - Calculate uniqueness percentile based on match count
   - Assign tier: "common", "unique", "rare", "elite"
   - Generate badge and message

📊 Output:
   - tier: "elite" | "rare" | "unique" | "common"
   - percentile: 0-100
   - badge: "🏆" | "⭐" | "✨" | "💫"
   - message: "You're a trailblazer!" etc.

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 8: DREAM INTERPRETATION GENERATION                        │
└─────────────────────────────────────────────────────────────────┘
📍 Location: DreamInterpretationService.interpretDream() (line 179)
📝 Input: 
   - Dream text content
   - Dream type
   - Extracted symbols
   - Extracted emotions
   - Clarity score
🔧 Action:
   - Build dynamic prompt with dream-specific details
   - Send to OpenAI (gpt-3.5-turbo) for interpretation
   - Extract key details (people, actions, objects) from text
   - Generate:
     * Title/Meaning
     * Emotional Guidance
     * Comfort Message
     * Action Advice
     * Hope Message
   - Parse AI response into structured format

📊 Output:
   - interpretation: {
       title: "Physical Pain and Subconscious Memory",
       meaning: "...",
       emotionalGuidance: "...",
       comfortMessage: "...",
       actionAdvice: "...",
       hopeMessage: "..."
     }
   - interpretationText: Formatted string for storage

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 9: EMBEDDING GENERATION (OPTIONAL)                        │
└─────────────────────────────────────────────────────────────────┘
📍 Location: DreamEmbeddingService.generateDreamEmbedding() (line 208)
📝 Input: Dream post object (with content, symbols, emotions)
🔧 Action:
   - Generate embeddings for:
     * Content (full dream text)
     * Symbols (extracted symbols)
     * Emotions (extracted emotions)
   - Combine into weighted average
   - Used for insights/analytics (NOT for matching)

📊 Output:
   - contentEmbedding: [0.123, -0.456, ...] (1536 dimensions)
   - symbolEmbedding: [0.234, -0.567, ...]
   - emotionEmbedding: [0.345, -0.678, ...]
   - combinedEmbedding: [0.234, -0.567, ...]

⚠️ Note: Embeddings are optional - matching works without them

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 10: DATABASE STORAGE                                      │
└─────────────────────────────────────────────────────────────────┘
📍 Location: Supabase database insert (line 216)
📝 Input: All processed dream data
🔧 Action:
   - Insert into `dream_posts` table:
     * content: Original dream text (trimmed)
     * dream_type: "nightmare" | "night_dream" | etc.
     * clarity: 1-10
     * interpretation: Generated interpretation text
     * symbols: Stored in dream_post_symbols (junction table)
     * emotions: Stored in dream_post_emotions (junction table)
     * embeddings: Optional vector embeddings
     * tier, percentile, match_count: Calculated values
     * scope, location: Geographic data

📊 Database Tables:
   - dream_posts (main table)
   - dream_post_symbols (many-to-many with dream_symbols)
   - dream_post_emotions (many-to-many with dream_emotions)
   - dream_matches (links matched dreams)

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 11: SYMBOL & EMOTION STORAGE                              │
└─────────────────────────────────────────────────────────────────┘
📍 Location: Database functions (after main insert)
📝 Input: Extracted symbols and emotions
🔧 Action:
   - Create/lookup symbols in dream_symbols table
   - Create/lookup emotions in dream_emotions table
   - Link to dream post via junction tables:
     * dream_post_symbols
     * dream_post_emotions

📊 Result:
   - Symbols stored for future matching
   - Emotions stored for future matching
   - Enables efficient querying for similar dreams

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 12: MATCH RECORDS CREATION                                │
└─────────────────────────────────────────────────────────────────┘
📍 Location: DreamMatcherV2 (after matching)
📝 Input: Matched dreams
🔧 Action:
   - Create records in dream_matches table
   - Links current dream to similar dreams
   - Stores match confidence and reason

📊 Result:
   - Bidirectional matching relationships
   - Enables "similar dreams" feature

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 13: RESPONSE TO USER                                      │
└─────────────────────────────────────────────────────────────────┘
📍 Location: create-dream-post/index.ts (line 160+)
📝 Input: Complete dream post with all data
🔧 Action:
   - Format response with:
     * Dream post data
     * Match count and similar dreams
     * Tier, percentile, badge
     * Interpretation (if generated)
     * Community stats
   - Return JSON response to mobile app

📊 Response Structure:
   {
     success: true,
     post: { id, content, matchCount, tier, ... },
     interpretation: { title, meaning, ... },
     similarDreams: [...],
     communityData: { ... }
   }

┌─────────────────────────────────────────────────────────────────┐
│ STAGE 14: MOBILE APP DISPLAY                                    │
└─────────────────────────────────────────────────────────────────┘
📍 Location: Mobile App (DreamResponseScreen)
📝 Input: API response
🔧 Action:
   - Display dream interpretation
   - Show match count and tier
   - Show similar dreams (if any)
   - Display insights (meaning, guidance, comfort, etc.)

## Summary: Dream Text Transformations

1. **Raw Text** → User input
2. **Trimmed Text** → content.trim()
3. **Moderated Text** → Content validation
4. **AI Analysis** → Symbols + Emotions extracted
5. **Keyword Extraction** → Keywords for matching (4+ chars)
6. **Interpretation** → AI-generated insights
7. **Embeddings** → Vector representations (optional)
8. **Stored Text** → In database (dream_posts.content)
9. **Display Text** → Formatted for user interface

## Key Processing Points

- **AI Extraction**: Happens once, extracts symbols/emotions
- **Matching**: Uses symbols + emotions + keywords (NO embeddings)
- **Interpretation**: Separate AI call for user insights
- **Embeddings**: Optional, for analytics only
- **Storage**: Original text preserved, metadata stored separately

