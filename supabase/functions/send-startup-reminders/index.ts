// supabase/functions/send-startup-reminders/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { corsHeaders } from '../_shared/cors.ts';

// Define type for profile data we need
interface UserProfile {
  id: string;
  phone: string;
  timezone: string;
}

// Define type for the relevant part of daily_logs data
interface DailyLogData {
    startup_reminder_sent_at: string | null;
}

// --- NEW: Define type for the objects in the results array ---
interface ResultDetail {
  userId: string;
  phone: string;
  status: 'success' | 'failed' | 'skipped' | 'success_log_failed'; // Specific statuses
  sid?: string;
  error?: string | Record<string, any>; // Allow string or object error
  reason?: string;
}
// --- END NEW TYPE ---

const TARGET_STARTUP_HOUR = 7; // 7 AM (local time)

console.log(`Starting send-startup-reminders function (Target Local Hour: ${TARGET_STARTUP_HOUR})...`);

// --- Helper Function to calculate local hour ---
function calculateLocalHour(utcDate: Date, timezone: string): number | null {
   try {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hourCycle: 'h23',
    });
    const hourString = formatter.format(utcDate);
    const hour = parseInt(hourString, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
        console.error(`[User: ${timezone}] Invalid hour ${hour} calculated`); // Added context
        return null;
    }
    return hour;
   } catch (e) {
       console.error(`[User: ${timezone}] Failed to calculate local hour:`, e); // Added context
       return null;
   }
}

// --- Helper Function to calculate local date string 'YYYY-MM-DD' ---
function calculateLocalDateString(utcDate: Date, timezone: string): string | null {
    try {
        // Using 'sv-SE' locale reliably gives YYYY-MM-DD format
        const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return formatter.format(utcDate);
    } catch (e) {
        console.error(`[User: ${timezone}] Failed to calculate local date string:`, e); // Added context
        return null;
    }
}
// --- END Helper Functions ---


// --- Deno.serve Handler ---
// Note: Ensure your VSCode is configured for Deno to resolve 'Deno' object errors locally
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin Client
    // Note: Ensure Deno environment variables are set in Supabase Function settings
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );
    console.log('Supabase admin client initialized.');

    // Get Twilio Credentials from environment variables
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromPhoneNumber) {
      console.error('Twilio credentials missing in environment variables.');
      throw new Error('Twilio credentials missing.');
    }
    console.log('Twilio credentials retrieved.');

    // Get current time
    const nowUtc = new Date();
    const nowIsoString = nowUtc.toISOString();
    console.log(`Current UTC time: ${nowIsoString}`);

    // Query profiles eligible for notifications
    console.log('Querying profiles for users with SMS enabled, phone, and timezone...');
    const { data: potentialUsers, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, phone, timezone')
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null)
      .not('timezone', 'is', null);

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);

    // Filter users whose local time matches the target hour
    const timeEligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localHour = calculateLocalHour(nowUtc, user.timezone);
      if (localHour === null) {
        // Error already logged in helper function
        return false;
      }
      // Check if the user's current local hour matches the target reminder hour
      return localHour === TARGET_STARTUP_HOUR;
    });

    console.log(`Found ${timeEligibleUsers.length} users eligible based on local time hour (${TARGET_STARTUP_HOUR}:00).`);

    if (timeEligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No users in the target local time zone hour right now.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // --- Process eligible users: Check reminder status and send SMS ---
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioHeaders = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    // Initialize results array with the specific type
    const results: ResultDetail[] = [];

    for (const user of timeEligibleUsers) {
      const userId = user.id; // Use explicit variable

      // Calculate user's local date string for logging/checking
      const localDateString = calculateLocalDateString(nowUtc, user.timezone);
      if (!localDateString) {
          console.log(`[User: ${userId}] Skipping due to invalid local date calculation.`);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Date calculation error' });
          continue; // Skip to next user
      }

      // *** Check if reminder already sent for today ***
      console.log(`[User: ${userId}] Checking daily log for date ${localDateString}...`);
      try {
        const { data: logData, error: logError } = await supabaseAdmin
          .from('daily_logs')
          .select('startup_reminder_sent_at') // Only select the column we need
          .eq('user_id', userId)
          .eq('log_date', localDateString)
          .maybeSingle(); // Handles 0 or 1 row gracefully

        if (logError) {
            // Log error but don't necessarily stop unless it's critical
            console.error(`[User: ${userId}] Error fetching daily log for ${localDateString}:`, logError.message);
            // Decide whether to skip or proceed despite log check error
            results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Error fetching daily log: ${logError.message}` });
            continue; // Skip user if log check fails
        }

        if (logData && logData.startup_reminder_sent_at) {
            // Reminder already sent for this user today
            console.log(`[User: ${userId}] Startup reminder already sent on ${localDateString}. Skipping.`);
            results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Already sent' });
            continue; // Skip to next user
        }
        // If logData is null or startup_reminder_sent_at is null, proceed.
        console.log(`[User: ${userId}] Reminder not sent yet for ${localDateString}. Proceeding.`);

      } catch (e) {
          console.error(`[User: ${userId}] Unexpected error during daily log check:`, e);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Log check exception: ${e.message}` });
          continue; // Skip user on unexpected error
      }
      // *** END Check ***

      // Prepare and send SMS via Twilio
      const messageBody = `☀️ Good morning! Time for your Jo App Startup routine. Let's make it a great day!`;
      const requestBody = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`[User: ${userId}] Attempting to send startup SMS to ${user.phone}...`);
      let smsSentSuccessfully = false;
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: twilioHeaders, body: requestBody.toString() });
        const responseData = await response.json(); // Always try to parse response

        if (!response.ok) {
          console.error(`[User: ${userId}] Twilio API error: Status ${response.status}`, responseData);
          results.push({ userId: userId, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`[User: ${userId}] Startup SMS sent successfully. SID: ${responseData.sid}`);
          results.push({ userId: userId, phone: user.phone, status: 'success', sid: responseData.sid });
          smsSentSuccessfully = true; // Mark as successful for log update
        }
      } catch (fetchError: unknown) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`[User: ${userId}] Network/Fetch error sending SMS:`, fetchError);
        results.push({ userId: userId, phone: user.phone, status: 'failed', error: errorMessage });
      }

      // *** Update daily_log if SMS was sent successfully ***
      if (smsSentSuccessfully) {
          console.log(`[User: ${userId}] Updating daily_log for ${localDateString} to mark reminder sent...`);
          try {
              const { error: upsertError } = await supabaseAdmin
                  .from('daily_logs')
                  .upsert(
                      {
                          user_id: userId,
                          log_date: localDateString, // Ensure log_date is included
                          startup_reminder_sent_at: nowIsoString // Set the timestamp
                          // Include other necessary fields if inserting a new row,
                          // otherwise upsert handles updating the existing row.
                          // e.g., startup_completed: false, shutdown_completed: false (if needed on insert)
                      },
                      {
                          onConflict: 'user_id, log_date', // IMPORTANT: Assumes UNIQUE constraint exists
                      }
                  );

              if (upsertError) {
                  console.error(`[User: ${userId}] Error upserting daily_log for ${localDateString}:`, upsertError.message);
                  // Find the original success result and update its status
                  const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
                  if (resultIndex !== -1) {
                      results[resultIndex].status = 'success_log_failed';
                      results[resultIndex].error = `Upsert failed: ${upsertError.message}`;
                  }
              } else {
                  console.log(`[User: ${userId}] Successfully updated daily_log for ${localDateString}.`);
              }
          } catch (e) {
              console.error(`[User: ${userId}] Unexpected error during daily_log upsert:`, e);
              const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
              if (resultIndex !== -1) {
                  results[resultIndex].status = 'success_log_failed';
                  results[resultIndex].error = `Upsert exception: ${e.message}`;
              }
          }
      }
      // *** END Update ***

      // Optional delay between processing users
      await new Promise(resolve => setTimeout(resolve, 250));
    } // End of user loop

    console.log('Finished processing startup notifications.');
    return new Response(JSON.stringify({ message: 'Startup notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error: unknown) {
    // Catch unhandled errors in the main try block
    console.error('Unhandled error in startup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
