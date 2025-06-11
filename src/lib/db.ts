import mysql from 'mysql2/promise';

const dbConfig: mysql.PoolOptions = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'bismillah123',
  database: process.env.DB_NAME || 'event_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timeout: 60000,
  charset: 'utf8mb4'
};

console.log('🔧 Database Configuration:', {
  host: dbConfig.host,
  user: dbConfig.user,
  database: dbConfig.database,
  port: dbConfig.port || 3306
});

const pool = mysql.createPool(dbConfig);

export async function testConnection(): Promise<boolean> {
  let connection: mysql.PoolConnection | undefined;
  try {
    console.log('🔍 Testing database connection...');
    connection = await pool.getConnection();
    await connection.ping();
    console.log('✅ Database connection successful');
    
    // Test if database exists and has tables
    const [tables] = await connection.execute(
      "SHOW TABLES FROM " + dbConfig.database
    );
    console.log('📋 Available tables:', (tables as any[]).map(t => Object.values(t)[0]));
    
    return true;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('❌ Database connection failed:', error.message);
      console.error('🔧 Connection details:', {
        host: dbConfig.host,
        user: dbConfig.user,
        database: dbConfig.database
      });
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
    console.log('🚀 Initializing database...');
    connection = await pool.getConnection();

    // Check if tables exist
    const [rows] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'events'",
      [dbConfig.database]
    );

    const tables = rows as mysql.RowDataPacket[];
    
    if (tables.length === 0) {
      console.log('⚠️ Events table not found, please ensure database is initialized');
      return false;
    } else {
      console.log('✅ Database tables exist');
      
      // Get detailed statistics with better error handling
      try {
        const [eventCount] = await connection.execute('SELECT COUNT(*) as count FROM events');
        const [ticketCount] = await connection.execute('SELECT COUNT(*) as count FROM tickets');
        const [participantCount] = await connection.execute('SELECT COUNT(*) as count FROM participants');
        const [verifiedCount] = await connection.execute('SELECT COUNT(*) as count FROM tickets WHERE is_verified = TRUE');
        
        const eventCountResult = eventCount as mysql.RowDataPacket[];
        const ticketCountResult = ticketCount as mysql.RowDataPacket[];
        const participantCountResult = participantCount as mysql.RowDataPacket[];
        const verifiedCountResult = verifiedCount as mysql.RowDataPacket[];
        
        console.log(`📊 Database Statistics:
          - Events: ${eventCountResult[0].count}
          - Tickets: ${ticketCountResult[0].count}
          - Participants: ${participantCountResult[0].count}
          - Verified Tickets: ${verifiedCountResult[0].count}`);
      } catch (statsError) {
        console.error('⚠️ Error fetching database statistics:', statsError);
      }
        
      return true;
    }
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

// Test connection immediately
testConnection().then(isConnected => {
  if (isConnected) {
    initializeDatabase();
  }
});

export default pool;