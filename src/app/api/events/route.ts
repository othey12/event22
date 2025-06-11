import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, access } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import QRCode from 'qrcode'
import db, { testConnection } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting event creation...');
    
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error('❌ Database connection failed');
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

    console.log('📝 Creating event:', { name, slug, type, location, quota });

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
      console.log('📁 Processing file upload:', ticketDesignFile.name, ticketDesignFile.size);
      
      try {
        const bytes = await ticketDesignFile.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // Ensure directories exist with absolute paths
        const projectRoot = process.cwd()
        const publicDir = path.join(projectRoot, 'public')
        const uploadsDir = path.join(publicDir, 'uploads')
        
        console.log('📂 Project root:', projectRoot);
        console.log('📂 Public directory:', publicDir);
        console.log('📂 Uploads directory:', uploadsDir);
        
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
        
        console.log('💾 Saving file to:', filepath);
        
        // Write file with proper error handling
        await writeFile(filepath, buffer, { mode: 0o644 })
        console.log('✅ File written successfully');
        
        // Verify file exists and get stats
        try {
          await access(filepath)
          const fs = require('fs')
          const stats = fs.statSync(filepath)
          console.log('✅ File verified - size:', stats.size, 'bytes');
          
          ticketDesignPath = `/uploads/${filename}`
          ticketDesignSize = ticketDesignFile.size
          ticketDesignType = ticketDesignFile.type

          console.log('🖼️ Ticket design saved successfully:', {
            path: ticketDesignPath,
            size: ticketDesignSize,
            type: ticketDesignType
          });
        } catch (verifyError) {
          console.error('❌ File verification failed:', verifyError);
          throw new Error('Failed to verify saved file');
        }
      } catch (fileError) {
        console.error('❌ File upload error:', fileError);
        return NextResponse.json({ 
          message: 'Failed to upload ticket design: ' + (fileError instanceof Error ? fileError.message : 'Unknown error')
        }, { status: 500 })
      }
    }

    // Insert event into database
    console.log('💾 Inserting event into database...');
    const [result] = await db.execute(
      'INSERT INTO events (name, slug, type, location, description, start_time, end_time, quota, ticket_design, ticket_design_size, ticket_design_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, slug, type, location, description, startTime, endTime, quota, ticketDesignPath, ticketDesignSize, ticketDesignType]
    )

    const eventId = (result as any).insertId
    console.log('🎉 Event created with ID:', eventId);

    // Track file upload in database if file was uploaded
    if (ticketDesignPath) {
      try {
        await db.execute(
          'INSERT INTO file_uploads (filename, original_name, file_path, file_size, file_type, upload_type, related_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [path.basename(ticketDesignPath), ticketDesignFile!.name, ticketDesignPath, ticketDesignSize, ticketDesignType, 'ticket_design', eventId]
        )
        console.log('📝 File upload tracked in database');
      } catch (dbError) {
        console.error('⚠️ Failed to track file upload in database:', dbError);
      }
    }

    // Generate tickets with proper directory creation
    const ticketsDir = path.join(process.cwd(), 'public', 'tickets')
    try {
      await access(ticketsDir)
      console.log('✅ Tickets directory exists');
    } catch {
      await mkdir(ticketsDir, { recursive: true })
      console.log('✅ Created tickets directory');
    }
    
    console.log('🎫 Generating', quota, 'tickets...');

    const serverUrl = process.env.SERVER_URL || 'http://localhost:3000'

    for (let i = 0; i < quota; i++) {
      const token = uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase()
      const registrationUrl = `${serverUrl}/register?token=${token}`
      
      try {
        // Generate QR code
        const qrCodeBuffer = await QRCode.toBuffer(registrationUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        const qrCodePath = path.join(ticketsDir, `qr_${token}.png`)
        await writeFile(qrCodePath, qrCodeBuffer)
        
        // Insert ticket into database
        await db.execute(
          'INSERT INTO tickets (event_id, token, qr_code_url, is_verified) VALUES (?, ?, ?, ?)',
          [eventId, token, `/tickets/qr_${token}.png`, false]
        )
        
        if ((i + 1) % 10 === 0 || i === quota - 1) {
          console.log(`✅ Generated ${i + 1}/${quota} tickets`);
        }
      } catch (ticketError) {
        console.error(`⚠️ Failed to generate ticket ${i + 1}:`, ticketError);
      }
    }

    console.log('✅ Event creation completed successfully');

    return NextResponse.json({ 
      message: 'Event created successfully',
      eventId: eventId,
      ticketsGenerated: quota,
      ticketDesign: ticketDesignPath
    })
  } catch (error) {
    console.error('❌ Error creating event:', error);
    return NextResponse.json({ 
      message: 'Internal server error', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    console.log('🔍 Starting GET /api/events...');
    
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error('❌ Database connection failed in GET /api/events');
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    console.log('🔍 Fetching all events with statistics...');

    // Enhanced query to get events with ticket statistics
    const [rows] = await db.execute(`
      SELECT 
        e.id, e.name, e.slug, e.type, e.location, e.description, 
        e.start_time, e.end_time, e.quota, e.ticket_design, 
        e.ticket_design_size, e.ticket_design_type, 
        e.created_at, e.updated_at,
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
        GROUP BY event_id
      ) ticket_stats ON e.id = ticket_stats.event_id
      ORDER BY e.created_at DESC
    `)
    
    const events = rows as any[]
    console.log('📊 Fetched', events.length, 'events with statistics');
    
    // Log sample event for debugging
    if (events.length > 0) {
      console.log('📝 Sample event data:', {
        id: events[0].id,
        name: events[0].name,
        total_tickets: events[0].total_tickets,
        verified_tickets: events[0].verified_tickets,
        ticket_design: events[0].ticket_design
      });
    }
    
    return NextResponse.json(events)
  } catch (error) {
    console.error('❌ Error fetching events:', error);
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
        console.log('🗑️ Deleted file:', filePath);
      } catch (fileError) {
        console.error('⚠️ Error deleting file:', fileError);
      }
    }

    // Delete event (cascade will handle tickets, participants, certificates)
    await db.execute('DELETE FROM events WHERE id = ?', [eventId])
    console.log('🗑️ Event deleted:', eventId);

    return NextResponse.json({ message: 'Event deleted successfully' })
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}