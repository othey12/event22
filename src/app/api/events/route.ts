import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import db, { testConnection } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    const formData = await request.formData()
    
    const name = formData.get('name') as string
    const slug = formData.get('slug') as string
    const type = formData.get('type') as string
    const location = formData.get('location') as string
    const description = formData.get('description') as string
    const startTime = formData.get('startTime') as string
    const endTime = formData.get('endTime') as string
    const quota = parseInt(formData.get('quota') as string)
    const ticketDesignFile = formData.get('ticketDesign') as File | null

    console.log('📝 Creating event:', { name, slug, type, location, quota })

    if (!name || !slug || !type || !location || !startTime || !endTime || !quota) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // Check if slug already exists
    const [existingSlug] = await db.execute(
      'SELECT id FROM events WHERE slug = ?',
      [slug]
    )

    if ((existingSlug as any[]).length > 0) {
      return NextResponse.json({ message: 'Slug already exists. Please use a different slug.' }, { status: 400 })
    }

    // Handle ticket design upload
    let ticketDesignPath = null
    let ticketDesignSize = null
    let ticketDesignType = null
    
    if (ticketDesignFile && ticketDesignFile.size > 0) {
      console.log('📁 Processing file upload:', ticketDesignFile.name, ticketDesignFile.size)
      
      const bytes = await ticketDesignFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
      await mkdir(uploadsDir, { recursive: true })
      console.log('📂 Created uploads directory:', uploadsDir)
      
      const filename = `ticket-${Date.now()}-${ticketDesignFile.name.replace(/[^a-zA-Z0-9.-]/g, '')}`
      const filepath = path.join(uploadsDir, filename)
      await writeFile(filepath, buffer)
      console.log('✅ File saved to:', filepath)
      
      ticketDesignPath = `/uploads/${filename}`
      ticketDesignSize = ticketDesignFile.size
      ticketDesignType = ticketDesignFile.type

      console.log('🖼️ Ticket design saved:', ticketDesignPath)

      // Track file upload in database
      await db.execute(
        'INSERT INTO file_uploads (filename, original_name, file_path, file_size, file_type, upload_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [filename, ticketDesignFile.name, ticketDesignPath, ticketDesignSize, ticketDesignType, 'ticket_design', null]
      )
    }

    // Insert event into database
    const [result] = await db.execute(
      'INSERT INTO events (name, slug, type, location, description, start_time, end_time, quota, ticket_design, ticket_design_size, ticket_design_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, slug, type, location, description, startTime, endTime, quota, ticketDesignPath, ticketDesignSize, ticketDesignType]
    )

    const eventId = (result as any).insertId
    console.log('🎉 Event created with ID:', eventId)

    // Update file upload with event ID
    if (ticketDesignPath) {
      await db.execute(
        'UPDATE file_uploads SET related_id = ? WHERE file_path = ? AND upload_type = ?',
        [eventId, ticketDesignPath, 'ticket_design']
      )
    }

    // Generate tickets
    const ticketsDir = path.join(process.cwd(), 'public', 'tickets')
    await mkdir(ticketsDir, { recursive: true })
    console.log('🎫 Generating', quota, 'tickets...')

    for (let i = 0; i < quota; i++) {
      const token = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()
      const registrationUrl = `${process.env.SERVER_URL || 'http://localhost:3000'}/register?token=${token}`
      
      // Generate QR code
      const qrCodeBuffer = await QRCode.toBuffer(registrationUrl)
      const qrCodePath = path.join(ticketsDir, `qr_${token}.png`)
      await writeFile(qrCodePath, qrCodeBuffer)
      
      // Insert ticket into database
      await db.execute(
        'INSERT INTO tickets (event_id, token, qr_code_url, is_verified) VALUES (?, ?, ?, ?)',
        [eventId, token, `/tickets/qr_${token}.png`, false]
      )
    }

    console.log('✅ Event creation completed successfully')

    return NextResponse.json({ 
      message: 'Event created successfully',
      eventId: eventId,
      ticketsGenerated: quota,
      ticketDesign: ticketDesignPath
    })
  } catch (error) {
    console.error('❌ Error creating event:', error)
    return NextResponse.json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    const [rows] = await db.execute(`
      SELECT e.*, 
             COUNT(t.id) as total_tickets,
             COUNT(CASE WHEN t.is_verified = TRUE THEN 1 END) as verified_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      GROUP BY e.id, e.name, e.slug, e.type, e.location, e.description, e.start_time, e.end_time, e.quota, e.ticket_design, e.ticket_design_size, e.ticket_design_type, e.created_at, e.updated_at
      ORDER BY e.created_at DESC
    `)
    
    console.log('📊 Fetched', (rows as any[]).length, 'events')
    return NextResponse.json(rows)
  } catch (error) {
    console.error('❌ Error fetching events:', error)
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('id')

    if (!eventId) {
      return NextResponse.json({ message: 'Event ID is required' }, { status: 400 })
    }

    // Get event details including file paths
    const [eventRows] = await db.execute(
      'SELECT ticket_design FROM events WHERE id = ?',
      [eventId]
    )

    const events = eventRows as any[]
    if (events.length === 0) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 })
    }

    // Delete associated files if they exist
    const event = events[0]
    if (event.ticket_design) {
      try {
        const fs = require('fs').promises
        const filePath = path.join(process.cwd(), 'public', event.ticket_design)
        await fs.unlink(filePath)
        console.log('🗑️ Deleted file:', filePath)
      } catch (fileError) {
        console.error('⚠️ Error deleting file:', fileError)
      }
    }

    // Delete event (cascade will handle tickets, participants, certificates)
    await db.execute('DELETE FROM events WHERE id = ?', [eventId])
    console.log('🗑️ Event deleted:', eventId)

    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting event:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}