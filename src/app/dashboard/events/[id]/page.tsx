import Link from 'next/link'
import { Calendar, MapPin, Users, Clock, ArrowLeft, Edit, Trash2, Download, FileText } from 'lucide-react'
import db from '@/lib/db'
import { formatDateTime } from '@/lib/utils'
import DeleteEventButton from '@/components/DeleteEventButton'

async function getEventDetails(eventId: string) {
  try {
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
      return null
    }

    // Get participants
    const [participantRows] = await db.execute(`
      SELECT p.*, t.token, t.is_verified
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      WHERE t.event_id = ?
      ORDER BY p.registered_at DESC
    `, [eventId])

    return {
      event: events[0],
      participants: participantRows as any[]
    }
  } catch (error) {
    console.error('Error fetching event details:', error)
    return null
  }
}

export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const data = await getEventDetails(params.id)

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Event Not Found</h2>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
          <Link href="/dashboard/events" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  const { event, participants } = data

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/" className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold gradient-text">Event Manager</h1>
              </Link>
            </div>
            <nav className="flex space-x-4">
              <Link href="/dashboard/events" className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Events</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-4">
                <h1 className="text-3xl font-bold text-gray-900">{event.name}</h1>
                <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                  event.type === 'Seminar' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {event.type}
                </span>
              </div>
              <p className="text-gray-600 text-lg mb-4">{event.description}</p>
              <div className="text-sm text-gray-500">
                <p>Slug: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{event.slug}</span></p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Link 
                href={`/dashboard/events/${event.id}/edit`}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit</span>
              </Link>
              <DeleteEventButton eventId={event.id} eventName={event.name} />
            </div>
          </div>

          {/* Event Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Location</p>
                <p className="font-medium text-gray-900">{event.location}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Start Time</p>
                <p className="font-medium text-gray-900">{formatDateTime(event.start_time)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">End Time</p>
                <p className="font-medium text-gray-900">{formatDateTime(event.end_time)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Users className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Registration</p>
                <p className="font-medium text-gray-900">{event.verified_tickets}/{event.total_tickets}</p>
              </div>
            </div>
          </div>

          {/* Ticket Design */}
          {event.ticket_design && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Ticket Design</h3>
              <div className="flex items-center space-x-4">
                <img 
                  src={event.ticket_design} 
                  alt="Ticket Design" 
                  className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                />
                <div>
                  <p className="text-sm text-gray-600">
                    Size: {event.ticket_design_size ? Math.round(event.ticket_design_size / 1024) + ' KB' : 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Type: {event.ticket_design_type || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Tickets</p>
                <p className="text-3xl font-bold text-gray-900">{event.total_tickets}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Registered</p>
                <p className="text-3xl font-bold text-gray-900">{event.verified_tickets}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Available</p>
                <p className="text-3xl font-bold text-gray-900">{event.total_tickets - event.verified_tickets}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900">Participants</h3>
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
          </div>
          
          {participants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Organization
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Registered
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participants.map((participant) => (
                    <tr key={participant.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">Token: {participant.token}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{participant.email}</div>
                        {participant.phone && (
                          <div className="text-sm text-gray-500">{participant.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {participant.organization || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          participant.is_verified
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {participant.is_verified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDateTime(participant.registered_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No participants yet</h3>
              <p className="text-gray-600">Participants will appear here once they register</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}