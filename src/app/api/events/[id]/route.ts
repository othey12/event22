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
             COALESCE(ticket_stats.total_tickets, 0) as total_tickets,
             COALESCE(ticket_stats.verified_tickets, 0) as verified_tickets,
             COALESCE(ticket_stats.available_tickets, 0) as available_tickets
      FROM events e
      LEFT JOIN (
        SELECT 
          event_id,
          COUNT(*) as total_tickets,
          SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified_tickets,
          SUM(CASE WHEN is_verified = FALSE THEN 1 ELSE 0 END) as available_tickets
        FROM tickets 
        WHERE event_id = ?
        GROUP BY event_id
      ) ticket_stats ON e.id = ticket_stats.event_id
      WHERE e.id = ?
    `, [eventId, eventId])

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
        
        // Ensure directories exist with absolute paths
        const projectRoot = process.cwd()
        const publicDir = path.join(projectRoot, 'public')
        const uploadsDir = path.join(publicDir, 'uploads')
        
        // Create directories if they don't exist
        try {
          await access(publicDir)
          console.log('✅ Public directory exists');
        } catch {
          await mkdir(publicDir, { recursive: true })
          console.log('✅ Created public directory');
        }
        
        try {
          await access(uploadsDir)
          console.log('✅ Uploads directory exists');
        } catch {
          await mkdir(uploadsDir, { recursive: true })
          console.log('✅ Created uploads directory');
        }
        
        // Generate unique filename with timestamp and random string
        const timestamp = Date.now()
        const randomString = Math.random().toString(36).substring(2, 8)
        const fileExtension = path.extname(ticketDesignFile.name)
        const baseFileName = ticketDesignFile.name
          .replace(fileExtension, '')
          .replace(/[^a-zA-Z0-9.-]/g, '-')
          .toLowerCase()
        const filename = `ticket-${timestamp}-${randomString}-${baseFileName}${fileExtension}`
        const filepath = path.join(uploadsDir, filename)
        
        // Write file with proper permissions
        await writeFile(filepath, buffer, { mode: 0o644 })
        console.log('✅ File saved to:', filepath)
        
        // Verify file was written and get stats
        try {
          await access(filepath)
          const fs = require('fs')
          const stats = fs.statSync(filepath)
          console.log('✅ File verified - size:', stats.size, 'bytes')
        } catch (verifyError) {
          console.error('❌ File verification failed:', verifyError)
          throw new Error('Failed to save file properly')
        }
        
        ticketDesignPath = `/uploads/${filename}`
        ticketDesignSize = ticketDesignFile.size
        ticketDesignType = ticketDesignFile.type

        console.log('🖼️ New ticket design saved:', {
          path: ticketDesignPath,
          size: ticketDesignSize,
          type: ticketDesignType
        })

        // Track file upload in database
        try {
          await db.execute(
            'INSERT INTO file_uploads (filename, original_name, file_path, file_size, file_type, upload_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [filename, ticketDesignFile.name, ticketDesignPath, ticketDesignSize, ticketDesignType, 'ticket_design', eventId]
          )
          console.log('📝 File upload tracked in database')
        } catch (dbError) {
          console.error('⚠️ Failed to track file upload in database:', dbError)
        }

        // Update event with new file
        await db.execute(
          'UPDATE events SET name = ?, slug = ?, type = ?, location = ?, description = ?, start_time = ?, end_time = ?, quota = ?, ticket_design = ?, ticket_design_size = ?, ticket_design_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [name, slug, type, location, description, startTime, endTime, quota, ticketDesignPath, ticketDesignSize, ticketDesignType, eventId]
        )
      } catch (fileError) {
        console.error('❌ File upload error:', fileError)
        return NextResponse.json({ 
          message: 'Failed to upload ticket design: ' + (fileError instanceof Error ? fileError.message : 'Unknown error')
        }, { status: 500 })
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
    return NextResponse.json({ 
      message: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
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