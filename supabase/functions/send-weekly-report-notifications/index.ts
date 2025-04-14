// supabase/functions/send-weekly-report-notifications/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

// Define type for profile data we need (including timezone)
interface UserProfile {
  id: string;
  phone: string;
  timezone: string; // Added timezone
}

// --- ADDED: Target day (0=Sun, 1=Mon, ..., 6=Sat) and hour for weekly reminders ---
const TARGET_WEEKLY_DAY = 0; // Sunday
const TARGET_WEEKLY_HOUR = 18; // 6 PM (18:00) local time

console.log(`Starting send-weekly-report-notifications function (Target Local Day: ${TARGET_WEEKLY_DAY}, Target Local Hour: ${TARGET_WEEKLY_HOUR})...`);


// --- Helper Functions (Conceptual - use Intl API or a robust date library) ---
// (Ensure these are the *same* implementations as in the other functions)

// Calculates local hour (0-23)
function calculateLocalHour(utcDate: Date, timezone: string): number | null {
   try {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, hour: 'numeric', hourCycle: 'h23'
    });
    const hourString = formatter.format(utcDate);
    const hour = parseInt(hourString, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) return null;
    return hour;
   } catch (e) {
       console.error(`Failed to calculate local hour for timezone ${timezone}:`, e);
       return null;
   }
}

// Calculates local day of the week (0=Sun, 6=Sat)
function calculateLocalDayOfWeek(utcDate: Date, timezone: string): number | null {
    try {
        // 'en-US' locale uses Sunday as 0. Check locale if needed.
        // weekday: 'numeric' might give 1-7 depending on locale, 'short'/'long' are safer if parsing names.
        // Let's use toLocaleString with specific options for clarity.
        const dateInTimezone = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }));
        return dateInTimezone.getDay(); // 0 for Sunday, 1 for Monday, etc.

        // Alternate Intl approach (might be less reliable depending on locale/runtime)
        // const formatter = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'narrow' }); // e.g., 'S' for Sunday
        // const dayInitial = formatter.format(utcDate);
        // const dayMap = {'S': 0, 'M': 1, 'T': 2, 'W': 3, 'H': 4, 'F': 5, 'A': 6}; // Map based on 'narrow' output; fragile!
        // return dayMap[dayInitial] ?? null;

    } catch (e) {
        console.error(`Failed to calculate local day of week for timezone ${timezone}:`, e);
        return null;
    }
}
// --- END Helper Functions ---


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
    const nowUtc = new Date();
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

    // --- Filter Users by Local Day and Time (ADDED) ---
    const eligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localDay = calculateLocalDayOfWeek(nowUtc, user.timezone);
      const localHour = calculateLocalHour(nowUtc, user.timezone);

      if (localDay === null || localHour === null) {
          console.log(`Skipping user ${user.id} due to invalid timezone or calculation error (${user.timezone}).`);
          return false; // Skip if calculation failed
      }

      // Check if it's the target local day AND target local hour
      const isTimeToSend = localDay === TARGET_WEEKLY_DAY && localHour === TARGET_WEEKLY_HOUR;
      if (isTimeToSend) {
          console.log(`User ${user.id} in timezone ${user.timezone} is eligible for weekly report. Local Day: ${localDay}, Local Hour: ${localHour}`);
      }
      return isTimeToSend;
    });

    console.log(`Found ${eligibleUsers.length} users eligible for weekly report notification based on local time.`);

    if (eligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No users in the target local time zone day/hour right now.' }), {
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
    const reportUrl = `${Deno.env.get('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000'}/weekly-report`; // Get base URL

    for (const user of eligibleUsers) { // No need to cast if filter worked correctly
      const messageBody = `📊 Your Jo App weekly report is ready! See your progress and insights here: ${reportUrl}`;
      const body = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`Attempting to send weekly report SMS to user ${user.id} at ${user.phone} (Local Time: Day ${TARGET_WEEKLY_DAY}, Hour ${TARGET_WEEKLY_HOUR})`);
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
      } catch (fetchError: unknown) {
        console.error(`Network/Fetch error sending weekly report SMS to user ${user.id}:`, fetchError);
        results.push({ userId: user.id, phone: user.phone, status: 'failed', error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error' });
      }
      await new Promise(resolve => setTimeout(resolve, 250)); // Optional delay
    }

    console.log('Finished processing weekly report notifications.');
    return new Response(JSON.stringify({ message: 'Weekly report notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error: unknown) {
    console.error('Unhandled error in weekly report function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});