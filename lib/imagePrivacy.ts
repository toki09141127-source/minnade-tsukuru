import sharp from 'sharp'
import { MAX_UPLOAD_BYTES } from './uploadValidation'
export async function sanitizeImage(bytes: Uint8Array, mime: string): Promise<Uint8Array> {
  if (!mime.startsWith('image/')) return bytes
  if (!['image/png','image/jpeg','image/webp','image/gif'].includes(mime)) throw new Error('UNSUPPORTED_IMAGE')
  if (!bytes.length || bytes.length>MAX_UPLOAD_BYTES) throw new Error('IMAGE_SIZE')
  // Decode and re-encode: no keepMetadata/withMetadata; rotation consumes EXIF orientation.
  const image=sharp(Buffer.from(bytes),{limitInputPixels:16_000_000,animated:true,failOn:'error'})
  const format=mime==='image/jpeg'?'jpeg':mime.slice(6) as 'png'|'webp'|'gif'
  const output=await image.rotate().toFormat(format).toBuffer()
  if(!output.length || output.length>MAX_UPLOAD_BYTES) throw new Error('IMAGE_SIZE')
  return new Uint8Array(output)
}
