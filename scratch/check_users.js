const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  
  console.log('--- AUTH USERS ---');
  if (authError) {
    console.error(authError);
  } else {
    users.forEach(u => {
      console.log(`ID: ${u.id}, Email: ${u.email}, CreatedAt: ${u.created_at}`);
    });
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*');

  console.log('\n--- PROFILES ---');
  if (profileError) {
    console.error(profileError);
  } else {
    console.log(profiles);
  }
}

run();
