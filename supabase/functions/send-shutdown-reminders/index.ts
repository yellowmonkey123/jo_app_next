// supabase/functions/send-shutdown-reminders/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

// Define type for profile data we need (including timezone)
interface UserProfile {
  id: string;
  phone: string;
  timezone: string; // Added timezone
}

// --- ADDED: Target hour for shutdown reminders ---
const TARGET_SHUTDOWN_HOUR = 20; // 8 PM (local time) - Adjust if needed

console.log(`Starting send-shutdown-reminders function (Target Local Hour: ${TARGET_SHUTDOWN_HOUR})...`);

// --- Helper Function (Conceptual - use Intl API or a robust date library) ---
// Ensure this handles various timezones and returns the hour (0-23) correctly.
// (This should be the same implementation as in the startup function)
function calculateLocalHour(utcDate: Date, timezone: string): number | null {
   try {
    // Example using Intl API
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hourCycle: 'h23', // Use 0-23 hour cycle explicitly
    });
    const hourString = formatter.format(utcDate);
    const hour = parseInt(hourString, 10);

    if (isNaN(hour) || hour < 0 || hour > 23) {
        console.error(`Invalid hour ${hour} calculated for timezone ${timezone}`);
        return null;
    }
    return hour;

   } catch (e) {
       console.error(`Failed to calculate local hour for timezone ${timezone}:`, e);
       return null;
   }
}
// --- END Helper Function ---


// --- Use Deno.serve ---
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

    // --- Twilio Credentials ---
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio credentials missing.');
      throw new Error('Twilio credentials missing.');
    }
    console.log('Twilio credentials retrieved.');

    // --- Get Current Time ---
    const nowUtc = new Date(); // Current time in UTC
    console.log(`Current UTC time: ${nowUtc.toISOString()}`);

    // --- Query Profiles (MODIFIED) ---
    console.log('Querying profiles for users with SMS enabled, phone, and timezone...');
    const { data: potentialUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, timezone') // Select timezone
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null)
      .not('timezone', 'is', null); // Ensure timezone is set

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found with SMS enabled, phone number, and timezone.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);


    // --- REMOVED Daily Log Check ---
    // The check for whether the user *already completed* the shutdown routine today (UTC)
    // is removed. Reminders are sent based on local time regardless of completion status.


    // --- Filter Users by Local Time (ADDED) ---
    const eligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localHour = calculateLocalHour(nowUtc, user.timezone);
      if (localHour === null) {
        console.log(`Skipping user ${user.id} due to invalid timezone or calculation error (${user.timezone}).`);
        return false;
      }
      // Check if the user's current local hour matches the target reminder hour
      const isTimeToSend = localHour === TARGET_SHUTDOWN_HOUR;
      if (isTimeToSend) {
          console.log(`User ${user.id} in timezone ${user.timezone} is eligible. Local hour: ${localHour}, Target: ${TARGET_SHUTDOWN_HOUR}`);
      }
      return isTimeToSend;
    });

    console.log(`Found ${eligibleUsers.length} users eligible for shutdown reminder based on local time.`);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No users in the target local time zone hour right now.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // --- Send SMS to Time-Eligible Users ---
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const headers = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results = [];
    for (const user of eligibleUsers) {
      // --- UPDATED MESSAGE FOR SHUTDOWN ---
      const messageBody = `🌙 Time to wind down! This is your reminder to complete the Jo App Shutdown routine and reflect on your day.`;
      const body = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`Attempting to send shutdown SMS to user ${user.id} at ${user.phone} (Local Hour: ${TARGET_SHUTDOWN_HOUR})`);
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: headers, body: body.toString() });
        const responseData = await response.json();
        if (!response.ok) {
          console.error(`Twilio error for user ${user.id}: Status ${response.status}`, responseData);
          results.push({ userId: user.id, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`Shutdown SMS sent successfully to user ${user.id}. SID: ${responseData.sid}`);
          results.push({ userId: user.id, phone: user.phone, status: 'success', sid: responseData.sid });
        }
      } catch (fetchError: unknown) {
        console.error(`Network/Fetch error sending shutdown SMS to user ${user.id}:`, fetchError);
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' });
      }
      // Optional delay
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log('Finished processing shutdown notifications.');
    return new Response(JSON.stringify({ message: 'Shutdown notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error: unknown) {
    console.error('Unhandled error in shutdown function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});