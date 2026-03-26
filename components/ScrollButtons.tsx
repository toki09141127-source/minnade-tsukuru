'use client'

import { useEffect, useState } from 'react'

const buttonStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '9999px',
  border: '1px solid #ddd',
  background: '#fff',
  color: '#111',
  fontSize: 18,
  fontWeight: 800,
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
}

export default function ScrollButtons() {
  const [showTop, setShowTop] = useState(false)
  const [showBottom, setShowBottom] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      const windowHeight = window.innerHeight
      const fullHeight = document.documentElement.scrollHeight

      setShowTop(scrollTop > 200)
      setShowBottom(scrollTop + windowHeight < fullHeight - 200)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth',
    })
  }

  if (!showTop && !showBottom) return null

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {showBottom && (
        <button type="button" onClick={scrollToBottom} aria-label="ページ最下部へ移動" style={buttonStyle}>
          ↓
        </button>
      )}

      {showTop && (
        <button type="button" onClick={scrollToTop} aria-label="ページ最上部へ移動" style={buttonStyle}>
          ↑
        </button>
      )}
    </div>
  )
}