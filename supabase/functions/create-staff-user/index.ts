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

    const { email, full_name, role, allowed_pages } = await req.json()
    if (!email) throw new Error('Email is required')

    // Admin client — service_role bypasses RLS and creates the user
    // WITHOUT ever signing in as them in any browser session.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const siteUrl = Deno.env.get('SITE_URL')
    const inviteOptions = { data: { full_name } }
    if (siteUrl) {
      inviteOptions.redirectTo = `${siteUrl}/reset-password`
    }

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      inviteOptions
    )
    if (createErr) throw createErr

    const { error: insertErr } = await supabaseAdmin.from('profiles').insert([{
      id: newUser.user.id,
      email,
      full_name,
      role: role || 'Staff',
      allowed_pages: allowed_pages || [],
    }])

    if (insertErr) {
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