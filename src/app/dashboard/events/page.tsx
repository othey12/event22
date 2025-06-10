import Link from 'next/link'
import { Calendar, MapPin, Users, Plus, Eye, Download, Loader2 } from 'lucide-react'
import db from '@/lib/db'
import { formatDateTime } from '@/lib/utils'

async function getEvents() {
  try {
    const [rows] = await db.execute(`
      SELECT e.*, 
             COUNT(t.id) as total_tickets,
             COUNT(CASE WHEN t.is_verified = TRUE THEN 1 END) as verified_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
    `)
    return rows as any[]
  } catch (error) {
    console.error('Error fetching events:', error)
    return []
  }
}

export default async function EventsPage() {
  const events = await getEvents()

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
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/events/create" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Event</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Events</h2>
          <p className="text-gray-600">Manage all your events and track their performance</p>
        </div>

        {/* Events Grid */}
        {events.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1">
                <div className={`h-2 ${event.type === 'Seminar' ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                
                {/* Ticket Design Preview */}
                {event.ticket_design && (
                  <div className="h-32 bg-gray-100 overflow-hidden">
                    <img 
                      src={event.ticket_design} 
                      alt="Ticket Design" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">{event.name}</h3>
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
                        event.type === 'Seminar' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center text-gray-600">
                      <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-sm truncate">{event.location}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Calendar className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{formatDateTime(event.start_time)}</span>
                    </div>
                    <div className="flex items-center text-gray-600">
                      <Users className="h-4 w-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{event.verified_tickets || 0}/{event.total_tickets || 0} Registered</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Registration Progress</span>
                      <span>{Math.round(((event.verified_tickets || 0) / (event.total_tickets || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.round(((event.verified_tickets || 0) / (event.total_tickets || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex space-x-2">
                      <Link 
                        href={`/dashboard/events/${event.id}`}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Link>
                      <button className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-center py-2 px-4 rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-1">
                        <Download className="h-4 w-4" />
                        <span>Export</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-12">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No events yet</h3>
              <p className="text-gray-600 mb-6">Create your first event to get started</p>
              <Link 
                href="/dashboard/events/create"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Create Event</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}