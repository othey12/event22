import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, access } from 'fs/promises'
import path from 'path'
import db, { testConnection } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    const eventId = params.id

    // Get event details with statistics
    const [eventRows] = await db.execute(`
      SELECT e.*, 
             COUNT(t.id) as total_tickets,
             COUNT(CASE WHEN t.is_verified = TRUE THEN 1 END) as verified_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      WHERE e.id = ?
      GROUP BY e.id
    `, [eventId])

    const events = eventRows as any[]
    if (events.length === 0) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 })
    }

    // Get participants
    const [participantRows] = await db.execute(`
      SELECT p.*, t.token, t.is_verified
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ?
      ORDER BY p.registered_at DESC
    `, [eventId])

    return NextResponse.json({
      event: events[0],
      participants: participantRows
    })
  } catch (error) {
    console.error('Error fetching event details:', error)
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id
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

    console.log('📝 Updating event:', eventId, { name, slug, type, location, quota })

    if (!name || !slug || !type || !location || !startTime || !endTime || !quota) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // Check if slug already exists for other events
    const [existingSlug] = await db.execute(
      'SELECT id FROM events WHERE slug = ? AND id != ?',
      [slug, eventId]
    )

    if ((existingSlug as any[]).length > 0) {
      return NextResponse.json({ message: 'Slug already exists. Please use a different slug.' }, { status: 400 })
    }

    // Handle ticket design upload if new file provided
    let ticketDesignPath = null
    let ticketDesignSize = null
    let ticketDesignType = null
    
    if (ticketDesignFile && ticketDesignFile.size > 0) {
      console.log('📁 Processing file upload:', ticketDesignFile.name, ticketDesignFile.size)
      
      try {
        const bytes = await ticketDesignFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
        
        try {
          await access(uploadsDir)
          console.log('📂 Uploads directory exists')
        } catch {
          await mkdir(uploadsDir, { recursive: true })
          console.log('📂 Created uploads directory:', uploadsDir)
        }
        
        // Generate unique filename
        const fileExtension = path.extname(ticketDesignFile.name)
        const baseFileName = ticketDesignFile.name.replace(fileExtension, '').replace(/[^a-zA-Z0-9.-]/g, '')
        const filename = `ticket-${Date.now()}-${baseFileName}${fileExtension}`
        const filepath = path.join(uploadsDir, filename)
        
        // Write file
        await writeFile(filepath, buffer)
        console.log('✅ File saved to:', filepath)
        
        // Verify file was written
        try {
          await access(filepath)
          console.log('✅ File verified to exist at:', filepath)
        } catch (verifyError) {
          console.error('❌ File verification failed:', verifyError)
          throw new Error('Failed to save file')
        }
        
        ticketDesignPath = `/uploads/${filename}`
        ticketDesignSize = ticketDesignFile.size
        ticketDesignType = ticketDesignFile.type

        console.log('🖼️ New ticket design saved:', ticketDesignPath)

        // Track file upload in database
        try {
          await db.execute(
            'INSERT INTO file_uploads (filename, original_name, file_path, file_size, file_type, upload_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [filename, ticketDesignFile.name, ticketDesignPath, ticketDesignSize, ticketDesignType, 'ticket_design', eventId]
          )
          console.log('📝 File upload tracked in database')
        } catch (dbError) {
          console.error('⚠️ Failed to track file upload in database:', dbError)
          // Don't fail the entire operation for this
        }

        // Update event with new file
        await db.execute(
          'UPDATE events SET name = ?, slug = ?, type = ?, location = ?, description = ?, start_time = ?, end_time = ?, quota = ?, ticket_design = ?, ticket_design_size = ?, ticket_design_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, slug, type, location, description, startTime, endTime, quota, ticketDesignPath, ticketDesignSize, ticketDesignType, eventId]
        )
      } catch (fileError) {
        console.error('❌ File upload error:', fileError)
        return NextResponse.json({ message: 'Failed to upload ticket design' }, { status: 500 })
      }
    } else {
      // Update event without changing file
      await db.execute(
        'UPDATE events SET name = ?, slug = ?, type = ?, location = ?, description = ?, start_time = ?, end_time = ?, quota = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, slug, type, location, description, startTime, endTime, quota, eventId]
      )
    }

    console.log('✅ Event updated successfully')

    return NextResponse.json({ message: 'Event updated successfully' })
  } catch (error) {
    console.error('❌ Error updating event:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id

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