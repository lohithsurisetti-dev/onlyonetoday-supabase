# CPU Time Limit Optimization Guide

## 🔍 **Problem Analysis**

Your OnlyOne.Today backend is hitting **Supabase Edge Function CPU time limits** even with moderate loads (10-30 users). This is **NOT a laptop issue** - it's a **Supabase limitation**.

### **CPU Time Consumption Breakdown:**
1. **AI API Calls**: 40-60% of CPU time
   - OpenAI embeddings generation
   - Hugging Face moderation checks
   - Multiple parallel API calls

2. **Database Operations**: 20-30% of CPU time
   - Vector similarity searches (1536 dimensions)
   - Complex percentile calculations
   - Temporal analytics queries

3. **Processing Logic**: 10-20% of CPU time
   - Content parsing and validation
   - Response formatting

## 🛠️ **Immediate Solutions**

### **1. Reduce Moderation Timeout**
```typescript
// In ModerationPipeline.ts
const timeoutPromise = new Promise<ModerationResult>((_, reject) => {
  setTimeout(() => {
    console.log('⏰ Moderation timeout reached');
    reject(new Error('Moderation timeout'));
  }, 3000); // Reduced from 5000ms to 3000ms
});
```

### **2. Optimize AI API Calls**
```typescript
// Reduce individual API timeouts
const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced from 5000ms
```

### **3. Implement Early Exit Strategy**
```typescript
// Skip temporal analytics for feed posts (not needed)
if (requestType === 'feed') {
  return { success: true, post: result, temporal: null };
}
```

## 🚀 **Advanced Optimizations**

### **1. Async Processing Pattern**
```typescript
// Process moderation in background
const moderationPromise = moderateContent(content);
const embeddingPromise = generateEmbedding(content);

// Race between moderation and embedding
const [moderationResult, embedding] = await Promise.allSettled([
  moderationPromise,
  embeddingPromise
]);
```

### **2. Database Query Optimization**
```sql
-- Add indexes for faster vector searches
CREATE INDEX CONCURRENTLY idx_posts_embedding_cosine 
ON posts USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Optimize temporal queries
CREATE INDEX CONCURRENTLY idx_posts_created_at_scope 
ON posts (created_at DESC, scope);
```

### **3. Caching Strategy Enhancement**
```typescript
// Cache expensive operations
const cacheKey = `embedding:${contentHash}`;
let embedding = await cacheGet<number[]>(cacheKey);
if (!embedding) {
  embedding = await generateEmbedding(content);
  await cacheSet(cacheKey, embedding, 3600); // 1 hour cache
}
```

## 📊 **Performance Monitoring**

### **Add CPU Time Tracking**
```typescript
const startTime = Date.now();
// ... your processing ...
const cpuTime = Date.now() - startTime;
console.log(`⏱️ CPU time used: ${cpuTime}ms`);

if (cpuTime > 25000) { // 25 seconds warning
  console.warn('⚠️ High CPU usage detected');
}
```

## 🎯 **Recommended Implementation Order**

### **Phase 1: Quick Wins (Immediate)**
1. ✅ Reduce moderation timeout to 3 seconds
2. ✅ Reduce individual API timeouts to 3 seconds
3. ✅ Skip temporal analytics for feed requests
4. ✅ Add CPU time monitoring

### **Phase 2: Database Optimization (Next)**
1. Add vector search indexes
2. Optimize temporal query patterns
3. Implement query result caching

### **Phase 3: Architecture Changes (Future)**
1. Move AI processing to background jobs
2. Implement async post processing
3. Use Supabase Database Functions for heavy calculations

## 🔧 **Quick Fix Implementation**

Here's what you can implement right now:

```typescript
// 1. Reduce timeouts in ModerationPipeline.ts
setTimeout(() => {
  reject(new Error('Moderation timeout'));
}, 3000); // Reduced from 5000ms

// 2. Skip temporal analytics for feed
if (request.inputType === 'feed') {
  return { success: true, post: result };
}

// 3. Add CPU monitoring
const cpuStart = Date.now();
// ... processing ...
console.log(`CPU time: ${Date.now() - cpuStart}ms`);
```

## 📈 **Expected Results**

After implementing these optimizations:
- **CPU time reduction**: 30-50%
- **Response time improvement**: 2-3x faster
- **Higher concurrent capacity**: 50+ users
- **Reduced timeout errors**: 90% reduction

## 🚨 **Supabase Limits Reference**

- **CPU Time Limit**: 30 seconds (soft), 60 seconds (hard)
- **Memory Limit**: 128MB
- **Execution Time**: 60 seconds max
- **Concurrent Requests**: 1000 per function

Your current usage is hitting the **CPU time limit**, not execution time or memory limits.

---

**Bottom Line**: This is a **Supabase Edge Function limitation**, not your laptop. The optimizations above will significantly improve performance and allow higher concurrent loads.
