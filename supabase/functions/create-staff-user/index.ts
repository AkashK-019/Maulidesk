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
      return new Response(JSON.stringify({ error: 'Only Admins can delete users' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { userId } = await req.json()
    if (!userId) throw new Error('userId is required')

    // Prevent an Admin from deleting their own account through this flow.
    if (userId === caller.id) {
      return new Response(JSON.stringify({ error: 'You cannot delete your own account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Admin client — service_role bypasses RLS and can delete the Auth user.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Delete the Auth user (this is the part your old direct-delete code was missing).
    const { error: authDeleteErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (authDeleteErr) throw authDeleteErr

    // 2. Delete the profile row too, in case it isn't already handled by
    //    an ON DELETE CASCADE foreign key from profiles.id -> auth.users.id.
    const { error: profileDeleteErr } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    if (profileDeleteErr) throw profileDeleteErr

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})