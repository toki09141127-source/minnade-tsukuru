'use client'

import { useEffect, useState } from 'react'
import PostForm from './PostForm'

type Post = {
  id: string
  user_id: string
  username: string
  content: string
  created_at: string
}

export default function BoardClient(props: {
  roomId: string
  roomStatus: string   // ← ★これを追加
}) {
  const { roomId, roomStatus } = props

  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchPosts() {
    setLoading(true)
    const res = await fetch(`/api/posts/list?roomId=${roomId}`)
    const json = await res.json()
    setPosts(json.posts ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchPosts()
  }, [roomId])

  const canPost = roomStatus === 'open'

  return (
    <div style={{ marginTop: 24 }}>
      <h2>掲示板</h2>

      {!canPost && (
        <p style={{ color: 'crimson', marginTop: 8 }}>
          現在は投稿できません。（status=open のときのみ）
        </p>
      )}

      {canPost && (
        <div style={{ marginTop: 12 }}>
          <PostForm roomId={roomId} onPosted={fetchPosts} />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        {loading || posts.length === 0 ? (
          <p>empty</p>
        ) : (
          <ul style={{ paddingLeft: 18 }}>
            {posts.map((p) => (
              <li key={p.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  {p.username} / {new Date(p.created_at).toLocaleString()}
                </div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{p.content}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
