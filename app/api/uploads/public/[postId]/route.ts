import { NextRequest, NextResponse } from 'next/server'
import { POST as signPublicPost } from '../../../storage/sign/route'

export const dynamic = 'force-dynamic'

// Keep the redirect endpoint subject to the same authorization as public works.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params
  const response = await signPublicPost(new Request(req.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ postId }),
  }))
  if (!response.ok) return response
  const { signedUrl } = await response.json() as { signedUrl: string }
  return NextResponse.redirect(signedUrl, { status: 302 })
}
