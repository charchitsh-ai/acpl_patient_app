import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { engineSendText } from '@/lib/automations/meta-send'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, phone, email, source } = body

    console.log(`[Google Sheet Lead] Received lead: Name="${name}", Phone="${phone}", Email="${email}", Source="${source}"`)

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)

    // Fetch primary WhatsApp config to link user_id
    const db = supabaseAdmin()
    const { data: configs, error: configErr } = await db
      .from('whatsapp_config')
      .select('*')
      .limit(1)

    if (configErr || !configs || configs.length === 0) {
      console.error('[Google Sheet Lead] No WhatsApp config found to map user.')
      return NextResponse.json({ error: 'System not configured' }, { status: 500 })
    }

    const primaryConfig = configs[0]
    const userId = primaryConfig.user_id

    // Find or create contact
    const contactOutcome = await findOrCreateContact(userId, normalizedPhone, name || 'Sheet Lead', email, source)
    if (!contactOutcome) {
      return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
    }
    const contact = contactOutcome.contact

    // Find or create conversation
    const conversation = await findOrCreateConversation(userId, contact.id)
    if (!conversation) {
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
    }

    // Trigger CRM automations for triggers: 'new_contact_created'
    if (contactOutcome.wasCreated) {
      runAutomationsForTrigger({
        userId,
        triggerType: 'new_contact_created',
        contactId: contact.id,
        context: {
          message_text: `Google Sheet Lead: Source ${source || 'Sheet'}`,
          conversation_id: conversation.id,
        }
      }).catch((err) => console.error('[Google Sheet Lead] Automation dispatch failed:', err))
    }

    return NextResponse.json({ 
      success: true, 
      contactId: contact.id, 
      conversationId: conversation.id,
      wasCreated: contactOutcome.wasCreated 
    }, { status: 200 })

  } catch (error) {
    console.error('[Google Sheet Lead] Webhook handler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function findOrCreateContact(
  userId: string,
  phone: string,
  name: string,
  email?: string,
  source?: string
): Promise<{ contact: any; wasCreated: boolean } | null> {
  const db = supabaseAdmin()

  // Fetch existing contacts
  const { data: contacts, error } = await db
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('[Google Sheet Lead] Error reading contacts table:', error)
    return null
  }

  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))

  if (existing) {
    // Update name / email if they are empty
    const updates: Record<string, any> = {}
    if (name && !existing.name) updates.name = name
    if (email && !existing.email) updates.email = email
    
    // Add a custom tag or note about source if needed
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString()
      await db.from('contacts').update(updates).eq('id', existing.id)
    }

    return { contact: { ...existing, ...updates }, wasCreated: false }
  }

  // Create new contact
  const { data: newContact, error: createError } = await db
    .from('contacts')
    .insert({
      user_id: userId,
      phone,
      name,
      email: email || null
    })
    .select()
    .single()

  if (createError) {
    console.error('[Google Sheet Lead] Error inserting contact:', createError)
    return null
  }

  // Add source as tag if provided
  if (source) {
    try {
      // Look for tag or create tag
      const { data: tagData } = await db.from('tags').select('id').eq('name', source).eq('user_id', userId).maybeSingle()
      let tagId = tagData?.id
      if (!tagId) {
        const { data: newTag } = await db.from('tags').insert({ name: source, user_id: userId, color: '#4F46E5' }).select('id').single()
        tagId = newTag?.id
      }
      if (tagId) {
        await db.from('contact_tags').insert({ contact_id: newContact.id, tag_id: tagId })
      }
    } catch (tagErr) {
      console.warn('[Google Sheet Lead] Failed to auto-tag contact source:', tagErr)
    }
  }

  return { contact: newContact, wasCreated: true }
}

async function findOrCreateConversation(userId: string, contactId: string) {
  const db = supabaseAdmin()

  const { data: existing, error } = await db
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (!error && existing) return existing

  const { data: newConv, error: createError } = await db
    .from('conversations')
    .insert({
      user_id: userId,
      contact_id: contactId
    })
    .select()
    .single()

  if (createError) {
    console.error('[Google Sheet Lead] Error creating conversation:', createError)
    return null
  }

  return newConv
}
