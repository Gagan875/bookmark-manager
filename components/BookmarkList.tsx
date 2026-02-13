'use client'

import { useEffect, useState, forwardRef, useImperativeHandle } from 'react'
import { createClient } from '@/lib/supabase/client'

type Bookmark = {
  id: string
  url: string
  title: string
  created_at: string
}

type BookmarkListProps = {
  initialBookmarks: Bookmark[]
  userId: string
  onCountChange?: (count: number) => void
}

const BookmarkList = forwardRef<{ addBookmark: (bookmark: Bookmark) => void }, BookmarkListProps>(
  ({ initialBookmarks, userId, onCountChange }, ref) => {
    const [bookmarks, setBookmarks] = useState<Bookmark[]>(initialBookmarks)
    const supabase = createClient()

    // Update count whenever bookmarks change
    useEffect(() => {
      if (onCountChange) {
        onCountChange(bookmarks.length)
      }
    }, [bookmarks.length, onCountChange])

    // Expose addBookmark method for same-tab optimistic updates
    useImperativeHandle(ref, () => ({
      addBookmark: (bookmark: Bookmark) => {
        console.log('📌 Optimistic add (same tab):', bookmark.id)
        setBookmarks((current) => {
          if (current.some(b => b.id === bookmark.id)) {
            return current
          }
          return [bookmark, ...current]
        })
      }
    }))

  useEffect(() => {
    console.log('🔌 Setting up realtime subscription for user:', userId)
    
    const channelName = `bookmarks-${userId}`
    console.log('📺 Channel name:', channelName)
    
    const channel = supabase
      .channel(channelName)
      // Listen to postgres changes (for other tabs)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log('🎉 Realtime INSERT from postgres:', payload)
          setBookmarks((current) => {
            if (current.some(b => b.id === payload.new.id)) {
              console.log('⚠️ Already exists, skipping')
              return current
            }
            return [payload.new as Bookmark, ...current]
          })
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookmarks',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          console.log('🗑️ Realtime DELETE:', payload)
          setBookmarks((current) => current.filter((b) => b.id !== payload.old.id))
        }
      )
      // Also listen to broadcast messages (as backup)
      .on('broadcast', { event: 'bookmark-added' }, (payload: any) => {
        console.log('📢 Broadcast received:', payload)
        const bookmark = payload.payload as Bookmark
        setBookmarks((current) => {
          if (current.some(b => b.id === bookmark.id)) {
            return current
          }
          return [bookmark, ...current]
        })
      })
      .subscribe((status: string) => {
        console.log('📡 Status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to', channelName)
        }
      })

    return () => {
      console.log('🧹 Cleanup')
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  const handleDelete = async (id: string) => {
    // Optimistically remove from UI
    setBookmarks((current) => current.filter((b) => b.id !== id))
    
    // Delete from database
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting bookmark:', error)
      // Reload bookmarks on error
      const { data } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (data) setBookmarks(data)
    }
  }

  return (
    <div className="space-y-3">
      {bookmarks.length === 0 ? (
        <div className="text-center py-12 sm:py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
          <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <p className="text-gray-600 font-medium text-sm sm:text-base">No links yet</p>
          <p className="text-gray-500 text-xs sm:text-sm mt-1">Add your first link above</p>
        </div>
      ) : (
        bookmarks.map((bookmark) => (
          <div key={bookmark.id} className="flex items-start gap-3 p-3 sm:p-4 bg-white rounded-lg shadow-sm hover:shadow-md border border-gray-200 transition-all">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 truncate text-sm sm:text-base mb-1">{bookmark.title}</h3>
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm text-indigo-600 hover:text-indigo-800 hover:underline truncate block"
              >
                {bookmark.url}
              </a>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(bookmark.created_at).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <button
              onClick={() => handleDelete(bookmark.id)}
              className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Delete"
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))
      )}
    </div>
  )
})

BookmarkList.displayName = 'BookmarkList'

export default BookmarkList
