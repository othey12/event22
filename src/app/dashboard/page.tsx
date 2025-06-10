import Link from 'next/link'
import { Calendar, Users, Award, BarChart3, Plus, Eye, Ticket } from 'lucide-react'
import db, { testConnection } from '@/lib/db'

async function getDashboardStats() {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return {
        totalEvents: 0,
        totalParticipants: 0,  
        totalTickets: 0,
        verifiedTickets: 0,
      }
    }

    const [eventsResult] = await db.execute('SELECT COUNT(*) as count FROM events')
    const [participantsResult] = await db.execute('SELECT COUNT(*) as count FROM participants')
    const [ticketsResult] = await db.execute('SELECT COUNT(*) as count FROM tickets')
    const [verifiedResult] = await db.execute('SELECT COUNT(*) as count FROM tickets WHERE is_verified = TRUE')
    
    return {
      totalEvents: (eventsResult as any)[0].count,
      totalParticipants: (participantsResult as any)[0].count,
      totalTickets: (ticketsResult as any)[0].count,
      verifiedTickets: (verifiedResult as any)[0].count,
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      totalEvents: 0,
      totalParticipants: 0,  
      totalTickets: 0,
      verifiedTickets: 0,
    }
  }
}

async function getRecentEvents() {
  try {
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      return []
    }

    const [rows] = await db.execute(`
      SELECT e.*, 
             COUNT(t.id) as total_tickets,
             COUNT(CASE WHEN t.is_verified = TRUE THEN 1 END) as verified_tickets
      FROM events e
      LEFT JOIN tickets t ON e.id = t.event_id
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `)
    return rows as any[]
  } catch (error) {
    console.error('Error fetching recent events:', error)
    return []
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()
  const recentEvents = await getRecentEvents()

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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-gray-600">Manage your events and track performance</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Events</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Participants</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalParticipants}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Tickets</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalTickets}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Ticket className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Verified Tickets</p>
                <p className="text-3xl font-bold text-gray-900">{stats.verifiedTickets}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Award className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link href="/dashboard/events" className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-xl text-white hover:from-blue-600 hover:to-blue-700 transition-all transform hover:scale-105">
            <Calendar className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Manage Events</h3>
            <p className="text-blue-100 text-sm">Create, edit, and view all events</p>
          </Link>

          <Link href="/dashboard/participants" className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105">
            <Users className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Participants</h3>
            <p className="text-green-100 text-sm">View and manage participants</p>
          </Link>

          <Link href="/dashboard/certificates" className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105">
            <Award className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Certificates</h3>
            <p className="text-purple-100 text-sm">Generate and manage certificates</p>
          </Link>

          <Link href="/dashboard/reports" className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105">
            <BarChart3 className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Reports</h3>
            <p className="text-orange-100 text-sm">View analytics and reports</p>
          </Link>
        </div>

        {/* Recent Events */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Recent Events</h3>
            <Link href="/dashboard/events" className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
              <span>View All</span>
              <Eye className="h-4 w-4" />
            </Link>
          </div>

          {recentEvents.length > 0 ? (
            <div className="space-y-4">
              {recentEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className={`p-2 rounded-lg ${event.type === 'Seminar' ? 'bg-blue-100' : 'bg-green-100'}`}>
                      <Calendar className={`h-5 w-5 ${event.type === 'Seminar' ? 'text-blue-600' : 'text-green-600'}`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{event.name}</h4>
                      <p className="text-sm text-gray-500">{event.type} • {event.location}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {event.verified_tickets}/{event.total_tickets} Registered
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.start_time).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No events created yet</p>
              <Link href="/dashboard/events/create" className="text-blue-600 hover:text-blue-700 font-medium">
                Create your first event
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}