import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    // Client scoped to the CALLER's own JWT — used only to verify who is calling.
    // This never touches the service_role key and cannot bypass RLS.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerErr } = await supabaseClient.auth.getUser()
    if (callerErr || !caller) throw new Error('Invalid or expired session')

    // Confirm the caller is actually an Admin before doing anything privileged
    const { data: callerProfile, error: profileErr } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (profileErr || callerProfile?.role !== 'Admin') {
      return new Response(JSON.stringify({ error: 'Only Admins can create users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, full_name, role, allowed_pages, password } = await req.json()
    if (!email) throw new Error('Email is required')
    if (!password || password.length < 6) {
      throw new Error('Password is required and must be at least 6 characters')
    }

    // Admin client — service_role bypasses RLS and creates the user
    // WITHOUT ever signing in as them in any browser session.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const siteUrl = Deno.env.get('SITE_URL') ?? ''

    // Unconfirmed-until-clicked flow: the Admin sets the password, but the
    // account is created UNCONFIRMED. Supabase blocks password sign-in for
    // unconfirmed accounts ("Email not confirmed" error), so the staff
    // member genuinely cannot log in until they click the activation link
    // we email them below. generateLink() with type 'signup' both creates
    // the user AND returns a real, working confirmation link in one step —
    // that link is what we put in our own custom email (Supabase's default
    // "Confirm signup" template is not used here).
    const { data: linkData, error: createErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        data: { full_name },
        redirectTo: siteUrl ? `${siteUrl}/login` : undefined,
      },
    })
    if (createErr) throw createErr

    const newUserId = linkData.user.id
    const activationLink = linkData.properties.action_link

    const { error: insertErr } = await supabaseAdmin.from('profiles').insert([{
      id: newUserId,
      email,
      full_name,
      role: role || 'Staff',
      allowed_pages: allowed_pages || [],
    }])

    if (insertErr) {
      // Roll back the auth user if the profile insert fails, so we never
      // end up with an orphaned login that has no profile/permissions row.
      await supabaseAdmin.auth.admin.deleteUser(newUserId)
      throw insertErr
    }

    // Send the real activation link via Resend. Until the staff member
    // clicks this, their account stays unconfirmed and they cannot sign in
    // — even with the correct email + password. The password itself is
    // never included in the email — the Admin shares that separately.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    let emailSent = false
    let emailError = null

    if (resendApiKey) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Mauli Decorators <onboarding@resend.dev>',
            to: email,
            subject: 'Activate your Mauli Decorators account',
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Welcome to Mauli Decorators, ${full_name || ''}!</h2>
                <p>An account has been created for you on the Mauli Decorators dashboard.</p>
                <p><strong>You must accept this invitation before you can log in.</strong></p>
                <p style="margin: 24px 0;">
                  <a href="${activationLink}" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
                    Accept &amp; Activate Account
                  </a>
                </p>
                <p>Your admin will share your login email and password with you separately.</p>
                <p style="font-size:12px;color:#888;">If you weren't expecting this, you can ignore this email.</p>
              </div>
            `,
          }),
        })

        if (!emailRes.ok) {
          emailError = await emailRes.text()
        } else {
          emailSent = true
        }
      } catch (e) {
        emailError = e.message
      }
    } else {
      emailError = 'RESEND_API_KEY secret is not set'
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      email_sent: emailSent,
      email_error: emailSent ? null : emailError,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})