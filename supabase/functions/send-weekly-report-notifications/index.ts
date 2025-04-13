// supabase/functions/send-weekly-report-notifications/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
// Assuming you created _shared/cors.ts
import { corsHeaders } from '../_shared/cors.ts';

// Define type for profile data we need
interface UserProfile {
  id: string;
  phone: string; // Assuming phone is not null based on query
}

console.log('Starting send-weekly-report-notifications function...');

serve(async (req: Request) => {
  // 1. Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );
    console.log('Supabase admin client initialized.');

    // 3. Get Twilio Credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio credentials missing in environment variables.');
      throw new Error('Twilio credentials missing.');
    }
    console.log('Twilio credentials retrieved.');

    // 4. Query Profiles: Get eligible users (SMS enabled, has phone)
    // No need to check daily_logs for this reminder
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 5. Prepare Twilio API Request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // 6. Send SMS to each eligible user
    const results = [];
    // Construct the link to the weekly report page (adjust if your base URL is different)
    // For local dev, might be localhost, for prod, your actual app URL
    const reportUrl = `${Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000'}/weekly-report`;

    for (const user of eligibleUsers as UserProfile[]) { // Cast needed as select returns generic object array
      // --- MODIFIED MESSAGE ---
      const messageBody = `📊 Your Jo App weekly report is ready! See your progress and insights here: ${reportUrl}`;
      // --- END MODIFIED MESSAGE ---
      const body = new URLSearchParams({
        To: user.phone,
        From: fromPhoneNumber,
        Body: messageBody,
      });

      console.log(`Attempting to send weekly report SMS to user ${user.id} at ${user.phone}`);
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
      } catch (fetchError) {
        console.error(`Fetch error sending weekly report SMS to user ${user.id}:`, fetchError);
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError.message });
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay
    }

    // 7. Return Response
    console.log('Finished sending weekly report notifications.');
    return new Response(JSON.stringify({ message: 'Weekly report notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Unhandled error in weekly report function:', error); // Updated log message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
