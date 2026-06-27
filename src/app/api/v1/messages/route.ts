import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/auth/api-context'
import { toApiErrorResponse } from '@/lib/api/v1/respond'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import {
  sanitizePhoneForMeta,
  isValidE164,
  phoneVariants,
  isRecipientNotAllowedError,
} from '@/lib/whatsapp/phone-utils'
import {
  sendTextMessage,
  sendTemplateMessage,
  sendMediaMessage,
  type MediaKind,
} from '@/lib/whatsapp/meta-api'
import { decrypt, isLegacyFormat, encrypt } from '@/lib/whatsapp/encryption'
import type { MessageTemplate } from '@/types'
import { isMessageTemplate } from '@/lib/whatsapp/template-row-guard'

export async function POST(request: Request) {
  try {
    // 1. Authenticate using API Key and ensure they have 'messages:send' scope
    const ctx = await requireApiKey(request, 'messages:send')
    const accountId = ctx.accountId

    const body = await request.json()
    const {
      to,
      message_type,
      content_text,
      media_url,
      filename,
      template_name,
      template_language,
      template_params,
      template_message_params,
    } = body

    if (!to || !message_type) {
      return NextResponse.json(
        { error: '`to` (phone number) and `message_type` are required' },
        { status: 400 }
      )
    }

    const MEDIA_KINDS = ['image', 'video', 'document', 'audio'] as const
    const isMediaKind = (MEDIA_KINDS as readonly string[]).includes(message_type)
    const VALID_MESSAGE_TYPES = ['text', 'template', ...MEDIA_KINDS] as const

    if (!(VALID_MESSAGE_TYPES as readonly string[]).includes(message_type)) {
      return NextResponse.json(
        { error: `Unsupported message_type "${message_type}"` },
        { status: 400 }
      )
    }

    if (message_type === 'text' && !content_text) {
      return NextResponse.json(
        { error: 'content_text is required for text messages' },
        { status: 400 }
      )
    }

    if (message_type === 'template' && !template_name) {
      return NextResponse.json(
        { error: 'template_name is required for template messages' },
        { status: 400 }
      )
    }

    const sanitizedPhone = sanitizePhoneForMeta(to)
    if (!isValidE164(sanitizedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      )
    }

    // Since API Context gives us a read/write supabase client bound to the API key roles
    // Wait, the api_keys do not have RLS context yet if they are not users, 
    // actually they do, `ctx.supabase` uses a service role or a specific setup for API.
    // Let's use `ctx.supabase` which is provided by `requireApiKey`.
    const supabase = ctx.supabase

    // 2. Lookup or Create Contact
    let contactId: string
    let workingPhone = sanitizedPhone

    const { data: existingContact } = await supabase
      .from('contacts')
      .select('id, phone')
      .eq('account_id', accountId)
      .eq('phone', sanitizedPhone)
      .maybeSingle()

    if (existingContact) {
      contactId = existingContact.id
    } else {
      const { data: newContact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          account_id: accountId,
          phone: sanitizedPhone,
          name: sanitizedPhone,
        })
        .select('id')
        .single()
      
      if (contactError || !newContact) {
        return NextResponse.json(
          { error: 'Failed to create contact' },
          { status: 500 }
        )
      }
      contactId = newContact.id
    }

    // 3. Lookup or Create Conversation
    let conversationId: string
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('account_id', accountId)
      .eq('contact_id', contactId)
      .maybeSingle()

    if (existingConv) {
      conversationId = existingConv.id
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          account_id: accountId,
          contact_id: contactId,
          status: 'open',
          unread_count: 0
        })
        .select('id')
        .single()
      
      if (convError || !newConv) {
        return NextResponse.json(
          { error: 'Failed to create conversation' },
          { status: 500 }
        )
      }
      conversationId = newConv.id
    }

    // 4. Fetch WhatsApp Config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('account_id', accountId)
      .single()

    if (configError || !config) {
      return NextResponse.json(
        { error: 'WhatsApp not configured for this account.' },
        { status: 400 }
      )
    }

    const accessToken = decrypt(config.access_token)

    let waMessageId = ''
    let templateRow: MessageTemplate | null = null

    if (message_type === 'template' && template_name) {
      const { data } = await supabase
        .from('message_templates')
        .select('*')
        .eq('account_id', accountId)
        .eq('name', template_name)
        .eq('language', template_language || 'en_US')
        .maybeSingle()
      
      if (data && isMessageTemplate(data)) {
        templateRow = data
      }
    }

    const attempt = async (phone: string): Promise<string> => {
      if (message_type === 'template') {
        const result = await sendTemplateMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          templateName: template_name,
          language: template_language || 'en_US',
          template: templateRow ?? undefined,
          messageParams: template_message_params ?? undefined,
          params: template_params || [],
        })
        return result.messageId
      }
      if (isMediaKind) {
        const result = await sendMediaMessage({
          phoneNumberId: config.phone_number_id,
          accessToken,
          to: phone,
          kind: message_type as MediaKind,
          link: media_url,
          caption: content_text || undefined,
          filename: filename || undefined,
        })
        return result.messageId
      }
      const result = await sendTextMessage({
        phoneNumberId: config.phone_number_id,
        accessToken,
        to: phone,
        text: content_text,
      })
      return result.messageId
    }

    try {
      const variants = phoneVariants(sanitizedPhone)
      let lastError: unknown = null

      for (const variant of variants) {
        try {
          waMessageId = await attempt(variant)
          workingPhone = variant
          lastError = null
          break
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (!isRecipientNotAllowedError(message)) {
            throw err
          }
          lastError = err
        }
      }

      if (lastError) throw lastError
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown Meta API error'
      return NextResponse.json({ error: `Meta API error: ${message}` }, { status: 502 })
    }

    if (workingPhone !== sanitizedPhone) {
      await supabase
        .from('contacts')
        .update({ phone: workingPhone })
        .eq('id', contactId)
    }

    // 5. Insert Message into DB
    const { data: messageRecord, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'agent',
        content_type: message_type,
        content_text: content_text || null,
        media_url: media_url || null,
        template_name: template_name || null,
        message_id: waMessageId,
        status: 'sent',
      })
      .select('id')
      .single()

    if (msgError) {
      return NextResponse.json(
        { error: `Message sent to Meta but failed to save to DB: ${msgError.message}` },
        { status: 500 }
      )
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({
        last_message_text: content_text || `[${message_type}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    return NextResponse.json({
      success: true,
      message_id: messageRecord.id,
      whatsapp_message_id: waMessageId,
    })

  } catch (error: any) {
    return toApiErrorResponse(error)
  }
}
