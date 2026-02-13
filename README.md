# LinkVault - Real-time Bookmark Manager

A modern, real-time bookmark manager built with Next.js, Supabase, and Tailwind CSS. Features Google OAuth authentication, instant synchronization across tabs, and a clean, responsive interface.

## 🚀 Features

- **Google OAuth Authentication**: Secure sign-in with Google (no email/password)
- **Real-time Synchronization**: Bookmarks update instantly across all open tabs
- **Private by Default**: Each user only sees their own bookmarks (Row Level Security)
- **Responsive Design**: Works seamlessly on mobile, tablet, and desktop
- **Clean UI**: Simple, intuitive interface with Tailwind CSS
- **Production Ready**: Deployed on Vercel with full functionality

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Backend**: Supabase (PostgreSQL, Auth, Realtime)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- Google Cloud Console account (for OAuth)
- Vercel account (for deployment)

## 🔧 Setup Instructions

### 1. Clone and Install

```bash
cd bookmark-manager
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the SQL from `supabase-setup.sql`:

```sql
-- Create bookmarks table
create table bookmarks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  url text not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table bookmarks enable row level security;

-- Create policies
create policy "Users can view their own bookmarks"
  on bookmarks for select using (auth.uid() = user_id);

create policy "Users can insert their own bookmarks"
  on bookmarks for insert with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
  on bookmarks for delete using (auth.uid() = user_id);

-- Enable Realtime (CRITICAL!)
alter table bookmarks replica identity full;
alter publication supabase_realtime add table bookmarks;
```

3. Get your credentials from Project Settings → API

### 3. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://[your-project].supabase.co/auth/v1/callback`
   - `http://localhost:3000/auth/callback`
4. Copy Client ID and Secret to Supabase (Authentication → Providers → Google)

### 4. Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 5. Run Locally

```bash
npm run dev
```

Open http://localhost:3000

### 6. Deploy to Vercel

1. Push code to GitHub
2. Import to Vercel
3. Add environment variables (same as `.env.local` but update `NEXT_PUBLIC_SITE_URL`)
4. Deploy
5. Add Vercel URL to Google OAuth redirect URIs

## 🐛 Problems Encountered & Solutions

### Problem 1: Realtime INSERT Events Not Broadcasting

**Issue**: When adding a bookmark, DELETE events worked across tabs but INSERT events didn't. Both tabs were subscribed (status: SUBSCRIBED) but Tab 2 never received INSERT events.

**Root Cause**: PostgreSQL's replica identity was set to DEFAULT instead of FULL. This meant only the primary key was included in the replication stream, not the full row data needed for Realtime.

**Solution**:
```sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;
```

This tells PostgreSQL to include all column values in the replication stream, which Supabase Realtime requires to broadcast INSERT events.

**Debugging Steps**:
1. Added extensive console logging to track subscription status
2. Verified both tabs showed "SUBSCRIBED" status
3. Confirmed DELETE worked but INSERT didn't
4. Checked Supabase documentation on Realtime requirements
5. Discovered REPLICA IDENTITY FULL requirement

---

### Problem 2: Same-Tab Updates Not Working

**Issue**: When adding a bookmark in Tab 1, it appeared in Tab 2 (via Realtime) but not in Tab 1 itself.

**Root Cause**: Supabase Realtime's `postgres_changes` doesn't broadcast events to the same client that triggered the change. This is by design to prevent duplicate updates.

**Solution**: Implemented a dual-update strategy:
1. **Optimistic Update**: Immediately add bookmark to state in the same tab
2. **Realtime Update**: Other tabs receive via Supabase Realtime

```typescript
// Same tab: Optimistic update
const handleBookmarkAdded = (newBookmark: Bookmark) => {
  bookmarkListRef.current?.addBookmark(newBookmark)
}

// Other tabs: Realtime subscription
supabase.channel('bookmarks')
  .on('postgres_changes', { event: 'INSERT' }, (payload) => {
    setBookmarks(current => [payload.new, ...current])
  })
```

**Additional Backup**: Added broadcast channel as fallback:
```typescript
// Broadcast to other tabs as backup
const channel = supabase.channel(`bookmarks-${user.id}`)
await channel.send({
  type: 'broadcast',
  event: 'bookmark-added',
  payload: data
})
```

---

### Problem 3: React State Update During Render Error

**Issue**: Error: "Cannot update a component (BookmarkManager) while rendering a different component (BookmarkList)"

**Root Cause**: Calling `onBookmarksChange` directly in the render phase instead of in an effect.

**Solution**: Used `useEffect` to sync state changes:
```typescript
// Wrong: Called during render
const updateBookmarks = (newBookmarks) => {
  setBookmarks(newBookmarks)
  onBookmarksChange(newBookmarks) // ❌ Causes error
}

// Correct: Called in effect
useEffect(() => {
  if (onBookmarksChange) {
    onBookmarksChange(bookmarks.length)
  }
}, [bookmarks.length, onBookmarksChange])
```

---

### Problem 4: Bookmark Count Not Updating in Real-time

**Issue**: The bookmark count in the header showed the initial count and didn't update when bookmarks were added/deleted.

**Root Cause**: The header is in a Server Component (page.tsx) which only renders once on the server. It can't have reactive state.

**Solution**: Moved the live count to the BookmarkManager (Client Component):
```typescript
// BookmarkManager.tsx
const [bookmarkCount, setBookmarkCount] = useState(initialBookmarks.length)

// BookmarkList.tsx
useEffect(() => {
  if (onCountChange) {
    onCountChange(bookmarks.length)
  }
}, [bookmarks.length, onCountChange])
```

**Result**: Header shows initial count (stable), collection section shows live count (updates in real-time).


