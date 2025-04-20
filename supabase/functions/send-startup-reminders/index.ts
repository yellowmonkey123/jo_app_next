import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { corsHeaders } from '../_shared/cors.ts';

interface UserProfile {
  id: string;
  phone: string;
  timezone: string;
}

interface DailyLogData {
  startup_reminder_sent_at: string | null;
}

interface ResultDetail {
  userId: string;
  phone: string;
  status: 'success' | 'failed' | 'skipped' | 'success_log_failed';
  sid?: string;
  error?: string | Record<string, any>;
  reason?: string;
}

const TARGET_STARTUP_HOUR = 7;

console.log(`Starting send-startup-reminders function (Target Local Hour: ${TARGET_STARTUP_HOUR})...`);

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
      console.error(`[User: ${timezone}] Invalid hour ${hour} calculated`);
      return null;
    }
    return hour;
  } catch (e) {
    console.error(`[User: ${timezone}] Failed to calculate local hour:`, e);
    return null;
  }
}

function calculateLocalDateString(utcDate: Date, timezone: string): string | null {
  try {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(utcDate);
  } catch (e) {
    console.error(`[User: ${timezone}] Failed to calculate local date string:`, e);
    return null;
  }
}

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

    const nowUtc = new Date();
    const nowIsoString = nowUtc.toISOString();
    console.log(`Current UTC time: ${nowIsoString}`);

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

    const timeEligibleUsers = potentialUsers.filter((user: UserProfile) => {
      const localHour = calculateLocalHour(nowUtc, user.timezone);
      if (localHour === null) {
        return false;
      }
      return localHour === TARGET_STARTUP_HOUR;
    });

    console.log(`Found ${timeEligibleUsers.length} users eligible based on local time hour (${TARGET_STARTUP_HOUR}:00).`);

    if (timeEligibleUsers.length === 0) {
      return new Response(JSON.stringify({ message: 'No users in the target local time zone hour right now.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioHeaders = {
      'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };

    const results: ResultDetail[] = [];

    for (const user of timeEligibleUsers) {
      const userId = user.id;

      const localDateString = calculateLocalDateString(nowUtc, user.timezone);
      if (!localDateString) {
        console.log(`[User: ${userId}] Skipping due to invalid local date calculation.`);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Date calculation error' });
        continue;
      }

      console.log(`[User: ${userId}] Checking daily log for date ${localDateString}...`);
      try {
        const { data: logData, error: logError } = await supabaseAdmin
          .from('daily_logs')
          .select('startup_reminder_sent_at')
          .eq('user_id', userId)
          .eq('log_date', localDateString)
          .maybeSingle();

        if (logError) {
          console.error(`[User: ${userId}] Error fetching daily log for ${localDateString}:`, logError.message);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Error fetching daily log: ${logError.message}` });
          continue;
        }

        if (logData && logData.startup_reminder_sent_at) {
          console.log(`[User: ${userId}] Startup reminder already sent on ${localDateString}. Skipping.`);
          results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: 'Already sent' });
          continue;
        }
        console.log(`[User: ${userId}] Reminder not sent yet for ${localDateString}. Proceeding.`);
      } catch (e) {
        console.error(`[User: ${userId}] Unexpected error during daily log check:`, e);
        results.push({ userId: userId, phone: user.phone, status: 'skipped', reason: `Log check exception: ${e.message}` });
        continue;
      }

      const messageBody = `☀️ Good morning! Time for your Jo App Startup routine. Let's make it a great day!`;
      const requestBody = new URLSearchParams({ To: user.phone, From: fromPhoneNumber, Body: messageBody });

      console.log(`[User: ${userId}] Attempting to send startup SMS to ${user.phone}...`);
      let smsSentSuccessfully = false;
      try {
        const response = await fetch(twilioUrl, { method: 'POST', headers: twilioHeaders, body: requestBody.toString() });
        const responseData = await response.json();

        if (!response.ok) {
          console.error(`[User: ${userId}] Twilio API error: Status ${response.status}`, responseData);
          results.push({ userId: userId, phone: user.phone, status: 'failed', error: responseData });
        } else {
          console.log(`[User: ${userId}] Startup SMS sent successfully. SID: ${responseData.sid}`);
          results.push({ userId: userId, phone: user.phone, status: 'success', sid: responseData.sid });
          smsSentSuccessfully = true;
        }
      } catch (fetchError: unknown) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : 'Unknown fetch error';
        console.error(`[User: ${userId}] Network/Fetch error sending SMS:`, fetchError);
        results.push({ userId: userId, phone: user.phone, status: 'failed', error: errorMessage });
      }

      if (smsSentSuccessfully) {
        console.log(`[User: ${userId}] Updating daily_log for ${localDateString} to mark reminder sent...`);
        try {
          const { error: upsertError } = await supabaseAdmin
            .from('daily_logs')
            .upsert(
              {
                user_id: userId,
                log_date: localDateString,
                startup_reminder_sent_at: nowIsoString
              },
              {
                onConflict: 'user_id, log_date',
              }
            );

          if (upsertError) {
            console.error(`[User: ${userId}] Error upserting daily_log for ${localDateString}:`, upsertError.message);
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

      await new Promise(resolve => setTimeout(resolve, 250));
    }

    console.log('Finished processing startup notifications.');
    return new Response(JSON.stringify({ message: 'Startup notifications processed.', results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (error: unknown) {
    console.error('Unhandled error in startup function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});