// supabase/functions/send-weekly-report-notifications/index.ts

// --- REMOVED old import ---
// import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts'; // Assuming _shared/cors.ts is correct

// Define type for profile data we need
interface UserProfile {
  id: string;
  phone: string;
}

console.log('Starting send-weekly-report-notifications function...');

// --- Use Deno.serve instead of imported serve ---
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );
    console.log('Supabase admin client initialized.');

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio credentials missing in environment variables.');
      throw new Error('Twilio credentials missing.');
    }
    console.log('Twilio credentials retrieved.');

    console.log('Querying profiles for eligible users...');
    const { data: eligibleUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone')
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    console.log(`Found ${eligibleUsers?.length ?? 0} eligible users for weekly report notification.`);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No eligible users found for weekly notification.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results = [];
    const reportUrl = `${Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000'}/weekly-report`;

    for (const user of eligibleUsers as UserProfile[]) {
      const messageBody = `📊 Your Jo App weekly report is ready! See your progress and insights here: ${reportUrl}`;
      const body = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`Attempting to send weekly report SMS to user ${user.id} at ${user.phone}`);
      // --- FIXED: Catch as unknown, add type check ---
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: headers, body: body.toString() });
        const responseData = await response.json();
        if (!response.ok) {
          console.error(`Twilio error for user ${user.id}: Status ${response.status}`, responseData);
          results.push({ userId: user.id, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`Weekly report SMS sent successfully to user ${user.id}. SID: ${responseData.sid}`);
          results.push({ userId: user.id, phone: user.phone, status: 'success', sid: responseData.sid });
        }
      } catch (fetchError: unknown) { // Catch as unknown
        console.error(`Workspace error sending weekly report SMS to user ${user.id}:`, fetchError);
         // Check if it's an Error instance before accessing message
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' });
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay
    }

    console.log('Finished sending weekly report notifications.');
    return new Response(JSON.stringify({ message: 'Weekly report notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  // --- FIXED: Catch as unknown, add type check ---
  } catch (error: unknown) {
    console.error('Unhandled error in weekly report function:', error);
    // Check if it's an Error instance before accessing message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});