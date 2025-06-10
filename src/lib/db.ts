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

    // Corrected execute syntax without type argument
    const [rows] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = ? AND table_name = 'events'",
      [process.env.DB_NAME || 'event_management']
    );

    // Type assertion for the rows
    const tables = rows as mysql.RowDataPacket[];
    
    if (tables.length === 0) {
      console.log('⚠️ Tables not found, please ensure database is initialized');
    } else {
      console.log('✅ Database tables exist');
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