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

    // Direct-create flow: the Admin sets the password themselves, right here.
    // Note: admin.createUser() never auto-sends a confirmation email (only
    // inviteUserByEmail()/client signUp() do that) — so relying on an email
    // step here would leave the account stuck at "waiting for verification"
    // forever unless something else triggers it. Since the Admin already
    // knows and is directly assigning this person's email + password, we
    // skip email confirmation entirely: email_confirm: true activates the
    // account immediately so they can log in right away with the
    // credentials the Admin gives them.
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createErr) throw createErr

    const { error: insertErr } = await supabaseAdmin.from('profiles').insert([{
      id: newUser.user.id,
      email,
      full_name,
      role: role || 'Staff',
      allowed_pages: allowed_pages || [],
    }])

    if (insertErr) {
      // Roll back the auth user if the profile insert fails, so we never
      // end up with an orphaned login that has no profile/permissions row.
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw insertErr
    }

    // Send a welcome/acceptance email via Resend, using the same API key
    // configured as your Supabase Auth SMTP password. This is a direct call
    // to Resend's API (not Supabase Auth's mailer), since admin.createUser()
    // has no automatic email step. The password itself is never included in
    // the email — the Admin shares that separately, out of band.
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const siteUrl = Deno.env.get('SITE_URL') ?? ''
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
            subject: 'Your Mauli Decorators account is ready',
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2>Welcome to Mauli Decorators, ${full_name || ''}!</h2>
                <p>An account has been created for you on the Mauli Decorators dashboard.</p>
                <p>Your admin will share your login email and password with you separately.</p>
                <p style="margin: 24px 0;">
                  <a href="${siteUrl}/login" style="background:#0d9488;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">
                    Accept &amp; Go to Login
                  </a>
                </p>
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
      user_id: newUser.user.id,
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