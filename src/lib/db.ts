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
  connectTimeout: 60000, // ✅ opsi yang valid
  charset: 'utf8mb4'
})

// ✅ Test connection function yang mengembalikan boolean
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection()
    await connection.ping()
    connection.release()
    console.log('Database connection successful')
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}

// ✅ Inisialisasi database jika tabel belum ada
export async function initializeDatabase(): Promise<boolean> {
  try {
    const connection = await pool.getConnection()

    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'events'",
      [process.env.DB_NAME || 'event_management']
    )

    if ((tables as any[]).length === 0) {
      console.log('Tables not found, creating database schema...')
      // Skema tabel dibuat oleh init.sql di Docker
    } else {
      console.log('Database tables already exist')
    }

    connection.release()
    return true
  } catch (error) {
    console.error('Database initialization failed:', error)
    return false
  }
}

export default pool
