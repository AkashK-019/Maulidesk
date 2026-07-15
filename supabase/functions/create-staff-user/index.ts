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
    // email_confirm: false means Supabase still emails the user a confirmation
    // link (via the "Confirm signup" template) which they must click to
    // activate the account, but the password is already set — no separate
    // "set your password" step is needed on their end.
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
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

    return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})