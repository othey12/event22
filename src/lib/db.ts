import mysql from 'mysql2/promise'

// Create connection pool for better performance
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'bismillah123',
  database: process.env.DB_NAME || 'event_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 60000,
  acquireTimeout: 60000,
  timeout: 60000,
  charset: 'utf8mb4'
})

// Test connection function
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Initialize database if tables don't exist
export async function initializeDatabase(): Promise<boolean> {
  try {
    const connection = await pool.getConnection()

    // Check if events table exists
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'events'",
      [process.env.DB_NAME || 'event_management']
    )

    if ((tables as any[]).length === 0) {
      console.log('⚠️ Tables not found, please ensure database is initialized')
    } else {
      console.log('✅ Database tables exist')
    }

    connection.release()
    return true
  } catch (error) {
    console.error('❌ Database initialization check failed:', error)
    return false
  }
}

// Initialize on module load
initializeDatabase()

export default pool