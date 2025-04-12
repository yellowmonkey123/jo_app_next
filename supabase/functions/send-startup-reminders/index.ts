// supabase/functions/send-startup-reminders/index.ts

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
// Assuming you created _shared/cors.ts (Option A from before)
import { corsHeaders } from '../_shared/cors.ts';
// OR if you chose Option B, make sure corsHeaders is replaced directly below

// Define type for profile data we need
interface UserProfile {
  id: string;
  phone: string; // Assuming phone is not null based on query
}

// Define structure for daily log data we need
interface DailyLogEntry {
    user_id: string;
    startup_completed_at: string | null;
    // log_date is implicitly today based on the query
}

console.log('Starting send-startup-reminders function (v3)...');

serve(async (req: Request) => {
  // 1. Handle preflight OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders }); // Replace corsHeaders if using Option B
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

    // 4. Get Current Date (UTC)
    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date (UTC): ${today}`);

    // --- NEW TWO-QUERY LOGIC ---

    // 5. Query 1: Get potentially eligible profiles (SMS enabled, has phone)
    console.log('Querying profiles for eligible users...');
    const { data: potentialUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone') // Select only needed fields
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found with SMS enabled and phone number.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Replace corsHeaders if using Option B
        status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);

    // Extract user IDs for the next query
    const userIds = potentialUsers.map(u => u.id);

    // 6. Query 2: Get daily logs for today for these specific users
    console.log(`Querying daily_logs for ${userIds.length} users for date ${today}...`);
    const { data: todaysLogs, error: logsError } = await supabaseAdmin
      .from('daily_logs')
      .select('user_id, startup_completed_at') // Select needed fields
      .eq('log_date', today)                  // Filter by today's date
      .in('user_id', userIds);                // Filter by the list of user IDs

    if (logsError) {
      console.error('Error querying daily_logs:', logsError);
      throw logsError;
    }
    console.log(`Found ${todaysLogs?.length ?? 0} daily log entries for today for these users.`);

    // Create a map for quick lookup of today's log status by user_id
    const logStatusMap = new Map<string, { completed: boolean }>();
    todaysLogs?.forEach((log: DailyLogEntry) => {
        logStatusMap.set(log.user_id, { completed: log.startup_completed_at !== null });
    });

    // 7. Filter to find actually eligible users
    const eligibleUsers = potentialUsers.filter((user: UserProfile) => {
        const logStatus = logStatusMap.get(user.id);
        // Eligible if no log entry found for today OR if log entry exists but is not completed
        return !logStatus || !logStatus.completed;
    });

    // --- END TWO-QUERY LOGIC ---

    console.log(`Found ${eligibleUsers.length} eligible users to notify after filtering.`);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No eligible users to notify today.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Replace corsHeaders if using Option B
        status: 200,
      });
    }

    // 8. Prepare Twilio API Request (remains the same)
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // 9. Send SMS to each eligible user (remains the same)
    const results = [];
    for (const user of eligibleUsers) {
      const messageBody = `☀️ Good morning! Just a friendly reminder to complete your Jo App Startup routine today. Let's make it a great day!`;
      const body = new URLSearchParams({
        To: user.phone,
        From: fromPhoneNumber,
        Body: messageBody,
      });

      console.log(`Attempting to send SMS to user ${user.id} at ${user.phone}`);
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: headers, body: body.toString() });
        const responseData = await response.json();
        if (!response.ok) {
          console.error(`Twilio error for user ${user.id}: Status ${response.status}`, responseData);
          results.push({ userId: user.id, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`SMS sent successfully to user ${user.id}. SID: ${responseData.sid}`);
          results.push({ userId: user.id, phone: user.phone, status: 'success', sid: responseData.sid });
        }
      } catch (fetchError) {
        console.error(`Fetch error sending SMS to user ${user.id}:`, fetchError);
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError.message });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // 10. Return Response (remains the same)
    console.log('Finished sending notifications.');
    return new Response(JSON.stringify({ message: 'Startup notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Replace corsHeaders if using Option B
      status: 200,
    });

  } catch (error) {
    console.error('Unhandled error in function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, // Replace corsHeaders if using Option B
      status: 500,
    });
  }
});
