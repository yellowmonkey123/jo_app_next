// supabase/functions/send-midday-reminders/index.ts

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts'; // Assuming cors.ts is in _shared

// Define interfaces for data structures
interface UserProfile {
  id: string;
  phone: string;
  timezone: string;
}

interface Habit {
  name: string;
}

interface DailyLogData {
  midday_reminder_sent_at: string | null; // Ensure this matches the column name you added
}

interface ResultDetail {
  userId: string;
  phone: string;
  status: 'success' | 'failed' | 'skipped' | 'success_log_failed' | 'no_anytime_habits';
  sid?: string;
  error?: string | Record<string, any>;
  reason?: string;
}

// Target hour for the midday reminder (12 PM local time)
const TARGET_MIDDAY_HOUR = 12;

console.log(`Starting send-midday-reminders function (Target Local Hour: ${TARGET_MIDDAY_HOUR})...`);

// --- Utility Functions (Copied from other functions for consistency) ---

function calculateLocalHour(utcDate: Date, timezone: string): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hourCycle: 'h23', // Use 24-hour format
    });
    const hourString = formatter.format(utcDate);
    const hour = parseInt(hourString, 10);
    if (isNaN(hour) || hour < 0 || hour > 23) {
      console.error(`[User TZ: ${timezone}] Invalid hour ${hour} calculated from string "${hourString}"`);
      return null;
    }
    return hour;
  } catch (e) {
    console.error(`[User TZ: ${timezone}] Failed to calculate local hour:`, e);
    return null;
  }
}

function calculateLocalDateString(utcDate: Date, timezone: string): string | null {
  try {
    // Use 'sv-SE' format (YYYY-MM-DD) which is safe for Supabase date columns
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(utcDate);
  } catch (e) {
    console.error(`[User TZ: ${timezone}] Failed to calculate local date string:`, e);
    return null;
  }
}

// --- Main Function Logic ---

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` } } }
    );
    console.log('Supabase admin client initialized.');

    // Get Twilio Credentials
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
    const nowIsoString = nowUtc.toISOString(); // For logging and DB timestamps
    console.log(`Current UTC time: ${nowIsoString}`);

    // 1. Fetch potential users (enabled SMS, have phone & timezone)
    console.log('Querying profiles for users with SMS enabled, phone, and timezone...');
    // Corrected type assertion placement (after the entire await expression)
    const { data: potentialUsers, error: profilesError } = (await supabaseAdmin
      .from('profiles')
      .select('id, phone, timezone')
      .eq('enable_sms_notifications', true)
      .not('phone', 'is', null)
      .not('timezone', 'is', null)) as { data: UserProfile[] | null; error: any }; // Type assertion after await

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      throw profilesError;
    }

    if (!potentialUsers || potentialUsers.length === 0) {
      console.log('No potential users found with SMS enabled.');
      return new Response(JSON.stringify({ message: 'No potential users found.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }
    console.log(`Found ${potentialUsers.length} potential users.`);

    // 2. Filter users based on their local time matching the target hour
    const timeEligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localHour = calculateLocalHour(nowUtc, user.timezone);
      if (localHour === null) {
        console.log(`[User: ${user.id}] Skipping user due to local hour calculation error.`);
        return false; // Skip user if hour calculation fails
      }
      // Check if the user's local hour matches the target midday hour
      return localHour === TARGET_MIDDAY_HOUR;
    });

    console.log(`Found ${timeEligibleUsers.length} users eligible based on local time hour (${TARGET_MIDDAY_HOUR}:00).`);

    if (timeEligibleUsers.length === 0) {
      // This is expected if the function runs outside the target hour
      console.log(`No users currently in the target local time zone hour (${TARGET_MIDDAY_HOUR}:00).`);
      return new Response(JSON.stringify({ message: `No users in the target local time zone hour (${TARGET_MIDDAY_HOUR}:00) right now.` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    // Prepare Twilio request details
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioHeaders = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results: ResultDetail[] = []; // To store results for each user

    // 3. Process each time-eligible user
    for (const user of timeEligibleUsers) {
      const userId = user.id;
      let smsSentSuccessfully = false; // Flag to track SMS success for logging

      // Calculate user's local date string (YYYY-MM-DD)
      const localDateString = calculateLocalDateString(nowUtc, user.timezone);
      if (!localDateString) {
        console.log(`[User: ${userId}] Skipping due to invalid local date calculation.`);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Local date calculation error' });
        continue; // Skip to the next user
      }

      // 4. Check if midday reminder was already sent today for this user
      console.log(`[User: ${userId}] Checking daily log for date ${localDateString} to see if midday reminder was sent...`);
      try {
        // Corrected type assertion placement (after the entire await expression)
        const { data: logData, error: logError } = (await supabaseAdmin
          .from('daily_logs')
          .select('midday_reminder_sent_at') // Select the new column
          .eq('user_id', userId)
          .eq('log_date', localDateString)
          .maybeSingle()) as { data: DailyLogData | null; error: any }; // Type assertion after await

        if (logError) {
          console.error(`[User: ${userId}] Error fetching daily log for ${localDateString}:`, logError.message);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Error fetching daily log: ${logError.message}` });
          continue; // Skip to the next user
        }

        // If reminder already sent, log and skip
        if (logData && logData.midday_reminder_sent_at) {
          console.log(`[User: ${userId}] Midday reminder already sent on ${localDateString}. Skipping.`);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Already sent today' });
          continue; // Skip to the next user
        }
        console.log(`[User: ${userId}] Midday reminder not sent yet for ${localDateString}. Proceeding.`);

      } catch (e) {
        console.error(`[User: ${userId}] Unexpected error during daily log check:`, e);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Log check exception: ${e.message}` });
        continue; // Skip to the next user
      }

      // 5. Fetch user's "Anytime" habits (CASE-INSENSITIVE)
      console.log(`[User: ${userId}] Fetching 'Anytime' habits (case-insensitive)...`);
      // Corrected type assertion placement (after the entire await expression)
      const { data: anytimeHabits, error: habitsError } = (await supabaseAdmin
        .from('habits')
        .select('name') // Select only the name
        .eq('user_id', userId)
        // Use ilike for case-insensitive matching
        .ilike('timing', 'Anytime') // <<< CHANGED from .eq() to .ilike()
        .order('sort_order', { ascending: true })) as { data: Habit[] | null; error: any }; // Type assertion after await

      if (habitsError) {
          console.error(`[User: ${userId}] Error fetching habits:`, habitsError.message);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Error fetching habits: ${habitsError.message}` });
          continue; // Skip to the next user
      }

      // Add extra logging to see what the query returned
      console.log(`[User: ${userId}] Found ${anytimeHabits ? anytimeHabits.length : 0} habits matching ILIKE 'Anytime'.`);

      if (!anytimeHabits || anytimeHabits.length === 0) {
          console.log(`[User: ${userId}] No 'Anytime' habits found (using ilike). Skipping reminder.`);
          results.push({ userId: userId, phone: user.phone, status: 'no_anytime_habits', reason: 'User has no habits matching ILIKE Anytime' });
          continue; // Skip to the next user
      }

      // 6. Construct the SMS message body
      const habitNames = anytimeHabits.map(h => h.name).join(', '); // Comma-separated list
      const messageBody = `🕛 Quick check-in! Remember your Jo App "Anytime" habits: ${habitNames}`;
      console.log(`[User: ${userId}] Prepared message body: ${messageBody}`); // Log the message

      // 7. Send the SMS via Twilio
      const requestBody = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });
      console.log(`[User: ${userId}] Attempting to send midday reminder SMS to ${user.phone}...`);
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: twilioHeaders, body: requestBody.toString() });
        const responseData = await response.json();

        if (!response.ok) {
          console.error(`[User: ${userId}] Twilio API error sending midday reminder: Status ${response.status}`, responseData);
          results.push({ userId: userId, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`[User: ${userId}] Midday reminder SMS sent successfully. SID: ${responseData.sid}`);
          results.push({ userId: userId, phone: user.phone, status: 'success', sid: responseData.sid });
          smsSentSuccessfully = true; // Mark as successful for logging step
        }
      } catch (fetchError: unknown) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`[User: ${userId}] Network/Fetch error sending midday SMS:`, fetchError);
        results.push({ userId: userId, phone: user.phone, status: 'failed', error: errorMessage });
      }

      // 8. If SMS sent successfully, update the daily log
      if (smsSentSuccessfully) {
        console.log(`[User: ${userId}] Updating daily_log for ${localDateString} to mark midday reminder sent...`);
        try {
          const { error: upsertError } = await supabaseAdmin
            .from('daily_logs')
            .upsert(
              {
                user_id: userId,
                log_date: localDateString,
                midday_reminder_sent_at: nowIsoString // Use the current timestamp
              },
              {
                onConflict: 'user_id, log_date', // Assumes this unique constraint exists
              }
            );

          if (upsertError) {
            console.error(`[User: ${userId}] Error upserting daily_log for midday reminder on ${localDateString}:`, upsertError.message);
            // Update the result status to indicate SMS succeeded but logging failed
            const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
            if (resultIndex !== -1) {
              results[resultIndex].status = 'success_log_failed';
              results[resultIndex].error = `Upsert failed: ${upsertError.message}`;
            }
          } else {
            console.log(`[User: ${userId}] Successfully updated daily_log for ${localDateString} (midday reminder).`);
          }
        } catch (e) {
          console.error(`[User: ${userId}] Unexpected error during daily_log upsert for midday reminder:`, e);
           // Update the result status
           const resultIndex = results.findIndex(r => r.userId === userId && r.status === 'success');
           if (resultIndex !== -1) {
             results[resultIndex].status = 'success_log_failed';
             results[resultIndex].error = `Upsert exception: ${e.message}`;
           }
        }
      }

      // Small delay between processing users to avoid hitting rate limits (optional)
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay

    } // End loop through users

    console.log('Finished processing midday reminder notifications.');
    // Return the results
    return new Response(JSON.stringify({ message: 'Midday reminder notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });

  } catch (error: unknown) {
    // Catch any unhandled errors in the main try block
    console.error('Unhandled error in send-midday-reminders function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
