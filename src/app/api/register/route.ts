import { NextRequest, NextResponse } from 'next/server'
import db, { testConnection } from '@/lib/db'
import { sendRegistrationEmail } from '@/lib/email'

export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ message: 'Token is required' }, { status: 400 })
    }

    // Check if ticket exists and get event details
    const [rows] = await db.execute(`
      SELECT t.*, e.name, e.type, e.location, e.description, e.start_time, e.end_time
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.token = ?
    `, [token])

    const tickets = rows as any[]

    if (tickets.length === 0) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 404 })
    }

    const ticket = tickets[0]

    if (ticket.is_verified) {
      return NextResponse.json({ message: 'This ticket has already been used' }, { status: 400 })
    }

    return NextResponse.json({
      event: {
        id: ticket.event_id,
        name: ticket.name,
        type: ticket.type,
        location: ticket.location,
        description: ticket.description,
        start_time: ticket.start_time,
        end_time: ticket.end_time
      }
    })
  } catch (error) {
    console.error('Error fetching event data:', error)
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return NextResponse.json({ message: 'Database connection failed' }, { status: 500 })
    }

    const body = await request.json()
    const { token, name, email, phone, organization } = body

    if (!token || !name || !email) {
      return NextResponse.json({ message: 'Missing required fields' }, { status: 400 })
    }

    // Check if ticket exists and is not verified
    const [ticketRows] = await db.execute(`
      SELECT t.*, e.name as event_name, e.type, e.location, e.description, e.start_time, e.end_time
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.token = ?
    `, [token])

    const tickets = ticketRows as any[]

    if (tickets.length === 0) {
      return NextResponse.json({ message: 'Invalid token' }, { status: 404 })
    }

    const ticket = tickets[0]

    if (ticket.is_verified) {
      return NextResponse.json({ message: 'This ticket has already been used' }, { status: 400 })
    }

    // Insert participant
    const [participantResult] = await db.execute(
      'INSERT INTO participants (ticket_id, name, email, phone, organization) VALUES (?, ?, ?, ?, ?)',
      [ticket.id, name, email, phone || null, organization || null]
    )

    // Mark ticket as verified
    await db.execute(
      'UPDATE tickets SET is_verified = TRUE WHERE id = ?',
      [ticket.id]
    )

    // Send confirmation email
    const eventDetails = `
      Event: ${ticket.event_name}
      Type: ${ticket.type}
      Location: ${ticket.location}
      Date: ${new Date(ticket.start_time).toLocaleString()} - ${new Date(ticket.end_time).toLocaleString()}
      ${ticket.description ? `Description: ${ticket.description}` : ''}
    `

    try {
      await sendRegistrationEmail(email, name, ticket.event_name, eventDetails)
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError)
      // Don't fail the registration if email fails
    }

    return NextResponse.json({ 
      message: 'Registration successful',
      participantId: (participantResult as any).insertId
    })
  } catch (error) {
    console.error('Error processing registration:', error)
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}