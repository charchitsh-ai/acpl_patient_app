import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/whatsapp/encryption'
import { normalizePhone, phonesMatch } from '@/lib/whatsapp/phone-utils'
import { engineSendText } from '@/lib/automations/meta-send'
import { runAutomationsForTrigger } from '@/lib/automations/engine'

// Lazy-initialized admin client
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

// GET - Webhook verification from Meta
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('hub.mode')
    const challenge = searchParams.get('hub.challenge')
    const verifyToken = searchParams.get('hub.verify_token')

    if (mode !== 'subscribe' || !challenge || !verifyToken) {
      return NextResponse.json(
        { error: 'Missing verification parameters' },
        { status: 400 }
      )
    }

    // Use a custom verify token or fallback to the standard one
    const expectedToken = process.env.META_LEADS_VERIFY_TOKEN || 'aykacare_leads_verify'

    if (verifyToken === expectedToken) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return NextResponse.json(
      { error: 'Verification token mismatch' },
      { status: 403 }
    )
  } catch (error) {
    console.error('Error in Meta Leads verification GET:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Receive lead captured events
export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('[Meta Leads] Webhook received payload:', JSON.stringify(body))

    if (body.object !== 'page' || !body.entry) {
      return NextResponse.json({ status: 'ignored' }, { status: 200 })
    }

    // Run asynchronously to return 200 OK to Meta quickly
    processLeadWebhook(body).catch((err) => {
      console.error('[Meta Leads] Error in asynchronous processing:', err)
    })

    return NextResponse.json({ status: 'received' }, { status: 200 })
  } catch (error) {
    console.error('[Meta Leads] Webhook handler error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function processLeadWebhook(body: any) {
  const db = supabaseAdmin()

  // Get active WhatsApp configurations to map user and decrypt keys
  const { data: configs, error: configErr } = await db
    .from('whatsapp_config')
    .select('*')
    .limit(1)

  if (configErr || !configs || configs.length === 0) {
    console.error('[Meta Leads] No WhatsApp config found in database to link lead integration.')
    return
  }

  const primaryConfig = configs[0]
  const userId = primaryConfig.user_id
  const decryptedAccessToken = decrypt(primaryConfig.access_token)

  // Meta Page Access Token (falls back to Decrypted Access Token)
  const metaAccessToken = process.env.META_PAGE_ACCESS_TOKEN || decryptedAccessToken

  for (const entry of body.entry) {
    if (!entry.changes) continue
    for (const change of entry.changes) {
      if (change.field !== 'leadgen' || !change.value) continue

      const leadgenId = change.value.leadgen_id
      if (!leadgenId) continue

      console.log(`[Meta Leads] Fetching details for Lead ID: ${leadgenId}`)

      // Fetch Lead details from Meta Graph API
      try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${leadgenId}?access_token=${metaAccessToken}`)
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`Meta Graph API returned status ${res.status}: ${errText}`)
        }

        const leadData = await res.json()
        console.log('[Meta Leads] Fetched lead data:', JSON.stringify(leadData))

        // Parse fields dynamically
        let name = ''
        let phone = ''
        let email = ''

        if (leadData.field_data) {
          for (const field of leadData.field_data) {
            const fieldName = field.name.toLowerCase()
            const values = field.values || []
            const value = values[0] || ''

            if (fieldName.includes('name') || fieldName.includes('first') || fieldName.includes('last')) {
              if (fieldName.includes('first')) {
                name = value + ' ' + name
              } else if (fieldName.includes('last')) {
                name = name + ' ' + value
              } else {
                name = value
              }
            } else if (fieldName.includes('phone') || fieldName.includes('mobile')) {
              phone = value
            } else if (fieldName.includes('email') || fieldName.includes('mail')) {
              email = value
            }
          }
        }

        name = name.trim() || 'Lead ' + leadgenId.substring(0, 6)
        if (!phone) {
          console.warn('[Meta Leads] Lead has no phone number, skipping WhatsApp trigger.')
          continue
        }

        const normalizedPhone = normalizePhone(phone)
        console.log(`[Meta Leads] Parsed Lead details: Name="${name}", Phone="${normalizedPhone}", Email="${email}"`)

        // Find or create contact
        const contactOutcome = await findOrCreateContact(userId, normalizedPhone, name, email)
        if (!contactOutcome) continue
        const contact = contactOutcome.contact

        // Find or create conversation
        const conversation = await findOrCreateConversation(userId, contact.id)
        if (!conversation) continue

        // Send a direct WhatsApp welcome message (Standard Text Alert)
        try {
          const welcomeMessage = `Hello ${name}! Thank you for your interest. We received your lead details successfully, and our team will get in touch with you shortly. Have a great day!`
          
          await engineSendText({
            userId,
            conversationId: conversation.id,
            contactId: contact.id,
            text: welcomeMessage
          })
          console.log(`[Meta Leads] Automated WhatsApp welcome sent to ${normalizedPhone}`)
        } catch (sendErr: any) {
          console.error('[Meta Leads] Failed to send automated welcome message:', sendErr.message || sendErr)
        }

        // Trigger CRM automations for triggers: 'new_contact_created' & 'first_inbound_message'
        if (contactOutcome.wasCreated) {
          console.log('[Meta Leads] Triggering CRM new_contact_created automations')
          runAutomationsForTrigger({
            userId,
            triggerType: 'new_contact_created',
            contactId: contact.id,
            context: {
              message_text: `Meta Lead captured: Form ${change.value.form_id || ''}`,
              conversation_id: conversation.id,
            }
          }).catch((err) => console.error('[Meta Leads] Automation dispatch failed:', err))
        }

      } catch (fetchErr) {
        console.error(`[Meta Leads] Error fetching or parsing lead ID ${leadgenId}:`, fetchErr)
      }
    }
  }
}

async function findOrCreateContact(
  userId: string,
  phone: string,
  name: string,
  email?: string
): Promise<{ contact: any; wasCreated: boolean } | null> {
  const db = supabaseAdmin()

  // Fetch existing contacts
  const { data: contacts, error } = await db
    .from('contacts')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('[Meta Leads] Error reading contacts table:', error)
    return null
  }

  const existing = contacts?.find((c: any) => phonesMatch(c.phone, phone))

  if (existing) {
    // Update name / email if they are empty
    const updates: Record<string, any> = {}
    if (name && !existing.name) updates.name = name
    if (email && !existing.email) updates.email = email

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
    console.error('[Meta Leads] Error inserting contact:', createError)
    return null
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
    console.error('[Meta Leads] Error creating conversation:', createError)
    return null
  }

  return newConv
}
