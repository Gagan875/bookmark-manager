'use client'

import { useRef, useState } from 'react'
import AddBookmarkForm from './AddBookmarkForm'
import BookmarkList from './BookmarkList'

type Bookmark = {
  id: string
  url: string
  title: string
  created_at: string
}

export default function BookmarkManager({ 
  initialBookmarks, 
  userId 
}: { 
  initialBookmarks: Bookmark[]
  userId: string 
}) {
  const bookmarkListRef = useRef<{ addBookmark: (bookmark: Bookmark) => void }>(null)
  const [bookmarkCount, setBookmarkCount] = useState(initialBookmarks.length)

  const handleBookmarkAdded = (newBookmark: Bookmark) => {
    // Add to same tab immediately (optimistic update)
    if (bookmarkListRef.current) {
      bookmarkListRef.current.addBookmark(newBookmark)
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Add New Link</h2>
        <AddBookmarkForm onBookmarkAdded={handleBookmarkAdded} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-gray-700">Your Collection</h3>
        <span className="text-sm text-gray-500">{bookmarkCount} {bookmarkCount === 1 ? 'link' : 'links'}</span>
      </div>

      <BookmarkList 
        ref={bookmarkListRef}
        initialBookmarks={initialBookmarks} 
        userId={userId}
        onCountChange={setBookmarkCount}
      />
    </>
  )
}
