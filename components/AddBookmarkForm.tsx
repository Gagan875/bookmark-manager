'use client'

import { createClient } from '@/lib/supabase/client'
import { useRef, useState } from 'react'

type AddBookmarkFormProps = {
  onBookmarkAdded?: (bookmark: any) => void
}

export default function AddBookmarkForm({ onBookmarkAdded }: AddBookmarkFormProps = {}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const url = formData.get('url') as string
    const title = formData.get('title') as string

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('You must be logged in to add bookmarks')
        return
      }

      // Insert and get the data back
      const { data, error } = await supabase
        .from('bookmarks')
        .insert({ url, title, user_id: user.id })
        .select()
        .single()

      if (error) {
        console.error('Error adding bookmark:', error)
        alert('Failed to add bookmark')
      } else {
        console.log('✅ Bookmark inserted:', data)
        formRef.current?.reset()
        
        // Broadcast to other tabs as backup
        const channel = supabase.channel(`bookmarks-${user.id}`)
        await channel.send({
          type: 'broadcast',
          event: 'bookmark-added',
          payload: data
        })
        
        // Notify parent to add to list immediately (for same tab)
        if (onBookmarkAdded && data) {
          onBookmarkAdded(data)
        }
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Failed to add bookmark')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      <input
        type="url"
        name="url"
        placeholder="https://example.com"
        required
        disabled={isSubmitting}
        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-sm sm:text-base placeholder:text-gray-400"
      />
      <input
        type="text"
        name="title"
        placeholder="Link title"
        required
        disabled={isSubmitting}
        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50 text-sm sm:text-base placeholder:text-gray-400"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-indigo-600 text-white py-2 sm:py-3 rounded-lg hover:bg-indigo-700 transition-all font-medium disabled:opacity-50 text-sm sm:text-base"
      >
        {isSubmitting ? 'Adding...' : 'Add Link'}
      </button>
    </form>
  )
}
