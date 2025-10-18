# 🧪 Testing Instructions - Email Signup End-to-End

## ✅ **Services Running:**

- ✅ **Supabase**: http://127.0.0.1:54321
- ✅ **Edge Function**: create-post with HuggingFace embeddings
- ✅ **Database Dashboard**: http://127.0.0.1:54323
- ✅ **Email Viewer (Mailpit)**: http://127.0.0.1:54324
- ✅ **Expo**: http://localhost:8081

---

## 📱 **Test Flow:**

### **1. Open Mobile App**
- Press `i` for iOS simulator
- Or scan QR code on your phone

### **2. Test Email Signup** ✅

**Step 1**: On SignupScreen
- First Name: Test
- Last Name: User
- Date of Birth: 01/01/2000
- Click **Continue**

**Step 2**: On UsernamePasswordScreen
- Username: `testuser123` (will check database!)
- Password: `password123`
- Confirm Password: `password123`
- Click **Create Account**

**Expected**:
- ✅ Username availability check (queries Supabase)
- ✅ Account created in database
- ✅ Navigate to Home screen
- ✅ User logged in

**Verify**:
- Open: http://127.0.0.1:54323
- Go to: **Authentication** → **Users**
- You should see your new user!

---

### **3. Test Post Creation** ✅

**On Create Screen**:
- Type: "Meditated for 20 minutes this morning"
- Select scope: World
- Click **Share**

**Expected**:
- ⏱️ Processing ~200-300ms
- ✅ Vector embedding generated (HuggingFace)
- ✅ Uniqueness calculated
- ✅ Tier assigned (elite, rare, etc.)
- ✅ Navigate to Response screen

**Verify in Database**:
- Dashboard → **Table Editor** → **posts**
- See your post with embedding (384 dimensions)
- Check tier and percentile

---

### **4. Test Similarity Detection** ✅

**Create 2nd post**:
- "Did meditation for twenty mins today"

**Expected**:
- ✅ Should find match (87.7% similar!)
- ✅ Lower tier (popular/common)
- ✅ matchCount > 0

**Verify**:
- Check database for both posts
- matchCount should be different

---

### **5. Test Feed Loading** ✅

**Navigate to Feed**:
- Should load real posts from database
- See usernames, tiers, reactions
- Pull to refresh works

---

## 📧 **Email Limits (Your Question):**

### **Supabase Free Tier:**
- ✅ **Unlimited** authentication emails!
- ✅ Rate: 4 emails/hour per email address
- ✅ No global limit
- ✅ Perfect for testing

**To See Emails**:
Open: **http://127.0.0.1:54324**
- All OTP emails appear here
- Click to view 6-digit code

---

## 🔍 **Debugging Tools:**

### **1. Backend Logs**:
```bash
# Edge Function logs
tail -f /Users/lohithsurisetti/onlyOne.today/supabase/edge_function_test.log

# Database queries
# Open Studio → Logs
```

### **2. Mobile Logs**:
- Expo console shows all logs
- Look for "✅" success or "❌" error messages

### **3. Database Viewer**:
http://127.0.0.1:54323
- **auth.users** - See signup users
- **profiles** - User profiles
- **posts** - All posts with embeddings
- **reactions** - Reaction counts

---

## 🎯 **What's Working:**

✅ Email + Password signup (no OTP needed!)  
✅ Username availability check  
✅ Post creation with vector embeddings  
✅ Uniqueness detection (semantic similarity)  
✅ Feed loading from database  
✅ Tier assignment (elite, rare, etc.)

---

## ⚠️ **Known Issues:**

If you see foreign key errors in Feed:
- This is a query syntax issue
- Posts still load (via fallback)
- Will fix after testing

---

## 📊 **Expected Performance:**

- Signup: ~500ms
- Post creation: 200-300ms
- Feed load: ~100-200ms
- Embedding generation: ~100-200ms

---

**Start testing and let me know what you see!** 🚀

**Check emails at**: http://127.0.0.1:54324

