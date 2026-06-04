import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

if (fs.existsSync('.env.local')) {
  const env = dotenv.parse(fs.readFileSync('.env.local'))
  for (const k in env) {
    process.env[k] = env[k]
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data: broadcasts, error: bErr } = await supabase
    .from('broadcasts')
    .select('id, name, status, total_recipients')
    .order('created_at', { ascending: false })
    .limit(5)

  if (bErr) {
    console.error('Error fetching broadcasts:', bErr)
    return
  }

  console.log('--- RECENT BROADCASTS ---')
  console.log(broadcasts)

  for (const b of broadcasts) {
    const { data: recs, error: rErr } = await supabase
      .from('broadcast_recipients')
      .select('status')
      .eq('broadcast_id', b.id)

    if (rErr) {
      console.error(`Error fetching recipients for ${b.name}:`, rErr)
      continue
    }

    const counts = {}
    recs.forEach(r => {
      counts[r.status] = (counts[r.status] || 0) + 1
    })

    console.log(`\nBroadcast: "${b.name}" (${b.id})`)
    console.log('Recipient status counts:', counts)
    console.log('Total in database:', recs.length)
  }
}

check()
