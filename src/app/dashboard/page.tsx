import Link from 'next/link'
import { Calendar, Users, Award, BarChart3, Plus, Eye, Ticket, TrendingUp, Clock, MapPin, CheckCircle, AlertCircle } from 'lucide-react'
import db, { testConnection } from '@/lib/db'
import { formatDateTime } from '@/lib/utils'

async function getDashboardStats() {
  try {
    console.log('🔍 Starting comprehensive dashboard stats fetch...');
    
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error('❌ Database connection failed in getDashboardStats')
      return {
        totalEvents: 0,
        totalParticipants: 0,  
        totalTickets: 0,
        verifiedTickets: 0,
        availableTickets: 0,
        registrationRate: 0,
        upcomingEvents: 0,
        pastEvents: 0,
        ongoingEvents: 0,
        totalCertificates: 0,
        sentCertificates: 0,
      }
    }

    console.log('🔍 Fetching comprehensive dashboard statistics...');

    // Get all statistics in parallel for better performance
    const [
      eventsResult,
      participantsResult,
      ticketsResult,
      verifiedResult,
      upcomingEventsResult,
      pastEventsResult,
      ongoingEventsResult,
      certificatesResult,
      sentCertificatesResult
    ] = await Promise.all([
      db.execute('SELECT COUNT(*) as count FROM events'),
      db.execute('SELECT COUNT(*) as count FROM participants'),
      db.execute('SELECT COUNT(*) as count FROM tickets'),
      db.execute('SELECT COUNT(*) as count FROM tickets WHERE is_verified = TRUE'),
      db.execute('SELECT COUNT(*) as count FROM events WHERE start_time > NOW()'),
      db.execute('SELECT COUNT(*) as count FROM events WHERE end_time < NOW()'),
      db.execute('SELECT COUNT(*) as count FROM events WHERE start_time <= NOW() AND end_time >= NOW()'),
      db.execute('SELECT COUNT(*) as count FROM certificates'),
      db.execute('SELECT COUNT(*) as count FROM certificates WHERE sent = TRUE')
    ]);
    
    const totalEvents = Number((eventsResult[0] as any)[0].count) || 0;
    const totalParticipants = Number((participantsResult[0] as any)[0].count) || 0;
    const totalTickets = Number((ticketsResult[0] as any)[0].count) || 0;
    const verifiedTickets = Number((verifiedResult[0] as any)[0].count) || 0;
    const upcomingEvents = Number((upcomingEventsResult[0] as any)[0].count) || 0;
    const pastEvents = Number((pastEventsResult[0] as any)[0].count) || 0;
    const ongoingEvents = Number((ongoingEventsResult[0] as any)[0].count) || 0;
    const totalCertificates = Number((certificatesResult[0] as any)[0].count) || 0;
    const sentCertificates = Number((sentCertificatesResult[0] as any)[0].count) || 0;

    const stats = {
      totalEvents,
      totalParticipants,
      totalTickets,
      verifiedTickets,
      availableTickets: totalTickets - verifiedTickets,
      registrationRate: totalTickets > 0 ? Math.round((verifiedTickets / totalTickets) * 100) : 0,
      upcomingEvents,
      pastEvents,
      ongoingEvents,
      totalCertificates,
      sentCertificates,
    }

    console.log('📊 Comprehensive dashboard stats fetched successfully:', stats);
    return stats;
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    return {
      totalEvents: 0,
      totalParticipants: 0,  
      totalTickets: 0,
      verifiedTickets: 0,
      availableTickets: 0,
      registrationRate: 0,
      upcomingEvents: 0,
      pastEvents: 0,
      ongoingEvents: 0,
      totalCertificates: 0,
      sentCertificates: 0,
    }
  }
}

async function getRecentEvents() {
  try {
    console.log('🔍 Starting comprehensive events fetch...');
    
    // Test database connection first
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error('❌ Database connection failed in getRecentEvents')
      return []
    }

    console.log('🔍 Fetching events with complete statistics and status...');

    // Enhanced query to get events with complete statistics and status
    const [eventRows] = await db.execute(`
      SELECT 
        e.id, e.name, e.slug, e.type, e.location, e.description, 
        e.start_time, e.end_time, e.quota, e.ticket_design, 
        e.ticket_design_size, e.ticket_design_type, 
        e.created_at, e.updated_at,
        COALESCE(ticket_stats.total_tickets, 0) as total_tickets,
        COALESCE(ticket_stats.verified_tickets, 0) as verified_tickets,
        COALESCE(ticket_stats.available_tickets, 0) as available_tickets,
        CASE 
          WHEN e.start_time > NOW() THEN 'upcoming'
          WHEN e.start_time <= NOW() AND e.end_time >= NOW() THEN 'ongoing'
          ELSE 'completed'
        END as event_status,
        DATEDIFF(e.start_time, NOW()) as days_until_start,
        COALESCE(participant_stats.participant_count, 0) as participant_count
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
      LEFT JOIN (
        SELECT 
          t.event_id,
          COUNT(p.id) as participant_count
        FROM tickets t
        LEFT JOIN participants p ON t.id = p.ticket_id
        GROUP BY t.event_id
      ) participant_stats ON e.id = participant_stats.event_id
      ORDER BY 
        CASE 
          WHEN e.start_time > NOW() THEN 1
          WHEN e.start_time <= NOW() AND e.end_time >= NOW() THEN 2
          ELSE 3
        END,
        e.start_time ASC
    `);
    
    const events = eventRows as any[];
    console.log(`📊 Found ${events.length} events with complete statistics and status`);
    
    // Log sample event for debugging
    if (events.length > 0) {
      console.log('📝 Sample event data:', {
        id: events[0].id,
        name: events[0].name,
        status: events[0].event_status,
        total_tickets: events[0].total_tickets,
        verified_tickets: events[0].verified_tickets,
        participant_count: events[0].participant_count,
        days_until_start: events[0].days_until_start,
        ticket_design: events[0].ticket_design
      });
    }
    
    return events;
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    return [];
  }
}

async function getRecentActivity() {
  try {
    console.log('🔍 Fetching recent activity...');
    
    const isConnected = await testConnection()
    if (!isConnected) {
      console.error('❌ Database connection failed in getRecentActivity')
      return []
    }

    // Get recent registrations with event details
    const [activityRows] = await db.execute(`
      SELECT 
        p.id,
        p.name as participant_name,
        p.email,
        p.organization,
        p.registered_at,
        e.name as event_name,
        e.type as event_type,
        e.start_time,
        'registration' as activity_type
      FROM participants p
      JOIN tickets t ON p.ticket_id = t.id
      JOIN events e ON t.event_id = e.id
      ORDER BY p.registered_at DESC
      LIMIT 10
    `);
    
    const activities = activityRows as any[];
    console.log(`📊 Found ${activities.length} recent activities`);
    
    return activities;
  } catch (error) {
    console.error('❌ Error fetching recent activity:', error);
    return [];
  }
}

async function getEventTypeStats() {
  try {
    console.log('🔍 Fetching event type statistics...');
    
    const isConnected = await testConnection()
    if (!isConnected) {
      return { 
        seminars: 0, 
        workshops: 0,
        seminarParticipants: 0,
        workshopParticipants: 0 
      }
    }

    const [typeStats] = await db.execute(`
      SELECT 
        type,
        COUNT(*) as count,
        SUM(COALESCE(ticket_stats.verified_tickets, 0)) as total_participants
      FROM events e
      LEFT JOIN (
        SELECT 
          event_id,
          SUM(CASE WHEN is_verified = TRUE THEN 1 ELSE 0 END) as verified_tickets
        FROM tickets 
        GROUP BY event_id
      ) ticket_stats ON e.id = ticket_stats.event_id
      GROUP BY type
    `);
    
    const stats = typeStats as any[];
    const result = { 
      seminars: 0, 
      workshops: 0, 
      seminarParticipants: 0, 
      workshopParticipants: 0 
    };
    
    stats.forEach(stat => {
      if (stat.type === 'Seminar') {
        result.seminars = stat.count;
        result.seminarParticipants = stat.total_participants || 0;
      } else if (stat.type === 'Workshop') {
        result.workshops = stat.count;
        result.workshopParticipants = stat.total_participants || 0;
      }
    });
    
    console.log('📊 Event type stats:', result);
    return result;
  } catch (error) {
    console.error('❌ Error fetching event type stats:', error);
    return { 
      seminars: 0, 
      workshops: 0, 
      seminarParticipants: 0, 
      workshopParticipants: 0 
    };
  }
}

export default async function DashboardPage() {
  console.log('🚀 Loading enhanced dashboard page...');
  
  const [stats, recentEvents, recentActivity, eventTypeStats] = await Promise.all([
    getDashboardStats(),
    getRecentEvents(),
    getRecentActivity(),
    getEventTypeStats()
  ]);

  console.log('📊 Final enhanced dashboard data:', {
    stats,
    eventsCount: recentEvents.length,
    activitiesCount: recentActivity.length,
    eventTypeStats
  });

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
          <p className="text-gray-600">Comprehensive overview of your event management system</p>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Events</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalEvents}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {stats.upcomingEvents} upcoming
                  </span>
                  {stats.ongoingEvents > 0 && (
                    <>
                      <span className="text-sm text-gray-400">•</span>
                      <span className="text-sm text-yellow-600 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {stats.ongoingEvents} ongoing
                      </span>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {eventTypeStats.seminars} seminars • {eventTypeStats.workshops} workshops
                </div>
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
                <p className="text-sm text-green-600 mt-1 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Registered users
                </p>
                <div className="text-xs text-gray-500 mt-1">
                  Seminars: {eventTypeStats.seminarParticipants} • Workshops: {eventTypeStats.workshopParticipants}
                </div>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Ticket Status</p>
                <p className="text-3xl font-bold text-gray-900">{stats.verifiedTickets}/{stats.totalTickets}</p>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-orange-600">{stats.availableTickets} available</span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-purple-600">{stats.registrationRate}% filled</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${stats.registrationRate}%` }}
                  ></div>
                </div>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Ticket className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Certificates</p>
                <p className="text-3xl font-bold text-gray-900">{stats.sentCertificates}/{stats.totalCertificates}</p>
                <p className="text-sm text-purple-600 mt-1 flex items-center">
                  <Award className="h-4 w-4 mr-1" />
                  {stats.totalCertificates - stats.sentCertificates} pending
                </p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-purple-600 h-1.5 rounded-full transition-all duration-300" 
                    style={{ width: `${stats.totalCertificates > 0 ? (stats.sentCertificates / stats.totalCertificates) * 100 : 0}%` }}
                  ></div>
                </div>
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
            <div className="mt-3 text-blue-200 text-xs">
              {stats.totalEvents} total events
            </div>
          </Link>

          <Link href="/dashboard/participants" className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-xl text-white hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-105">
            <Users className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Participants</h3>
            <p className="text-green-100 text-sm">View and manage participants</p>
            <div className="mt-3 text-green-200 text-xs">
              {stats.totalParticipants} registered
            </div>
          </Link>

          <Link href="/dashboard/certificates" className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-xl text-white hover:from-purple-600 hover:to-purple-700 transition-all transform hover:scale-105">
            <Award className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Certificates</h3>
            <p className="text-purple-100 text-sm">Generate and manage certificates</p>
            <div className="mt-3 text-purple-200 text-xs">
              {stats.sentCertificates}/{stats.totalCertificates} sent
            </div>
          </Link>

          <Link href="/dashboard/reports" className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 rounded-xl text-white hover:from-orange-600 hover:to-orange-700 transition-all transform hover:scale-105">
            <BarChart3 className="h-8 w-8 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Reports</h3>
            <p className="text-orange-100 text-sm">View analytics and reports</p>
            <div className="mt-3 text-orange-200 text-xs">
              {stats.registrationRate}% avg. fill rate
            </div>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* All Events - Enhanced */}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">All Events ({recentEvents.length})</h3>
              <Link href="/dashboard/events" className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1">
                <span>Manage All</span>
                <Eye className="h-4 w-4" />
              </Link>
            </div>

            {recentEvents.length > 0 ? (
              <div className="space-y-4">
                {recentEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className={`p-2 rounded-lg ${
                        event.event_status === 'upcoming' ? 'bg-green-100' :
                        event.event_status === 'ongoing' ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        <Calendar className={`h-5 w-5 ${
                          event.event_status === 'upcoming' ? 'text-green-600' :
                          event.event_status === 'ongoing' ? 'text-yellow-600' : 'text-gray-600'
                        }`} />
                      </div>
                      {event.ticket_design && (
                        <img 
                          src={event.ticket_design} 
                          alt="Ticket Design" 
                          className="w-12 h-8 object-cover rounded border border-gray-200"
                          onError={(e) => {
                            console.log('Image failed to load:', event.ticket_design)
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-semibold text-gray-900">{event.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            event.event_status === 'upcoming' ? 'bg-green-100 text-green-800' :
                            event.event_status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {event.event_status}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            event.type === 'Seminar' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                          }`}>
                            {event.type}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            <MapPin className="h-3 w-3" />
                            <span>{event.location}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatDateTime(event.start_time)}</span>
                          </div>
                          {event.event_status === 'upcoming' && event.days_until_start !== null && (
                            <span className="text-green-600 font-medium">
                              {event.days_until_start > 0 ? `${event.days_until_start} days left` : 'Starting today'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {event.verified_tickets || 0}/{event.total_tickets || 0} Registered
                      </p>
                      <p className="text-xs text-gray-500 mb-2">
                        {event.participant_count || 0} participants
                      </p>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${Math.round(((event.verified_tickets || 0) / Math.max(event.total_tickets || 1, 1)) * 100)}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.round(((event.verified_tickets || 0) / Math.max(event.total_tickets || 1, 1)) * 100)}% filled
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

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Recent Activity</h3>
              <Link href="/dashboard/participants" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View All
              </Link>
            </div>

            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="bg-green-100 p-2 rounded-full">
                      <Users className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {activity.participant_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {activity.organization && `${activity.organization} • `}
                        {activity.event_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDateTime(activity.registered_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        activity.event_type === 'Seminar' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {activity.event_type}
                      </span>
                      {new Date(activity.start_time) > new Date() && (
                        <span className="text-xs text-green-600 font-medium">Upcoming</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Explicitly mark this file as a module
export {};