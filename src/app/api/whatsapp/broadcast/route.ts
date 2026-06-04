import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-api'
import { decrypt } from '@/lib/whatsapp/encryption'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
  phonesMatch,
} from '@/lib/whatsapp/phone-utils'
import {
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from '@/lib/rate-limit'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

interface BroadcastResult {
  phone: string
  status: 'sent' | 'failed'
  whatsapp_message_id?: string
  error?: string
}

/**
 * Two input shapes are accepted:
 *
 *   NEW (preferred — supports per-recipient variable substitution):
 *     {
 *       recipients: Array<{ phone: string; params: string[] }>,
 *       template_name, template_language
 *     }
 *
 *   LEGACY (all phones receive the same params — kept so existing
 *   callers don't break):
 *     {
 *       phone_numbers: string[],
 *       template_params: string[],
 *       template_name, template_language
 *     }
 *
 * Previous implementation only supported the legacy shape, and the
 * sending hook was forced to ship every batch with `templateParams[0]`
 * — meaning every recipient got contact-0's personalization. The new
 * shape is what actually fixes that.
 */
interface NewRecipient {
  phone: string
  params?: string[]
}

// Lazy-initialized admin client — same pattern as webhook/route.ts.
// Uses the service-role key so it bypasses RLS when inserting
// conversations and messages on behalf of any user.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * Find an existing open conversation for this user+contact pair, or
 * create one. Uses the service-role client so it bypasses RLS on insert.
 */
async function findOrCreateConversation(userId: string, contactId: string) {
  const { data: existing, error: findError } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .maybeSingle()

  if (!findError && existing) return existing

  const { data: newConv, error: createError } = await supabaseAdmin()
    .from('conversations')
    .insert({ user_id: userId, contact_id: contactId })
    .select()
    .single()

  if (createError) {
    console.error('[broadcast] Error creating conversation:', createError)
    return null
  }
  return newConv
}

/**
 * Find the contact row whose phone matches the given number (for this user).
 * Tries an exact DB match first, then falls back to flexible phonesMatch
 * for numbers that differ only by a trunk-prefix 0.
 * Returns null when no matching contact is found.
 */
async function findContactByPhone(userId: string, phone: string) {
  const { data, error } = await supabaseAdmin()
    .from('contacts')
    .select('id, name, phone')
    .eq('user_id', userId)
    .eq('phone', phone)
    .maybeSingle()

  if (!error && data) return data

  // Fallback: fetch all and do flexible match
  const { data: all } = await supabaseAdmin()
    .from('contacts')
    .select('id, name, phone')
    .eq('user_id', userId)

  if (!all) return null
  return all.find((c: { phone: string }) => phonesMatch(c.phone, phone)) ?? null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Per-user broadcast budget. Note: this limits how often a user
    // can *start* a campaign, not how many messages go out inside
    // one — the fan-out loop below runs without additional gating.
    const limit = checkRateLimit(`broadcast:${user.id}`, RATE_LIMITS.broadcast)
    if (!limit.success) {
      return rateLimitResponse(limit)
    }

    const body = await request.json()
    const {
      recipients: newRecipients,
      phone_numbers,
      template_name,
      template_language,
      template_params,
    } = body

    // Normalize to a list of {phone, params} regardless of shape.
    let recipients: NewRecipient[]
    if (Array.isArray(newRecipients) && newRecipients.length > 0) {
      recipients = newRecipients
    } else if (Array.isArray(phone_numbers) && phone_numbers.length > 0) {
      const shared: string[] = Array.isArray(template_params)
        ? template_params
        : []
      recipients = phone_numbers.map((phone: string) => ({
        phone,
        params: shared,
      }))
    } else {
      return NextResponse.json(
        {
          error:
            'Provide either `recipients` (preferred) or `phone_numbers` — must be a non-empty array',
        },
        { status: 400 }
      )
    }

    if (!template_name) {
      return NextResponse.json(
        { error: 'template_name is required' },
        { status: 400 }
      )
    }

    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        {
          error:
            'WhatsApp not configured. Please set up your WhatsApp integration first.',
        },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    const results: BroadcastResult[] = []
    let sentCount = 0
    let failedCount = 0

    for (const recipient of recipients) {
      const sanitized = sanitizePhoneForMeta(recipient.phone)

      if (!isValidE164(sanitized)) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: 'Invalid phone number format',
        })
        failedCount++
        continue
      }

      // Retry with phone variants on "not in allowed list" so numbers
      // that differ only in a trunk-prefix 0 still reach recipients.
      const variants = phoneVariants(sanitized)
      let sentMessageId: string | null = null
      let lastError: string | null = null

      for (const variant of variants) {
        try {
          const result = await sendTemplateMessage({
            phoneNumberId: config.phone_number_id,
            accessToken,
            to: variant,
            templateName: template_name,
            language: template_language || 'en_US',
            params: recipient.params ?? [],
          })
          sentMessageId = result.messageId
          lastError = null
          break
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error'
          if (!isRecipientNotAllowedError(errorMessage)) {
            lastError = errorMessage
            break
          }
          lastError = errorMessage
          // retry with next variant
        }
      }

      if (sentMessageId) {
        results.push({
          phone: recipient.phone,
          status: 'sent',
          whatsapp_message_id: sentMessageId,
        })
        sentCount++

        // ── Create inbox entry for each successfully sent broadcast ──
        // Find the contact row and upsert a conversation + message so
        // the broadcast template appears in the inbox exactly like a
        // manually-sent template message. Runs best-effort: a failure
        // here never aborts the send loop or changes the API response.
        try {
          const contact = await findContactByPhone(user.id, recipient.phone)
          if (contact) {
            const conversation = await findOrCreateConversation(user.id, contact.id)
            if (conversation) {
              const preview = `[Broadcast] ${template_name}`
              const now = new Date().toISOString()

              // Insert the outbound message row so it appears in the thread
              await supabaseAdmin()
                .from('messages')
                .insert({
                  conversation_id: conversation.id,
                  sender_type: 'agent',
                  content_type: 'template',
                  content_text: preview,
                  template_name,
                  message_id: sentMessageId,
                  status: 'sent',
                  created_at: now,
                })

              // Keep the conversation list preview up to date
              await supabaseAdmin()
                .from('conversations')
                .update({
                  last_message_text: preview,
                  last_message_at: now,
                  updated_at: now,
                })
                .eq('id', conversation.id)
            }
          }
        } catch (inboxErr) {
          console.error(
            `[broadcast] Failed to create inbox entry for ${recipient.phone}:`,
            inboxErr instanceof Error ? inboxErr.message : inboxErr
          )
        }
        // ─────────────────────────────────────────────────────────────
      } else {
        console.error(
          `Failed to send broadcast to ${recipient.phone}:`,
          lastError
        )
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: lastError || 'Unknown error',
        })
        failedCount++
      }
    }

    return NextResponse.json({
      success: true,
      total: recipients.length,
      sent: sentCount,
      failed: failedCount,
      results,
    })
  } catch (error) {
    console.error('Error in WhatsApp broadcast POST:', error)
    return NextResponse.json(
      { error: 'Failed to process broadcast' },
      { status: 500 }
    )
  }
}
