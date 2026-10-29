
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5500'
}));

app.use(express.json());

let supabase = null;

if (
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

app.get('/', (req, res) => {
  res.json({
    message: 'Farm Share Schedule API is running!',
    status: 'success'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    application: 'Farm Share Schedule',
    databaseConfigured: Boolean(supabase)
  });
});

app.get('/api/db-check', async (req, res) => {
  if (!supabase) {
    return res.status(503).json({
      success: false,
      message: 'Supabase credentials are missing from backend/.env'
    });
  }

  try {
    const { error } = await supabase
      .from('farms')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Supabase check failed:', error.message);

      return res.status(500).json({
        success: false,
        message: 'Supabase query failed. Check your project URL, key, and database setup.'
      });
    }

    return res.json({
      success: true,
      message: 'Supabase connection successful!'
    });
  } catch (error) {
    console.error('Database check error:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Unexpected database connection error.'
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Farm Share Schedule API running at http://localhost:${PORT}`);
});
