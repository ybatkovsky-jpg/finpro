import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.xlsx', '.doc', '.docx']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use "file" field in FormData.' },
        { status: 422 }
      )
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit.' },
        { status: 413 }
      )
    }

    // Check file extension
    const originalName = file.name.toLowerCase()
    const ext = path.extname(originalName)

    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `File type not allowed. Accepted types: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 415 }
      )
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true })
    }

    // Generate unique filename
    const uuid = uuidv4()
    const filename = `${uuid}${ext}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filepath, buffer)

    const url = `/uploads/${filename}`

    return NextResponse.json({ url })
  } catch (error) {
    console.error('POST /upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}
