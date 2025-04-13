// supabase/functions/send-startup-reminders/index.ts

// --- REMOVED old import ---
// import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts'; // Assuming _shared/cors.ts is correct

// Define type for profile data we need
interface UserProfile {
  id: string;
  phone: string;
}

// Define structure for daily log data we need
interface DailyLogEntry {
    user_id: string;
    startup_completed_at: string | null; // Check startup this time
}

console.log('Starting send-startup-reminders function...'); // Updated log message

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

    const today = new Date().toISOString().split('T')[0];
    console.log(`Today's date (UTC): ${today}`);

    console.log('Querying profiles for eligible users...');
    const { data: potentialUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone')
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found with SMS enabled and phone number.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);

    const userIds = potentialUsers.map(u => u.id);

    console.log(`Querying daily_logs for ${userIds.length} users for date ${today}...`);
    const { data: todaysLogs, error: logsError } = await supabaseAdmin
      .from('daily_logs')
      .select('user_id, startup_completed_at') // Select startup_completed_at
      .eq('log_date', today)
      .in('user_id', userIds);

    if (logsError) {
      console.error('Error querying daily_logs:', logsError);
      throw logsError;
    }
    console.log(`Found ${todaysLogs?.length ?? 0} daily log entries for today for these users.`);

    const logStatusMap = new Map<string, { completed: boolean }>();
    todaysLogs?.forEach((log: DailyLogEntry) => {
        // Check if startup_completed_at is not null
        logStatusMap.set(log.user_id, { completed: log.startup_completed_at !== null });
    });

    const eligibleUsers = potentialUsers.filter((user: UserProfile) => {
        const logStatus = logStatusMap.get(user.id);
        return !logStatus || !logStatus.completed;
    });

    console.log(`Found ${eligibleUsers.length} eligible users for startup reminder after filtering.`);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No eligible users for startup reminder today.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results = [];
    for (const user of eligibleUsers) {
      // --- UPDATED MESSAGE FOR STARTUP ---
      const messageBody = `☀️ Good morning! Just a friendly reminder to complete your Jo App Startup routine today. Let's make it a great day!`;
      const body = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`Attempting to send startup SMS to user ${user.id} at ${user.phone}`);
      // --- FIXED: Catch as unknown, add type check ---
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: headers, body: body.toString() });
        const responseData = await response.json();
        if (!response.ok) {
          console.error(`Twilio error for user ${user.id}: Status ${response.status}`, responseData);
          results.push({ userId: user.id, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`Startup SMS sent successfully to user ${user.id}. SID: ${responseData.sid}`);
          results.push({ userId: user.id, phone: user.phone, status: 'success', sid: responseData.sid });
        }
      } catch (fetchError: unknown) { // Catch as unknown
        console.error(`Workspace error sending startup SMS to user ${user.id}:`, fetchError);
        // Check if it's an Error instance before accessing message
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' });
      }
      await new Promise(resolve => setTimeout(resolve, 200)); // Delay
    }

    console.log('Finished sending startup notifications.');
    return new Response(JSON.stringify({ message: 'Startup notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  // --- FIXED: Catch as unknown, add type check ---
  } catch (error: unknown) {
    console.error('Unhandled error in startup function:', error); // Updated log message
    // Check if it's an Error instance before accessing message
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});