const supabase = require("@supabase/supabase-js");
const { DB_URL, SERVICE_ROLE } = require('../data')

module.exports = supabase.createClient(
  DB_URL,
  SERVICE_ROLE
);