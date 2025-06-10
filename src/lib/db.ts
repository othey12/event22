import mysql from 'mysql2/promise';

interface DBConfig extends mysql.PoolOptions {
  host: string;
  user: string;
  password: string;
  database: string;
}

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
} as DBConfig);

export async function testConnection(): Promise<boolean> {
  let connection: mysql.PoolConnection | undefined;
  try {
    connection = await pool.getConnection();
    await connection.ping();
    console.log('✅ Database connection successful');
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('❌ Database connection failed:', error.message);
    } else {
      console.error('❌ Unknown database connection error occurred');
    }
    return false;
  } finally {
    if (connection) connection.release();
  }
}

export async function initializeDatabase(): Promise<boolean> {
  let connection: mysql.PoolConnection | undefined;
  try {
    connection = await pool.getConnection();

    // Check if tables exist
    const [rows] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'events'",
      [process.env.DB_NAME || 'event_management']
    );

    const tables = rows as mysql.RowDataPacket[];
    
    if (tables.length === 0) {
      console.log('⚠️ Tables not found, please ensure database is initialized');
    } else {
      console.log('✅ Database tables exist');
      
      // Check if we have sample data
      const [eventCount] = await connection.execute('SELECT COUNT(*) as count FROM events');
      const eventCountResult = eventCount as mysql.RowDataPacket[];
      console.log(`📊 Found ${eventCountResult[0].count} events in database`);
    }

    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('❌ Database initialization check failed:', error.message);
    } else {
      console.error('❌ Unknown database initialization error occurred');
    }
    return false;
  } finally {
    if (connection) connection.release();
  }
}

// Initialize on module load
initializeDatabase().catch((error) => {
  console.error('Failed to initialize database:', error);
});

export default pool;